-- MosquitoMo pilot backend. Paste into Supabase → SQL Editor → Run.

create table if not exists reports (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  device_id text,
  kind text not null,          -- puddle, drain, brick_pit, construction, containers, other
  note text,
  lat double precision,
  lon double precision,
  accuracy_m real,
  place_name text,
  photo_url text,
  status text default 'reported'  -- reported, verified, cleared
);

create table if not exists feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  device_id text,
  understood smallint,         -- 1–5
  advice_clear smallint,       -- 1–5
  would_act text[],            -- actions the person says they will take
  useful smallint,             -- 1–5
  recommend smallint,          -- 0–10
  district text,
  role text,
  phone text,                  -- android / iphone / other
  comment text,
  level_seen text,
  score_seen smallint
);

create table if not exists readings (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  device_id text,
  lat real, lon real,          -- rounded to 0.01°
  score smallint,
  level text,
  source text                  -- gps / search / place / map
);

alter table reports  enable row level security;
alter table feedback enable row level security;
alter table readings enable row level security;

-- Anyone with the app can add rows. Reports are public (they show on the map/dashboard);
-- feedback and readings can only be read by you in the Supabase console or the dashboard key.
create policy "app can add reports"   on reports  for insert to anon with check (true);
create policy "reports are public"     on reports  for select to anon using (true);
create policy "app can add feedback"  on feedback for insert to anon with check (true);
create policy "app can add readings"  on readings for insert to anon with check (true);

-- Photo storage
insert into storage.buckets (id, name, public) values ('report-photos', 'report-photos', true)
  on conflict (id) do nothing;
create policy "app can upload photos" on storage.objects for insert to anon
  with check (bucket_id = 'report-photos');

-- Pilot summary for the dashboard (aggregates only, safe to expose).
create or replace view pilot_summary with (security_invoker = false) as
select
  (select count(distinct device_id) from readings)  as devices,
  (select count(*) from readings)                   as readings,
  (select count(*) from reports)                    as reports,
  (select count(*) from feedback)                   as feedback_count,
  (select round(avg(understood)::numeric, 2) from feedback)   as avg_understood,
  (select round(avg(advice_clear)::numeric, 2) from feedback) as avg_advice_clear,
  (select round(avg(useful)::numeric, 2) from feedback)       as avg_useful,
  (select round(100.0 * count(*) filter (where cardinality(would_act) > 0 and not ('nothing' = any(would_act))) / nullif(count(*),0), 1) from feedback) as pct_will_act,
  (select round(100.0 * (count(*) filter (where recommend >= 9) - count(*) filter (where recommend <= 6)) / nullif(count(*),0), 1) from feedback) as nps;
grant select on pilot_summary to anon;

-- Readings grouped by ~1 km area for the dashboard map (no device IDs exposed).
create or replace view pilot_readings with (security_invoker = false) as
select lat, lon, count(*) as n,
       (array_agg(score order by created_at desc))[1] as score,
       (array_agg(level order by created_at desc))[1] as level
from readings group by lat, lon;
grant select on pilot_readings to anon;
