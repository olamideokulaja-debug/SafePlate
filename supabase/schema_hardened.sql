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

-- ------------------------------------------------------------------ --
--  Scoped policies                                                   --
-- ------------------------------------------------------------------ --

-- food_handlers: own row; regulators read; owner inserts/updates own.
create policy fh_select on food_handlers for select to authenticated
  using (user_id = auth.uid() or is_regulator());
create policy fh_insert on food_handlers for insert to authenticated
  with check (user_id = auth.uid());
create policy fh_update on food_handlers for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- test_orders: own FH, owning lab, or regulator can read. FH/employer create; owning lab updates status.
create policy to_select on test_orders for select to authenticated using (
  is_regulator()
  or lab = auth_lab()
  or safeplate_id in (select safeplate_id from food_handlers where user_id = auth.uid())
);
create policy to_insert on test_orders for insert to authenticated
  with check (auth_role() in ('food_handler','employer'));
create policy to_update on test_orders for update to authenticated
  using (lab = auth_lab()) with check (lab = auth_lab());
-- NOTE: result encryption and Ministry approval never happen through this update
-- policy; they are performed by Edge Functions (service role). The lab update
-- policy is for status transitions (scheduled, collected, testing) only.

-- certificates: public read (verification); NO client writes (service role only).
create policy cert_public_read on certificates for select using (true);

-- escrow + releases: Sterling and regulators read; NO client writes.
create policy escrow_read on escrow for select to authenticated
  using (auth_role() = 'sterling' or is_regulator());
create policy releases_read on escrow_releases for select to authenticated
  using (auth_role() = 'sterling' or is_regulator());

-- audit_log: regulators read; append-only insert already handled; NO update/delete.
drop policy if exists audit_select on audit_log;
create policy audit_select on audit_log for select to authenticated using (is_regulator());
-- audit inserts come from Edge Functions (service role); the earlier audit_insert
-- policy may remain for authenticated client-side low-sensitivity events if desired.

-- establishments: LASEPA and admin read/update; regulators read.
create policy est_select on establishments for select to authenticated using (is_regulator());
create policy est_update on establishments for update to authenticated
  using (auth_agency() = 'LASEPA' or is_lsmoh_admin())
  with check (auth_agency() = 'LASEPA' or is_lsmoh_admin());

-- laboratories: public read; HEFAMAA and admin update accreditation.
create policy lab_public_read on laboratories for select using (true);
create policy lab_update on laboratories for update to authenticated
  using (auth_agency() = 'HEFAMAA' or is_lsmoh_admin())
  with check (auth_agency() = 'HEFAMAA' or is_lsmoh_admin());

-- businesses: owner only; regulators read.
create policy biz_select on businesses for select to authenticated
  using (owner_uid = auth.uid() or is_regulator());
create policy biz_write on businesses for all to authenticated
  using (owner_uid = auth.uid()) with check (owner_uid = auth.uid());

-- water_tests: owner, LASEPA, admin, regulators read; owner creates; approval via function.
create policy water_select on water_tests for select to authenticated
  using (is_regulator() or owner_email = auth.jwt() ->> 'email');
create policy water_insert on water_tests for insert to authenticated
  with check (owner_email = auth.jwt() ->> 'email');

-- notifications: recipients read (broadcast, own role, own agency, own email); insert by function.
create policy notif_select on notifications for select to authenticated using (
  audience = 'all' or audience = auth_role() or audience = auth_agency() or audience = (auth.jwt() ->> 'email')
);

-- ------------------------------------------------------------------ --
--  Storage bucket for encrypted result PDFs (private, signed URLs)   --
-- ------------------------------------------------------------------ --
insert into storage.buckets (id, name, public) values ('results', 'results', false)
on conflict (id) do nothing;
-- No public policy: objects are reachable only through short-lived signed URLs
-- minted by Edge Functions after a role check.
