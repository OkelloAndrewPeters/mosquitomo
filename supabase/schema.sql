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

create table if not exists events (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  device_id text,              -- random ID made on the phone; no name, number or account
  event text,                  -- open, view, install, save_place
  detail text,                 -- e.g. which screen
  installed boolean,           -- opened from the home-screen app (true) or the browser (false)
  platform text                -- android / iphone / desktop
);
create index if not exists events_device_time on events (device_id, created_at);

alter table reports  enable row level security;
alter table events   enable row level security;
drop policy if exists "app can add events" on events;
create policy "app can add events" on events for insert to anon with check (true);
alter table feedback enable row level security;
alter table readings enable row level security;

-- Exact permissions for the app's public (anon) key. Works whether or not
-- "Automatically expose new tables" was ticked when the project was created.
grant usage on schema public to anon;
revoke all on reports, feedback, readings, events from anon;
grant insert on reports, feedback, readings, events to anon;
grant select on reports to anon;

-- Anyone with the app can add rows. Reports are public (they show on the map/dashboard);
-- feedback and readings can only be read by you in the Supabase console or the dashboard key.
drop policy if exists "app can add reports" on reports;
create policy "app can add reports" on reports  for insert to anon with check (true);
drop policy if exists "reports are public" on reports;
create policy "reports are public" on reports  for select to anon using (true);
drop policy if exists "app can add feedback" on feedback;
create policy "app can add feedback" on feedback for insert to anon with check (true);
drop policy if exists "app can add readings" on readings;
create policy "app can add readings" on readings for insert to anon with check (true);

-- Photo storage
insert into storage.buckets (id, name, public) values ('report-photos', 'report-photos', true)
  on conflict (id) do nothing;
drop policy if exists "app can upload photos" on storage.objects;
create policy "app can upload photos" on storage.objects for insert to anon
  with check (bucket_id = 'report-photos');

-- Pilot summary for the dashboard (aggregates only, safe to expose).
create or replace view pilot_summary with (security_invoker = false) as
select
  (select count(distinct device_id) from (select device_id from readings union select device_id from events) u) as devices,
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

-- ---------- user tracking views (aggregates only; no device IDs exposed) ----------

-- Daily users, Uganda time: active, new (first ever visit that day) and returning.
create or replace view daily_usage with (security_invoker = false) as
with d as (
  select device_id, (created_at at time zone 'Africa/Kampala')::date as day from events
  union
  select device_id, (created_at at time zone 'Africa/Kampala')::date from readings
),
first_seen as (select device_id, min(day) as first_day from d group by device_id)
select d.day,
       count(distinct d.device_id) as active,
       count(distinct d.device_id) filter (where f.first_day = d.day) as new_users,
       count(distinct d.device_id) filter (where f.first_day < d.day) as returning_users
from d join first_seen f using (device_id)
group by d.day order by d.day;
grant select on daily_usage to anon;

-- Headline user numbers.
create or replace view user_summary with (security_invoker = false) as
with d as (
  select device_id, created_at from events
  union all
  select device_id, created_at from readings
),
per_device as (
  select device_id,
         count(distinct (created_at at time zone 'Africa/Kampala')::date) as days_active,
         max(created_at) as last_seen
  from d group by device_id
)
select
  count(*)                                                   as total_users,
  count(*) filter (where last_seen > now() - interval '1 day')  as active_24h,
  count(*) filter (where last_seen > now() - interval '7 days') as active_7d,
  count(*) filter (where days_active >= 2)                   as returned_users,
  round(100.0 * count(*) filter (where days_active >= 2) / nullif(count(*), 0), 1) as pct_returned,
  (select count(distinct device_id) from events where installed or event = 'install') as installed_users,
  (select count(distinct device_id) from events where platform = 'android') as android_users,
  (select count(distinct device_id) from events where platform = 'iphone')  as iphone_users,
  (select count(*) from events where event = 'open') as app_opens
from per_device;
grant select on user_summary to anon;

-- Which screens people use.
create or replace view screen_usage with (security_invoker = false) as
select detail as screen, count(*) as views, count(distinct device_id) as users
from events where event = 'view' group by detail order by views desc;
grant select on screen_usage to anon;
