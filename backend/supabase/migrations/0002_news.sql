-- 0002_news.sql — News aggregation engine.
--
-- Two-table split is the important decision here. `news_ingest` is the private
-- landing zone: raw HTML, full extracted text, everything the crawler saw.
-- `news_articles` is the public surface: headline, short excerpt, attribution,
-- deep link. Nothing moves between them without passing the promotion gate.
--
-- Why: republishing an article body is straightforward copyright infringement,
-- and in the EU the press publishers' right (DSM Art. 15) covers snippets beyond
-- "very short extracts" too. Storing full text privately for processing is a
-- different act from publishing it. The schema makes the safe thing the default
-- by keeping body text out of the published table entirely.

create type ingest_status as enum (
  'new',        -- fetched, not yet parsed
  'parsed',     -- extracted and normalized
  'duplicate',  -- matched an existing item
  'rejected',   -- failed a quality or compliance rule
  'promoted'    -- published as a news_article
);

create type entity_method as enum ('rule', 'embedding', 'llm', 'manual');

-- ---------------------------------------------------------------------------
-- Sources and run bookkeeping
-- ---------------------------------------------------------------------------

create table news_sources (
  id                   uuid primary key default gen_random_uuid(),
  source_id            uuid not null references sources (id) on delete restrict,
  name                 text not null,
  homepage             text not null,
  feed_url             text,
  kind                 text not null default 'rss'
                       check (kind in ('rss','atom','sitemap','html','api')),
  jurisdiction_id      uuid references jurisdictions (id) on delete set null,
  language             text not null default 'en',
  -- Politeness contract, read from robots.txt at review time.
  crawl_delay_seconds  integer not null default 5 check (crawl_delay_seconds >= 0),
  max_items_per_run    integer not null default 50,
  -- Conditional GET state: skips unchanged feeds entirely, which is both
  -- cheaper and the single most effective courtesy to a small publisher.
  last_etag            text,
  last_modified        text,
  last_fetched_at      timestamptz,
  last_success_at      timestamptz,
  consecutive_failures integer not null default 0,
  is_enabled           boolean not null default false,
  created_at           timestamptz not null default now()
);

comment on column news_sources.is_enabled is
  'Stays false until the parent sources row has permitted_use set to something '
  'other than unknown or scrape_prohibited. The collector enforces this.';

create index news_sources_enabled_idx on news_sources (is_enabled) where is_enabled;

create table ingest_runs (
  id            uuid primary key default gen_random_uuid(),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  trigger       text not null default 'schedule'
                check (trigger in ('schedule','manual','backfill')),
  status        text not null default 'running'
                check (status in ('running','succeeded','failed','partial')),
  -- {"fetched": 120, "parsed": 118, "duplicates": 74, "promoted": 31}
  stats         jsonb not null default '{}'::jsonb,
  error         text
);

create index ingest_runs_started_idx on ingest_runs (started_at desc);

-- ---------------------------------------------------------------------------
-- Staging — private, never served to the public
-- ---------------------------------------------------------------------------

create table news_ingest (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid references ingest_runs (id) on delete set null,
  news_source_id  uuid not null references news_sources (id) on delete cascade,
  url             text not null,
  canonical_url   text,
  -- sha256 of the canonicalized URL (scheme+host lowercased, tracking params
  -- stripped, trailing slash normalized). Dedupe layer 1.
  url_hash        text not null unique,
  http_status     integer,
  fetched_at      timestamptz not null default now(),
  raw_html        text,
  extracted_text  text,
  -- sha256 of normalized extracted_text. Dedupe layer 2: catches the same story
  -- republished at a different URL.
  content_hash    text,
  title_raw       text,
  author_raw      text,
  published_raw   text,
  published_at    timestamptz,
  language        text,
  status          ingest_status not null default 'new',
  reject_reason   text,
  promoted_at     timestamptz
);

create index news_ingest_status_idx   on news_ingest (status);
create index news_ingest_content_idx  on news_ingest (content_hash) where content_hash is not null;
create index news_ingest_source_idx   on news_ingest (news_source_id, fetched_at desc);
create index news_ingest_title_trgm   on news_ingest using gin (title_raw gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Published feed — headline, excerpt, attribution, link. No body text.
-- ---------------------------------------------------------------------------

create table news_articles (
  id              uuid primary key default gen_random_uuid(),
  ingest_id       uuid unique references news_ingest (id) on delete set null,
  news_source_id  uuid not null references news_sources (id) on delete restrict,
  title           text not null,
  -- Hard cap enforced in the database, because a config value someone edits at
  -- 2am is not a control. 320 chars sits inside "very short extract" in every
  -- market considered. Tighten per-jurisdiction if counsel advises.
  excerpt         text check (excerpt is null or char_length(excerpt) <= 320),
  -- Our own words, generated from the source. Not an extract, so it is a
  -- separate work rather than a reproduction.
  ai_summary      text check (ai_summary is null or char_length(ai_summary) <= 600),
  author          text,
  published_at    timestamptz not null,
  canonical_url   text not null unique,
  image_url       text,
  language        text not null default 'en',
  status          publication_status not null default 'review',
  published_by    uuid,                       -- profiles.id, FK added in 0003
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  search_vector   tsvector generated always as (
                    to_tsvector('simple',
                      coalesce(title, '') || ' ' || coalesce(excerpt, ''))
                  ) stored
);

create index news_articles_feed_idx   on news_articles (published_at desc) where status = 'published';
create index news_articles_search_idx on news_articles using gin (search_vector);
create index news_articles_title_trgm on news_articles using gin (title gin_trgm_ops);

create trigger news_articles_touch
  before update on news_articles
  for each row execute function public.touch_updated_at();

-- The join that makes the two engines one product: a story about a firm shows
-- up on that firm's directory profile.
create table news_article_entities (
  id                uuid primary key default gen_random_uuid(),
  article_id        uuid not null references news_articles (id) on delete cascade,
  firm_id           uuid references firms (id) on delete cascade,
  lawyer_id         uuid references lawyers (id) on delete cascade,
  jurisdiction_id   uuid references jurisdictions (id) on delete cascade,
  practice_area_id  uuid references practice_areas (id) on delete cascade,
  confidence        numeric(3,2) not null check (confidence between 0 and 1),
  method            entity_method not null default 'llm',
  verified_by       uuid,                     -- profiles.id, FK added in 0003
  verified_at       timestamptz,
  created_at        timestamptz not null default now(),
  check (num_nonnulls(firm_id, lawyer_id, jurisdiction_id, practice_area_id) >= 1)
);

create index nae_article_idx on news_article_entities (article_id);
create index nae_firm_idx    on news_article_entities (firm_id)   where firm_id is not null;
create index nae_lawyer_idx  on news_article_entities (lawyer_id) where lawyer_id is not null;

-- ---------------------------------------------------------------------------
-- Ingest RPC — the single write path for the Python worker
-- ---------------------------------------------------------------------------

-- The worker calls this instead of INSERTing directly. Dedupe, run accounting,
-- and compliance checks then live in one place that cannot be bypassed by a
-- future script that forgot a rule.
create or replace function public.ingest_news_item(
  p_run_id         uuid,
  p_news_source_id uuid,
  p_url            text,
  p_url_hash       text,
  p_canonical_url  text default null,
  p_http_status    integer default null,
  p_raw_html       text default null,
  p_extracted_text text default null,
  p_content_hash   text default null,
  p_title          text default null,
  p_author         text default null,
  p_published_at   timestamptz default null,
  p_language       text default null
)
returns table (ingest_id uuid, outcome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_enabled  boolean;
  v_existing uuid;
begin
  -- Compliance gate. A disabled or unreviewed source cannot land data even if
  -- a worker is misconfigured.
  select ns.is_enabled and s.permitted_use not in ('unknown','scrape_prohibited')
    into v_enabled
  from news_sources ns
  join sources s on s.id = ns.source_id
  where ns.id = p_news_source_id;

  if v_enabled is distinct from true then
    return query select null::uuid, 'blocked_source'::text;
    return;
  end if;

  -- Dedupe layer 1: same canonical URL.
  select id into v_existing from news_ingest where url_hash = p_url_hash;
  if v_existing is not null then
    return query select v_existing, 'duplicate_url'::text;
    return;
  end if;

  -- Dedupe layer 2: same body seen at a different URL within the last week
  -- (wire copy syndicated across outlets).
  if p_content_hash is not null then
    select id into v_existing
    from news_ingest
    where content_hash = p_content_hash
      and fetched_at > now() - interval '7 days'
    limit 1;

    if v_existing is not null then
      insert into news_ingest (
        run_id, news_source_id, url, canonical_url, url_hash, http_status,
        title_raw, author_raw, published_at, language, content_hash, status, reject_reason
      ) values (
        p_run_id, p_news_source_id, p_url, p_canonical_url, p_url_hash, p_http_status,
        p_title, p_author, p_published_at, p_language, p_content_hash,
        'duplicate', 'content_hash matches ' || v_existing::text
      )
      returning id into v_id;

      return query select v_id, 'duplicate_content'::text;
      return;
    end if;
  end if;

  insert into news_ingest (
    run_id, news_source_id, url, canonical_url, url_hash, http_status,
    raw_html, extracted_text, content_hash, title_raw, author_raw,
    published_at, language, status
  ) values (
    p_run_id, p_news_source_id, p_url, p_canonical_url, p_url_hash, p_http_status,
    p_raw_html, p_extracted_text, p_content_hash, p_title, p_author,
    p_published_at, p_language, 'parsed'
  )
  returning id into v_id;

  return query select v_id, 'inserted'::text;
end;
$$;

revoke all on function public.ingest_news_item from public, anon, authenticated;

-- Promotion is deliberately separate and never called by the crawler: moving an
-- item to the public feed is an editorial act, whether a human or a rule does it.
create or replace function public.promote_news_item(
  p_ingest_id uuid,
  p_excerpt   text,
  p_summary   text default null,
  p_actor     uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_article_id uuid;
  v_row        news_ingest%rowtype;
begin
  select * into v_row from news_ingest where id = p_ingest_id;
  if not found then
    raise exception 'ingest item % not found', p_ingest_id;
  end if;
  if v_row.status = 'promoted' then
    raise exception 'ingest item % already promoted', p_ingest_id;
  end if;

  insert into news_articles (
    ingest_id, news_source_id, title, excerpt, ai_summary, author,
    published_at, canonical_url, language, status, published_by
  ) values (
    v_row.id, v_row.news_source_id, v_row.title_raw, p_excerpt, p_summary,
    v_row.author_raw, coalesce(v_row.published_at, v_row.fetched_at),
    coalesce(v_row.canonical_url, v_row.url), coalesce(v_row.language, 'en'),
    'review', p_actor
  )
  on conflict (canonical_url) do nothing
  returning id into v_article_id;

  if v_article_id is null then
    update news_ingest
       set status = 'duplicate', reject_reason = 'canonical_url already published'
     where id = p_ingest_id;
    return null;
  end if;

  update news_ingest
     set status = 'promoted', promoted_at = now()
   where id = p_ingest_id;

  return v_article_id;
end;
$$;

revoke all on function public.promote_news_item from public, anon;
