-- 0003_auth_rls.sql — Identity, roles, and row-level security.
--
-- Threat model: the anon key ships to every browser. Assume an attacker has it
-- and is issuing arbitrary PostgREST queries. Every table therefore denies by
-- default and re-grants only what a public visitor may legitimately read.

create type app_role as enum ('admin', 'editor', 'analyst', 'firm_admin', 'viewer');

create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        app_role not null default 'viewer',
  -- Set for firm_admin accounts: the firm whose profile they may edit.
  firm_id     uuid references firms (id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table submissions
  add constraint submissions_submitted_by_fkey
  foreign key (submitted_by) references profiles (id) on delete set null;

alter table news_articles
  add constraint news_articles_published_by_fkey
  foreign key (published_by) references profiles (id) on delete set null;

alter table news_article_entities
  add constraint nae_verified_by_fkey
  foreign key (verified_by) references profiles (id) on delete set null;

-- New signups land as 'viewer'. Elevation is a manual act.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- security definer so the policy below can read profiles without recursing
-- through profiles' own RLS.
create or replace function public.has_role(roles app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any(roles)
  );
$$;

create or replace function public.current_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_firm_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select firm_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere. Anything without an explicit policy is now unreachable
-- by anon and authenticated; service_role still bypasses.
-- ---------------------------------------------------------------------------

alter table profiles              enable row level security;
alter table jurisdictions         enable row level security;
alter table practice_areas        enable row level security;
alter table ranking_tiers         enable row level security;
alter table firms                 enable row level security;
alter table firm_offices          enable row level security;
alter table lawyers               enable row level security;
alter table lawyer_positions      enable row level security;
alter table firm_practice_areas   enable row level security;
alter table lawyer_practice_areas enable row level security;
alter table sources               enable row level security;
alter table ranking_observations  enable row level security;
alter table case_records          enable row level security;
alter table case_participations   enable row level security;
alter table submissions           enable row level security;
alter table submission_matters    enable row level security;
alter table methodologies         enable row level security;
alter table ranking_runs          enable row level security;
alter table firm_rankings         enable row level security;
alter table lawyer_rankings       enable row level security;
alter table ranking_evidence      enable row level security;
alter table corrections           enable row level security;
alter table news_sources          enable row level security;
alter table ingest_runs           enable row level security;
alter table news_ingest           enable row level security;
alter table news_articles         enable row level security;
alter table news_article_entities enable row level security;

-- ---------------------------------------------------------------------------
-- Public read surface
-- ---------------------------------------------------------------------------

create policy read_reference on jurisdictions   for select using (is_active);
create policy read_practice on practice_areas   for select using (is_active);
create policy read_tiers    on ranking_tiers    for select using (true);
create policy read_method   on methodologies    for select using (true);

create policy read_firms on firms
  for select using (status = 'published');

create policy read_lawyers on lawyers
  for select using (status = 'published');

create policy read_offices on firm_offices
  for select using (exists (
    select 1 from firms f where f.id = firm_id and f.status = 'published'
  ));

create policy read_positions on lawyer_positions
  for select using (exists (
    select 1 from lawyers l where l.id = lawyer_id and l.status = 'published'
  ));

create policy read_firm_pa   on firm_practice_areas   for select using (true);
create policy read_lawyer_pa on lawyer_practice_areas for select using (true);

-- Only live runs and their placements are visible; draft runs stay internal
-- until published.
create policy read_runs on ranking_runs
  for select using (status = 'published');

create policy read_firm_rankings on firm_rankings
  for select using (exists (
    select 1 from ranking_runs r where r.id = run_id and r.status = 'published'
  ));

create policy read_lawyer_rankings on lawyer_rankings
  for select using (exists (
    select 1 from ranking_runs r where r.id = run_id and r.status = 'published'
  ));

-- The open-methodology payoff: anyone can inspect the evidence behind a
-- published placement.
create policy read_evidence on ranking_evidence
  for select using (
    exists (
      select 1 from firm_rankings fr
      join ranking_runs r on r.id = fr.run_id
      where fr.id = firm_ranking_id and r.status = 'published'
    )
    or exists (
      select 1 from lawyer_rankings lr
      join ranking_runs r on r.id = lr.run_id
      where lr.id = lawyer_ranking_id and r.status = 'published'
    )
  );

create policy read_sources      on sources              for select using (is_active);
create policy read_observations on ranking_observations for select using (true);
create policy read_cases        on case_records         for select using (true);
create policy read_case_parts   on case_participations  for select using (true);

create policy read_news_sources on news_sources
  for select using (is_enabled);

create policy read_articles on news_articles
  for select using (status = 'published' and published_at <= now());

create policy read_article_entities on news_article_entities
  for select using (exists (
    select 1 from news_articles a
    where a.id = article_id and a.status = 'published'
  ));

-- Submissions: confidential matters are never public, and a firm sees only its
-- own. Note there is no public select policy on submissions at all.
create policy read_own_submissions on submissions
  for select to authenticated
  using (firm_id = public.current_firm_id() or public.has_role(array['admin','editor','analyst']::app_role[]));

create policy read_own_matters on submission_matters
  for select to authenticated
  using (exists (
    select 1 from submissions s
    where s.id = submission_id
      and (s.firm_id = public.current_firm_id()
           or public.has_role(array['admin','editor','analyst']::app_role[]))
  ));

-- Staging is internal, full stop. Only service_role (which bypasses RLS) and
-- explicit staff policies below can see raw article text.
create policy staff_read_ingest on news_ingest
  for select to authenticated
  using (public.has_role(array['admin','editor']::app_role[]));

create policy staff_read_runs on ingest_runs
  for select to authenticated
  using (public.has_role(array['admin','editor']::app_role[]));

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create policy read_own_profile on profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role(array['admin']::app_role[]));

create policy update_own_profile on profiles
  for update to authenticated
  using (id = auth.uid())
  -- Deliberately narrow: a user may edit their name, never their own role.
  -- The comparison goes through a security-definer function rather than a
  -- subquery on profiles, which would recurse into this same policy.
  with check (id = auth.uid() and role = public.current_role());

-- ---------------------------------------------------------------------------
-- Editorial writes
-- ---------------------------------------------------------------------------

create policy editor_write_firms on firms
  for all to authenticated
  using (public.has_role(array['admin','editor']::app_role[]))
  with check (public.has_role(array['admin','editor']::app_role[]));

create policy editor_write_lawyers on lawyers
  for all to authenticated
  using (public.has_role(array['admin','editor']::app_role[]))
  with check (public.has_role(array['admin','editor']::app_role[]));

create policy editor_write_articles on news_articles
  for all to authenticated
  using (public.has_role(array['admin','editor']::app_role[]))
  with check (public.has_role(array['admin','editor']::app_role[]));

create policy analyst_write_runs on ranking_runs
  for all to authenticated
  using (public.has_role(array['admin','analyst']::app_role[]))
  with check (public.has_role(array['admin','analyst']::app_role[]));

create policy analyst_write_firm_rankings on firm_rankings
  for all to authenticated
  using (public.has_role(array['admin','analyst']::app_role[]))
  with check (public.has_role(array['admin','analyst']::app_role[]));

-- A claimed firm may draft its own submissions, and nothing else.
create policy firm_write_submissions on submissions
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id() and status in ('draft','submitted'));

create policy firm_write_matters on submission_matters
  for all to authenticated
  using (exists (
    select 1 from submissions s
    where s.id = submission_id and s.firm_id = public.current_firm_id()
  ))
  with check (exists (
    select 1 from submissions s
    where s.id = submission_id
      and s.firm_id = public.current_firm_id()
      and s.status = 'draft'
  ));

-- Anyone may file a correction; only staff may read or resolve them.
create policy anyone_files_correction on corrections
  for insert to anon, authenticated
  with check (true);

create policy staff_reads_corrections on corrections
  for select to authenticated
  using (public.has_role(array['admin','editor']::app_role[]));

create policy staff_resolves_corrections on corrections
  for update to authenticated
  using (public.has_role(array['admin','editor']::app_role[]))
  with check (public.has_role(array['admin','editor']::app_role[]));

grant execute on function public.ingest_news_item to service_role;
grant execute on function public.promote_news_item to service_role, authenticated;
