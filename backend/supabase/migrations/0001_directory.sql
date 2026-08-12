-- 0001_directory.sql — Directory engine: firms, lawyers, rankings, evidence.
--
-- Design rule that shapes this whole file: a published ranking is never mutated
-- in place. Scores are written per ranking_run against a versioned methodology,
-- so any placement can be reproduced from its inputs months later. That audit
-- trail is the product (open methodology) and the defense (a placement you can
-- trace to sources is fair comment on verifiable facts).

create extension if not exists pgcrypto;    -- gen_random_uuid()
create extension if not exists pg_trgm;     -- fuzzy name / title matching

-- ---------------------------------------------------------------------------
-- Shared enums
-- ---------------------------------------------------------------------------

create type publication_status as enum ('draft', 'review', 'published', 'archived');

create type source_kind as enum (
  'directory',   -- Chambers, Legal 500, Law.asia
  'court',       -- official judgment portals
  'registry',    -- bar associations, corporate registries
  'news',
  'survey',      -- our own client/peer surveys
  'submission'   -- firm-provided evidence
);

-- Recorded per source BEFORE any collector is written for it.
create type permitted_use as enum (
  'api',                -- documented API, terms accepted
  'bulk_download',      -- official bulk data
  'feed',               -- RSS/Atom offered for syndication
  'scrape_permitted',   -- robots + ToS reviewed and allow it
  'scrape_prohibited',  -- explicitly disallowed: do not collect
  'licensed',           -- commercial agreement in place
  'unknown'             -- default: collection blocked until reviewed
);

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table jurisdictions (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid references jurisdictions (id) on delete restrict,
  slug          text not null unique,
  name          text not null,
  -- Zero-padded ISO 3166-1 numeric. Joins directly to the `id` field in the
  -- Natural Earth topology the frontend globe renders, so a country click maps
  -- to a row without a lookup table.
  iso_numeric   char(3) unique,
  iso_alpha2    char(2) unique,
  region        text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

comment on column jurisdictions.iso_numeric is
  'Matches world-atlas / Natural Earth feature ids used by the frontend globe.';

-- Sub-national and supra-national entries are legitimate: "England & Wales",
-- "New York", "EU" are all jurisdictions a firm is ranked in.
create index jurisdictions_parent_idx on jurisdictions (parent_id);

create table practice_areas (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references practice_areas (id) on delete restrict,
  slug        text not null unique,
  name        text not null,
  description text,
  is_active   boolean not null default true
);

create index practice_areas_parent_idx on practice_areas (parent_id);

-- Band 1..6, Tier 1..3, "Notable" — schemes differ by market, so this is data.
create table ranking_tiers (
  id       uuid primary key default gen_random_uuid(),
  scheme   text not null,
  label    text not null,
  ordinal  smallint not null,           -- 1 = best
  unique (scheme, label),
  unique (scheme, ordinal)
);

-- ---------------------------------------------------------------------------
-- Firms and people
-- ---------------------------------------------------------------------------

create table firms (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  display_name         text not null,
  legal_name           text,
  hq_jurisdiction_id   uuid references jurisdictions (id) on delete set null,
  founded_year         smallint check (founded_year between 1500 and 2100),
  website              text,
  logo_url             text,
  headcount            integer check (headcount >= 0),
  description          text,
  status               publication_status not null default 'draft',
  -- Set when a firm passes profile verification; drives the "claimed" badge.
  claimed_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  search_vector        tsvector generated always as (
                         to_tsvector('simple',
                           coalesce(display_name, '') || ' ' || coalesce(legal_name, ''))
                       ) stored
);

create index firms_status_idx        on firms (status);
create index firms_hq_idx            on firms (hq_jurisdiction_id);
create index firms_search_idx        on firms using gin (search_vector);
create index firms_name_trgm_idx     on firms using gin (display_name gin_trgm_ops);

-- A firm operates in many jurisdictions; rankings are per-office-market.
create table firm_offices (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references firms (id) on delete cascade,
  jurisdiction_id  uuid not null references jurisdictions (id) on delete restrict,
  city             text,
  is_headquarters  boolean not null default false,
  opened_year      smallint,
  unique (firm_id, jurisdiction_id, city)
);

create index firm_offices_firm_idx on firm_offices (firm_id);
create index firm_offices_juris_idx on firm_offices (jurisdiction_id);

create table lawyers (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  full_name         text not null,
  -- Native-script name, kept separate so Korean/Japanese/Chinese names are not
  -- lossily transliterated into the display name.
  local_name        text,
  firm_id           uuid references firms (id) on delete set null,
  title             text,
  jurisdiction_id   uuid references jurisdictions (id) on delete set null,
  bar_admissions    text[],
  languages         text[],
  photo_url         text,
  profile_url       text,
  status            publication_status not null default 'draft',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  search_vector     tsvector generated always as (
                      to_tsvector('simple',
                        coalesce(full_name, '') || ' ' || coalesce(local_name, ''))
                    ) stored
);

create index lawyers_firm_idx    on lawyers (firm_id);
create index lawyers_status_idx  on lawyers (status);
create index lawyers_search_idx  on lawyers using gin (search_vector);

-- Lateral moves are the main event in legal news; keeping history lets the news
-- pipeline resolve "X joins Y" against a timeline instead of overwriting it.
create table lawyer_positions (
  id          uuid primary key default gen_random_uuid(),
  lawyer_id   uuid not null references lawyers (id) on delete cascade,
  firm_id     uuid not null references firms (id) on delete cascade,
  title       text,
  started_on  date,
  ended_on    date,
  check (ended_on is null or started_on is null or ended_on >= started_on)
);

create index lawyer_positions_lawyer_idx on lawyer_positions (lawyer_id);
create index lawyer_positions_firm_idx   on lawyer_positions (firm_id);

create table firm_practice_areas (
  firm_id           uuid not null references firms (id) on delete cascade,
  practice_area_id  uuid not null references practice_areas (id) on delete cascade,
  primary key (firm_id, practice_area_id)
);

create table lawyer_practice_areas (
  lawyer_id         uuid not null references lawyers (id) on delete cascade,
  practice_area_id  uuid not null references practice_areas (id) on delete cascade,
  primary key (lawyer_id, practice_area_id)
);

-- ---------------------------------------------------------------------------
-- Evidence layer — everything a score is allowed to be computed from
-- ---------------------------------------------------------------------------

create table sources (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  kind           source_kind not null,
  homepage       text,
  terms_url      text,
  permitted_use  permitted_use not null default 'unknown',
  license_note   text,
  -- Compliance gate: collectors must refuse to run against a source that has
  -- not been reviewed, or whose review has gone stale.
  reviewed_at    timestamptz,
  reviewed_by    text,
  is_active      boolean not null default false,
  created_at     timestamptz not null default now()
);

comment on table sources is
  'One row per external data origin. permitted_use is set by a human after '
  'reading robots.txt and the terms of service. Collectors check it at runtime.';

-- A third-party directory's published placement, recorded as a cited fact.
-- We store the observation ("Chambers listed this firm in Band 2 on 2025-04-01"),
-- never a copy of their table.
create table ranking_observations (
  id                uuid primary key default gen_random_uuid(),
  source_id         uuid not null references sources (id) on delete restrict,
  firm_id           uuid references firms (id) on delete cascade,
  lawyer_id         uuid references lawyers (id) on delete cascade,
  jurisdiction_id   uuid references jurisdictions (id) on delete restrict,
  practice_area_id  uuid references practice_areas (id) on delete restrict,
  tier_label        text,
  rank_position     integer,
  observed_on       date not null,
  source_url        text not null,
  retrieved_at      timestamptz not null default now(),
  -- Hash of the retrieved snippet, so we can prove what we read and when.
  evidence_hash     text,
  check (firm_id is not null or lawyer_id is not null)
);

create index ranking_obs_firm_idx   on ranking_observations (firm_id);
create index ranking_obs_lawyer_idx on ranking_observations (lawyer_id);
create index ranking_obs_source_idx on ranking_observations (source_id);
create unique index ranking_obs_dedupe_idx on ranking_observations
  (source_id, coalesce(firm_id, lawyer_id), coalesce(practice_area_id, '00000000-0000-0000-0000-000000000000'::uuid), observed_on);

create table case_records (
  id                uuid primary key default gen_random_uuid(),
  source_id         uuid not null references sources (id) on delete restrict,
  jurisdiction_id   uuid not null references jurisdictions (id) on delete restrict,
  court_name        text not null,
  case_number       text not null,
  case_title        text,
  decided_on        date,
  -- Never the full reporter text: headnotes and syllabi added by commercial
  -- reporters are copyrighted even where the judgment itself is not.
  outcome_summary   text,
  source_url        text not null,
  retrieved_at      timestamptz not null default now(),
  unique (jurisdiction_id, court_name, case_number)
);

create index case_records_decided_idx on case_records (decided_on desc);

create table case_participations (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references case_records (id) on delete cascade,
  firm_id      uuid references firms (id) on delete cascade,
  lawyer_id    uuid references lawyers (id) on delete cascade,
  side         text,                  -- 'claimant', 'respondent', 'appellant', ...
  role         text,                  -- 'lead counsel', 'co-counsel', ...
  prevailed    boolean,               -- null = outcome not classifiable
  confidence   numeric(3,2) check (confidence between 0 and 1),
  check (firm_id is not null or lawyer_id is not null)
);

create index case_part_case_idx   on case_participations (case_id);
create index case_part_firm_idx   on case_participations (firm_id);
create index case_part_lawyer_idx on case_participations (lawyer_id);

-- Firm-submitted evidence (the deal/matter submissions every directory runs on).
create table submissions (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms (id) on delete cascade,
  cycle         text not null,                -- e.g. '2026-APAC'
  submitted_by  uuid,                         -- profiles.id, FK added in 0003
  status        text not null default 'draft'
                check (status in ('draft','submitted','under_review','accepted','rejected')),
  submitted_at  timestamptz,
  reviewed_at   timestamptz,
  notes         text,
  unique (firm_id, cycle)
);

create table submission_matters (
  id                uuid primary key default gen_random_uuid(),
  submission_id     uuid not null references submissions (id) on delete cascade,
  title             text not null,
  description       text,
  practice_area_id  uuid references practice_areas (id) on delete restrict,
  jurisdiction_id   uuid references jurisdictions (id) on delete restrict,
  value_usd         numeric(18,2),
  closed_on         date,
  client_name       text,
  -- Matters are routinely submitted under confidentiality. Publishing one that
  -- was marked confidential is a breach of the submission agreement, so the
  -- flag is enforced in RLS rather than left to application code.
  is_confidential   boolean not null default true,
  referees          jsonb not null default '[]'::jsonb
);

create index submission_matters_sub_idx on submission_matters (submission_id);

-- ---------------------------------------------------------------------------
-- Methodology and ranking runs — the reproducibility spine
-- ---------------------------------------------------------------------------

create table methodologies (
  id              uuid primary key default gen_random_uuid(),
  version         text not null unique,       -- '2026.1'
  title           text not null,
  -- Signal weights, thresholds, and exclusions. Published verbatim on the
  -- methodology page; the scorer reads the same JSON it renders.
  weights         jsonb not null,
  document_url    text,
  effective_from  date not null,
  retired_on      date,
  created_at      timestamptz not null default now()
);

create table ranking_runs (
  id                uuid primary key default gen_random_uuid(),
  methodology_id    uuid not null references methodologies (id) on delete restrict,
  jurisdiction_id   uuid not null references jurisdictions (id) on delete restrict,
  practice_area_id  uuid references practice_areas (id) on delete restrict,
  executed_at       timestamptz not null default now(),
  status            publication_status not null default 'draft',
  published_at      timestamptz,
  -- Counts of each evidence type consumed, for the "what's behind this" panel.
  input_stats       jsonb not null default '{}'::jsonb,
  notes             text
);

-- Exactly one live ranking per market at a time; superseding means publishing
-- a new run, never editing the old one.
create unique index ranking_runs_live_idx on ranking_runs
  (jurisdiction_id, coalesce(practice_area_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'published';

create index ranking_runs_juris_idx on ranking_runs (jurisdiction_id);

create table firm_rankings (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid not null references ranking_runs (id) on delete cascade,
  firm_id        uuid not null references firms (id) on delete cascade,
  tier_id        uuid references ranking_tiers (id) on delete restrict,
  rank_position  integer check (rank_position > 0),
  score          numeric(5,2) check (score between 0 and 100),
  -- Per-signal breakdown: {"directory_consensus": 31.4, "court_record": 22.0}.
  -- This is what makes a placement explainable to the firm that queries it.
  score_breakdown jsonb not null default '{}'::jsonb,
  rationale      text,
  unique (run_id, firm_id)
);

create index firm_rankings_firm_idx on firm_rankings (firm_id);
create index firm_rankings_run_idx  on firm_rankings (run_id, rank_position);

create table lawyer_rankings (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid not null references ranking_runs (id) on delete cascade,
  lawyer_id      uuid not null references lawyers (id) on delete cascade,
  tier_id        uuid references ranking_tiers (id) on delete restrict,
  rank_position  integer check (rank_position > 0),
  score          numeric(5,2) check (score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  rationale      text,
  unique (run_id, lawyer_id)
);

create index lawyer_rankings_lawyer_idx on lawyer_rankings (lawyer_id);

-- Which evidence rows fed which placement. Without this the methodology is
-- "open" in name only.
create table ranking_evidence (
  id                uuid primary key default gen_random_uuid(),
  firm_ranking_id   uuid references firm_rankings (id) on delete cascade,
  lawyer_ranking_id uuid references lawyer_rankings (id) on delete cascade,
  observation_id    uuid references ranking_observations (id) on delete set null,
  case_id           uuid references case_records (id) on delete set null,
  matter_id         uuid references submission_matters (id) on delete set null,
  weight            numeric(6,4),
  check (firm_ranking_id is not null or lawyer_ranking_id is not null)
);

create index ranking_evidence_firm_idx on ranking_evidence (firm_ranking_id);

-- ---------------------------------------------------------------------------
-- Rights process — build it before real names go live, not after
-- ---------------------------------------------------------------------------

create table corrections (
  id             uuid primary key default gen_random_uuid(),
  subject_type   text not null check (subject_type in ('firm','lawyer','ranking','article')),
  subject_id     uuid not null,
  requester_name  text,
  requester_email text not null,
  nature         text not null
                 check (nature in ('inaccuracy','erasure','right_of_reply','other')),
  body           text not null,
  status         text not null default 'received'
                 check (status in ('received','investigating','upheld','rejected','withdrawn')),
  received_at    timestamptz not null default now(),
  resolved_at    timestamptz,
  resolution     text
);

comment on table corrections is
  'GDPR/UK GDPR and Korea PIPA give named individuals rights of access and '
  'erasure over profiles built about them. This table is the intake for that, '
  'and the paper trail if a placement is ever disputed.';

create index corrections_subject_idx on corrections (subject_type, subject_id);
create index corrections_status_idx  on corrections (status) where status <> 'rejected';

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger firms_touch   before update on firms   for each row execute function public.touch_updated_at();
create trigger lawyers_touch before update on lawyers for each row execute function public.touch_updated_at();
