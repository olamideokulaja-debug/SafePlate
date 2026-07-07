-- SafePlate production schema for Supabase (PostgreSQL).
-- Run this in the Supabase SQL editor after creating your project.
-- Column names are snake_case to match the app's data mapper.
--
-- SECURITY NOTES (read before going to production):
--  * The policies below allow any authenticated user to read and write, so the
--    app works end to end out of the box. Before real launch, tighten every
--    policy to scope rows by role and agency using JWT claims, and move
--    privileged writes (escrow release, audit_log, certificate issuance) behind
--    server-side Edge Functions using the service_role key, never the anon key.
--  * Store laboratory results and result PDFs encrypted (app-layer AES-256 or
--    pgcrypto). The columns below hold references or ciphertext, not plaintext PHI.
--  * audit_log is append-only: UPDATE and DELETE are revoked.

-- ------------------------------------------------------------------ --
--  Tables                                                            --
-- ------------------------------------------------------------------ --

create table if not exists food_handlers (
  safeplate_id text primary key,
  name text, phone text, nin text, email text, employer text,
  lab text, tests jsonb, fee integer, waterfall jsonb,
  paid boolean default false, certificate jsonb,
  created_at timestamptz default now()
);
create index if not exists food_handlers_phone_idx on food_handlers (phone);

create table if not exists test_orders (
  id text primary key,
  safeplate_id text, handler_name text, phone text, lab text,
  tests jsonb, status text, results jsonb,
  technician_id text, accreditation_number text, result_file text,
  reported_lsmoh boolean, biobank_confirm boolean, note text,
  submitted_at timestamptz, created_at timestamptz default now()
);
create index if not exists test_orders_lab_idx on test_orders (lab);
create index if not exists test_orders_status_idx on test_orders (status);

create table if not exists certificates (
  safeplate_id text primary key,
  name text, panel text, lab text,
  issued timestamptz, expiry timestamptz, status text, series text
);
create index if not exists certificates_status_idx on certificates (status);

create table if not exists escrow (
  safeplate_id text primary key,
  name text, lab text, amount integer, type text,
  status text default 'HELD', ts timestamptz default now(),
  released_ts timestamptz, released_by text
);
create index if not exists escrow_status_idx on escrow (status);

create table if not exists escrow_releases (
  id bigint generated always as identity primary key,
  safeplate_id text, name text, lab text, amount integer,
  status text default 'Instructed', approved_by text, ts timestamptz default now()
);
create index if not exists escrow_releases_sid_idx on escrow_releases (safeplate_id);

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  ts timestamptz default now(),
  actor text, role text, action text, subject text, ip text
);
create index if not exists audit_log_ts_idx on audit_log (ts desc);

create table if not exists establishments (
  id text primary key,
  name text, lga text, compliance text, sanction text, appeal text
);

create table if not exists laboratories (
  id text primary key,
  name text, area text, accredited boolean default true, acc_no text
);

create table if not exists businesses (
  owner_email text primary key,
  name text, lga text, staff jsonb default '[]'::jsonb
);

create table if not exists water_tests (
  swid text primary key,
  facility text, lga text, source text, officer text, contact text,
  lab text, amount integer, status text, results jsonb,
  cert_series text, owner_email text, ts timestamptz default now()
);
create index if not exists water_tests_owner_idx on water_tests (owner_email);
create index if not exists water_tests_status_idx on water_tests (status);

create table if not exists notifications (
  id bigint generated always as identity primary key,
  audience text, title text, body text, ts timestamptz default now()
);
create index if not exists notifications_ts_idx on notifications (ts desc);

-- ------------------------------------------------------------------ --
--  Row Level Security                                                --
-- ------------------------------------------------------------------ --

alter table food_handlers  enable row level security;
alter table test_orders    enable row level security;
alter table certificates   enable row level security;
alter table escrow         enable row level security;
alter table escrow_releases enable row level security;
alter table audit_log      enable row level security;
alter table establishments enable row level security;
alter table laboratories   enable row level security;
alter table businesses     enable row level security;
alter table water_tests    enable row level security;
alter table notifications  enable row level security;

-- Public can read certificates (for QR verification) and the accredited lab list.
create policy certificates_public_read on certificates for select using (true);
create policy laboratories_public_read on laboratories for select using (true);

-- Baseline authenticated access. TIGHTEN THESE per role before launch.
do $$
declare tbl text;
begin
  foreach tbl in array array['food_handlers','test_orders','certificates','escrow','escrow_releases','establishments','laboratories','businesses','water_tests','notifications']
  loop
    execute format('create policy %I_auth_all on %I for all to authenticated using (true) with check (true);', tbl, tbl);
  end loop;
end $$;

-- audit_log is append-only: insert and read only, never update or delete.
revoke update, delete on audit_log from anon, authenticated;
create policy audit_insert on audit_log for insert to authenticated with check (true);
create policy audit_select on audit_log for select to authenticated using (true);

-- ------------------------------------------------------------------ --
--  Optional seed for the accredited laboratory directory             --
-- ------------------------------------------------------------------ --
insert into laboratories (id, name, area, accredited, acc_no) values
  ('lancet-ikeja', 'Lancet Ikeja', 'Ikeja', true, 'HEF-LAB-0142'),
  ('synlab-vi', 'Synlab Victoria Island', 'Victoria Island', true, 'HEF-LAB-0088'),
  ('clinix-surulere', 'Clinix Surulere', 'Surulere', true, 'HEF-LAB-0210'),
  ('medbury-yaba', 'Medbury Yaba', 'Yaba', true, 'HEF-LAB-0175'),
  ('zaine-lekki', 'Zaine Diagnostics Lekki', 'Lekki', false, null)
on conflict (id) do nothing;
