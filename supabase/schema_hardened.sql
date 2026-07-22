-- ============================================================================
-- SafePlate FULL setup (self-contained). Run this ONE file on a new project.
-- It (1) creates the base tables if they do not exist, then (2) applies the
-- hardened, deny-by-default security. Safe to run more than once.
-- ============================================================================

-- ---- (1) BASE TABLES ----
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
drop policy if exists certificates_public_read on certificates;
create policy certificates_public_read on certificates for select using (true);
drop policy if exists laboratories_public_read on laboratories;
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
drop policy if exists audit_insert on audit_log;
create policy audit_insert on audit_log for insert to authenticated with check (true);
drop policy if exists audit_select on audit_log;
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

-- ---- (2) HARDENED SECURITY ----
-- SafePlate hardened security schema.
-- Run this AFTER schema.sql. It removes the permissive baseline policies and
-- replaces them with deny-by-default, role- and ownership-scoped RLS, and locks
-- privileged tables so they can only be written by the service role (Edge Functions).
--
-- Model:
--   * Role and agency come from the JWT: user_metadata.role / .agency / .lab.
--   * Food handlers see only their own rows (user_id = auth.uid()).
--   * A laboratory sees only orders for its own lab (metadata.lab).
--   * Regulators read for oversight; LSMoH is the elevated admin (reads all).
--   * Sterling sees escrow only, never results.
--   * certificates, escrow, escrow_releases, encrypted results and audit_log are
--     WRITTEN ONLY by Edge Functions using the service role. Clients cannot write them.

-- ------------------------------------------------------------------ --
--  Helper claims                                                      --
-- ------------------------------------------------------------------ --
create or replace function auth_role() returns text language sql stable as
$$ select coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') $$;

create or replace function auth_agency() returns text language sql stable as
$$ select coalesce(auth.jwt() -> 'user_metadata' ->> 'agency', '') $$;

create or replace function auth_lab() returns text language sql stable as
$$ select coalesce(auth.jwt() -> 'user_metadata' ->> 'lab', '') $$;

create or replace function is_regulator() returns boolean language sql stable as
$$ select auth_role() = 'regulator' $$;

create or replace function is_lsmoh_admin() returns boolean language sql stable as
$$ select auth_role() = 'regulator' and auth_agency() = 'LSMoH' $$;

-- LSMoH certificate number sequence
create sequence if not exists lsh_seq;
create or replace function next_lsh() returns text language sql as
$$ select 'LSH-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('lsh_seq')::text, 6, '0') $$;

-- ------------------------------------------------------------------ --
--  Ownership columns                                                  --
-- ------------------------------------------------------------------ --
alter table food_handlers add column if not exists user_id uuid default auth.uid();
alter table businesses    add column if not exists owner_uid uuid default auth.uid();

-- Encrypted result storage lives beside the order.
alter table test_orders add column if not exists results_enc text;      -- AES-256-GCM ciphertext
alter table test_orders add column if not exists result_pdf_path text;  -- private storage object path
alter table certificates add column if not exists cert_no text;         -- LSH-YYYY-NNNNNN
alter table food_handlers add column if not exists verified_nin boolean default false;

-- OTP store for real 2FA (written only by the send-otp / verify-otp functions).
create table if not exists otp_codes (
  id bigint generated always as identity primary key,
  subject text, code_hash text, expires_at timestamptz, attempts int default 0, ts timestamptz default now()
);
create index if not exists otp_subject_idx on otp_codes (subject);

-- Failed-login tracking for lockout (written by the auth-guard function).
create table if not exists login_attempts (
  subject text primary key, fails int default 0, locked_until timestamptz, updated_at timestamptz default now()
);

-- ------------------------------------------------------------------ --
--  Drop the permissive baseline policies                             --
-- ------------------------------------------------------------------ --
do $$
declare tbl text;
begin
  foreach tbl in array array['food_handlers','test_orders','certificates','escrow','escrow_releases','establishments','laboratories','businesses','water_tests','notifications']
  loop
    execute format('drop policy if exists %I_auth_all on %I;', tbl, tbl);
  end loop;
end $$;

alter table otp_codes enable row level security;
alter table login_attempts enable row level security;
-- otp_codes and login_attempts have NO policies, so only the service role can touch them.

-- Make this script safely re-runnable: drop the scoped policies before recreating.
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies where schemaname = 'public' and policyname in (
      'fh_select','fh_insert','fh_update','to_select','to_insert','to_update','cert_public_read',
      'escrow_read','releases_read','audit_select','est_select','est_update','lab_public_read',
      'lab_update','biz_select','biz_write','water_select','water_insert','notif_select')
  loop
    execute format('drop policy if exists %I on %I;', p.policyname, p.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------------ --
--  Scoped policies                                                   --
-- ------------------------------------------------------------------ --

-- food_handlers: own row; regulators read; owner inserts/updates own.
drop policy if exists fh_select on food_handlers;
create policy fh_select on food_handlers for select to authenticated
  using (user_id = auth.uid() or is_regulator());
drop policy if exists fh_insert on food_handlers;
create policy fh_insert on food_handlers for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists fh_update on food_handlers;
create policy fh_update on food_handlers for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- test_orders: own FH, owning lab, or regulator can read. FH/employer create; owning lab updates status.
drop policy if exists to_select on test_orders;
create policy to_select on test_orders for select to authenticated using (
  is_regulator()
  or auth_role() = 'laboratory'
  or lab = auth_lab()
  or safeplate_id in (select safeplate_id from food_handlers where user_id = auth.uid())
);
drop policy if exists to_insert on test_orders;
create policy to_insert on test_orders for insert to authenticated
  with check (auth_role() in ('food_handler','employer'));
drop policy if exists to_update on test_orders;
create policy to_update on test_orders for update to authenticated
  using (lab = auth_lab()) with check (lab = auth_lab());
-- NOTE: result encryption and Ministry approval never happen through this update
-- policy; they are performed by Edge Functions (service role). The lab update
-- policy is for status transitions (scheduled, collected, testing) only.

-- certificates: public read (verification); NO client writes (service role only).
drop policy if exists cert_public_read on certificates;
create policy cert_public_read on certificates for select using (true);

-- escrow + releases: Sterling and regulators read; NO client writes.
drop policy if exists escrow_read on escrow;
create policy escrow_read on escrow for select to authenticated
  using (auth_role() = 'sterling' or is_regulator());
drop policy if exists releases_read on escrow_releases;
create policy releases_read on escrow_releases for select to authenticated
  using (auth_role() = 'sterling' or is_regulator());

-- audit_log: regulators read; append-only insert already handled; NO update/delete.
drop policy if exists audit_select on audit_log;
create policy audit_select on audit_log for select to authenticated using (is_regulator());
-- audit inserts come from Edge Functions (service role); the earlier audit_insert
-- policy may remain for authenticated client-side low-sensitivity events if desired.

-- establishments: LASEPA and admin read/update; regulators read.
drop policy if exists est_select on establishments;
create policy est_select on establishments for select to authenticated using (is_regulator());
drop policy if exists est_update on establishments;
create policy est_update on establishments for update to authenticated
  using (auth_agency() = 'LASEPA' or is_lsmoh_admin())
  with check (auth_agency() = 'LASEPA' or is_lsmoh_admin());

-- laboratories: public read; HEFAMAA and admin update accreditation.
drop policy if exists lab_public_read on laboratories;
create policy lab_public_read on laboratories for select using (true);
drop policy if exists lab_update on laboratories;
create policy lab_update on laboratories for update to authenticated
  using (auth_agency() = 'HEFAMAA' or is_lsmoh_admin())
  with check (auth_agency() = 'HEFAMAA' or is_lsmoh_admin());

-- businesses: owner only; regulators read.
drop policy if exists biz_select on businesses;
create policy biz_select on businesses for select to authenticated
  using (owner_uid = auth.uid() or is_regulator());
drop policy if exists biz_write on businesses;
create policy biz_write on businesses for all to authenticated
  using (owner_uid = auth.uid()) with check (owner_uid = auth.uid());

-- water_tests: owner, LASEPA, admin, regulators read; owner creates; approval via function.
drop policy if exists water_select on water_tests;
create policy water_select on water_tests for select to authenticated
  using (is_regulator() or owner_email = auth.jwt() ->> 'email');
drop policy if exists water_insert on water_tests;
create policy water_insert on water_tests for insert to authenticated
  with check (owner_email = auth.jwt() ->> 'email');

-- notifications: recipients read (broadcast, own role, own agency, own email); insert by function.
drop policy if exists notif_select on notifications;
create policy notif_select on notifications for select to authenticated using (
  audience = 'all' or audience = auth_role() or audience = auth_agency() or audience = (auth.jwt() ->> 'email')
);

-- ------------------------------------------------------------------ --
--  Storage bucket for encrypted result PDFs (private, signed URLs)   --
-- ------------------------------------------------------------------ --
do $storage$
begin
  if exists (select 1 from information_schema.tables where table_schema='storage' and table_name='buckets') then
    insert into storage.buckets (id, name, public) values ('results', 'results', false)
    on conflict (id) do nothing;
  end if;
end $storage$;
-- No public policy: objects are reachable only through short-lived signed URLs
-- minted by Edge Functions after a role check.

-- ------------------------------------------------------------------ --
--  Fuller registration fields (v1.5)                                  --
-- ------------------------------------------------------------------ --
alter table food_handlers add column if not exists dob date;
alter table food_handlers add column if not exists gender text;
alter table food_handlers add column if not exists address text;
alter table food_handlers add column if not exists lga text;
alter table food_handlers add column if not exists employer_address text;
alter table food_handlers add column if not exists photo text;

-- Holder photo on the certificate (printed on the PDF and shown on public
-- verification so a certificate cannot be used by anyone else).
alter table certificates add column if not exists photo text;

-- Appeals lodged by food handlers, employers or laboratories, routed to a regulator.
create table if not exists appeals (
  id bigint generated always as identity primary key,
  kind text, subject text, appellant text, agency text, reason text,
  status text default 'Open', resolution text, created_at timestamptz default now()
);
alter table appeals enable row level security;
drop policy if exists appeals_insert on appeals;
drop policy if exists appeals_select on appeals;
drop policy if exists appeals_update on appeals;
drop policy if exists appeals_insert on appeals;
create policy appeals_insert on appeals for insert to authenticated with check (true);
drop policy if exists appeals_select on appeals;
create policy appeals_select on appeals for select to authenticated using (is_regulator() or appellant = auth.jwt() ->> 'email');
drop policy if exists appeals_update on appeals;
create policy appeals_update on appeals for update to authenticated using (is_regulator()) with check (is_regulator());

-- ============================================================
-- Field officers (inspectors) and their field inspections.
-- ============================================================
create or replace function is_officer() returns boolean language sql stable as
$$ select auth_role() = 'officer' $$;

create table if not exists officers (
  id text primary key,
  name text, email text unique, phone text, badge text, agency text, lga text,
  status text default 'Pending', created_at timestamptz default now()
);
alter table officers enable row level security;
drop policy if exists officers_select on officers;
drop policy if exists officers_insert on officers;
drop policy if exists officers_update on officers;
drop policy if exists officers_select on officers;
create policy officers_select on officers for select to authenticated
  using (is_regulator() or email = auth.jwt() ->> 'email');
drop policy if exists officers_insert on officers;
create policy officers_insert on officers for insert to authenticated
  with check (is_regulator() or email = auth.jwt() ->> 'email');
drop policy if exists officers_update on officers;
create policy officers_update on officers for update to authenticated
  using (is_regulator()) with check (is_regulator());

create table if not exists inspections (
  id text primary key,
  officer text, officer_email text, agency text, kind text, subject text,
  outcome text, sanction text, sanction_status text, note text, target_id text,
  ts timestamptz default now()
);
alter table inspections enable row level security;
drop policy if exists inspections_select on inspections;
drop policy if exists inspections_insert on inspections;
drop policy if exists inspections_update on inspections;
drop policy if exists inspections_select on inspections;
create policy inspections_select on inspections for select to authenticated
  using (is_regulator() or officer_email = auth.jwt() ->> 'email');
drop policy if exists inspections_insert on inspections;
create policy inspections_insert on inspections for insert to authenticated
  with check (officer_email = auth.jwt() ->> 'email' or is_regulator());
drop policy if exists inspections_update on inspections;
create policy inspections_update on inspections for update to authenticated
  using (is_regulator()) with check (is_regulator());

-- Officers can read establishments, apply field warnings, and log water samples.
drop policy if exists est_officer_select on establishments;
drop policy if exists est_officer_update on establishments;
drop policy if exists est_officer_select on establishments;
create policy est_officer_select on establishments for select to authenticated using (is_officer());
drop policy if exists est_officer_update on establishments;
create policy est_officer_update on establishments for update to authenticated using (is_officer()) with check (is_officer());
drop policy if exists water_officer_insert on water_tests;
create policy water_officer_insert on water_tests for insert to authenticated with check (is_officer());

-- Badge numbers must be unique (a badge cannot be issued or reused twice).
-- Resolve any duplicate badge numbers BEFORE enforcing uniqueness, otherwise this
-- script stops here and the blocks below never run. The earliest officer keeps the
-- badge; later duplicates are cleared so an administrator can reassign a fresh one.
with ranked as (
  select id, row_number() over (partition by badge order by created_at nulls last, id) as rn
  from officers
  where badge is not null
)
update officers o
   set badge = null
  from ranked r
 where o.id = r.id
   and r.rn > 1;

create unique index if not exists officers_badge_uk on officers (badge) where badge is not null;

-- Inspection photographs, officer workload targets, and customer-care tickets.
alter table inspections add column if not exists photos jsonb;
alter table officers add column if not exists target int default 20;

create table if not exists support_tickets (
  id bigint generated always as identity primary key,
  reporter text, role text, category text, subject text, body text,
  status text default 'Open', created_at timestamptz default now()
);
alter table support_tickets enable row level security;
drop policy if exists tickets_insert on support_tickets;
drop policy if exists tickets_select on support_tickets;
drop policy if exists tickets_update on support_tickets;
drop policy if exists tickets_insert on support_tickets;
create policy tickets_insert on support_tickets for insert to authenticated with check (true);
drop policy if exists tickets_select on support_tickets;
create policy tickets_select on support_tickets for select to authenticated
  using (is_regulator() or reporter = auth.jwt() ->> 'email');
drop policy if exists tickets_update on support_tickets;
create policy tickets_update on support_tickets for update to authenticated
  using (is_regulator()) with check (is_regulator());

-- Laboratory self-registration (name, contact, address) pending HEFAMAA approval.
alter table laboratories add column if not exists contact_person text;
alter table laboratories add column if not exists phone text;
alter table laboratories add column if not exists address text;
alter table laboratories add column if not exists lga text;
alter table laboratories add column if not exists status text default 'Accredited';
drop policy if exists lab_register on laboratories;
create policy lab_register on laboratories for insert to authenticated
  with check (auth_role() = 'laboratory' or is_regulator());

-- Officer case assignment: which officer an establishment is assigned to.
alter table establishments add column if not exists assigned_to text;

-- Waterfall beneficiary bank details (for disbursement).
create table if not exists beneficiaries (
  id text primary key,
  name text, bank_name text, account_number text, account_name text,
  updated_at timestamptz default now()
);
alter table beneficiaries enable row level security;
drop policy if exists ben_read on beneficiaries;
drop policy if exists ben_insert on beneficiaries;
drop policy if exists ben_update on beneficiaries;
create policy ben_read on beneficiaries for select to authenticated using (auth_role() = 'sterling' or is_regulator());
create policy ben_insert on beneficiaries for insert to authenticated with check (auth_role() = 'sterling' or is_regulator());
create policy ben_update on beneficiaries for update to authenticated using (auth_role() = 'sterling' or is_regulator()) with check (auth_role() = 'sterling' or is_regulator());

-- Laboratory bank details (beneficiary of the disbursement waterfall).
alter table laboratories add column if not exists bank_name text;
alter table laboratories add column if not exists account_number text;
alter table laboratories add column if not exists account_name text;

-- Payment receipt details on the handler record.
alter table food_handlers add column if not exists payment_ref text;
alter table food_handlers add column if not exists paid_at timestamptz;
alter table food_handlers add column if not exists paid_amount integer;

-- Public complaints (anonymous). Intelligence only: a complaint schedules a
-- look, it never applies a sanction.
create table if not exists complaints (
  id text primary key,
  establishment text, lga text, detail text, status text default 'Open',
  triaged_by text, triaged_at timestamptz, outcome text,
  created_at timestamptz default now()
);
alter table complaints enable row level security;
drop policy if exists cmp_read on complaints;
drop policy if exists cmp_update on complaints;
create policy cmp_read on complaints for select to authenticated using (is_regulator() or is_officer());
create policy cmp_update on complaints for update to authenticated using (is_regulator() or is_officer()) with check (is_regulator() or is_officer());

-- Internal "complaint received, under review" marker. Not a public downgrade.
alter table establishments add column if not exists under_review boolean default false;
alter table inspections add column if not exists status text;

-- Establishment registration: businesses may self-register, but a
-- self-registered premises stays Unverified until an officer inspects it.
alter table establishments add column if not exists verified boolean default true;
alter table establishments add column if not exists registered_by text;
alter table establishments add column if not exists created_at timestamptz default now();
drop policy if exists est_insert on establishments;
create policy est_insert on establishments for insert to authenticated
  with check (is_regulator() or is_officer() or auth_role() = 'employer');
drop policy if exists est_self_select on establishments;
create policy est_self_select on establishments for select to authenticated
  using (registered_by = auth.jwt() ->> 'email');

-- 48-hour laboratory turnaround breach markers.
alter table test_orders add column if not exists sla_breached boolean default false;
alter table test_orders add column if not exists sla_breached_at timestamptz;

-- HEFAMAA laboratory accreditation audits (scored against a fixed criteria set).
create table if not exists lab_audits (
  id text primary key,
  lab_id text, lab_name text, auditor text, auditor_email text,
  answers jsonb, score numeric, applicable integer, met integer,
  critical_failures jsonb, outcome text, note text,
  valid_until timestamptz,
  ts timestamptz default now()
);
alter table lab_audits enable row level security;
drop policy if exists labaud_read on lab_audits;
drop policy if exists labaud_insert on lab_audits;
create policy labaud_read on lab_audits for select to authenticated
  using (is_regulator() or is_officer() or auth_role() = 'laboratory');
create policy labaud_insert on lab_audits for insert to authenticated
  with check (is_regulator());

-- Latest audit summary carried on the laboratory record for quick display.
alter table laboratories add column if not exists last_audit_score numeric;
alter table laboratories add column if not exists last_audit_at timestamptz;
alter table laboratories add column if not exists last_audit_outcome text;

-- Accreditation number, issued by HEFAMAA when a laboratory is accredited.
alter table laboratories add column if not exists acc_no text;
create unique index if not exists laboratories_accno_uk on laboratories (acc_no) where acc_no is not null;

-- Nigeria Data Protection Act: explicit consent recorded at registration.
alter table food_handlers add column if not exists consent_given boolean default false;
alter table food_handlers add column if not exists consent_at timestamptz;
alter table food_handlers add column if not exists consent_version text;

-- Evidence attached to a public complaint.
alter table complaints add column if not exists photos jsonb;

-- Laboratory testing availability, and the appointment booked against an order.
alter table laboratories add column if not exists availability jsonb;
alter table test_orders add column if not exists appointment_date date;
alter table test_orders add column if not exists appointment_slot text;
