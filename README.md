# SafePlate

The Lagos State Unified Food Handler Safety and Compliance Platform. This package covers all nine stages of the build plan, plus the public certificate verification portal.

Built as a single-file React app (`src/App.jsx`) on Vite + React + Supabase, deployed to Vercel, exactly like the Qura and Cooperatives builds. Navigation mirrors the CoopEco pattern: every page is a tab in the top banner, and each tab opens a full page, so there is no long scrolling. The Lagos State coat of arms is the platform mark.

## What works right now

- Stage 1: public landing with the four pillars, the health and economy case, live compliance figures, and a working certificate verifier.
- Stage 2: role entry for Food Handler, Employer, Approved Laboratory, Regulator (LSMoH / LASEPA / HEFAMAA) and Sterling Bank, with Supabase sign-in and a role-aware dashboard. Ministry and Sterling Bank logins are marked for 2FA.
- Stage 3: the food handler journey from registration (with a SAFEPLATE ID) through the mandatory test panel, accredited laboratory choice, and a Paystack payment into escrow, with the full waterfall shown.
- Stage 4: the laboratory portal. Sign in as Approved Laboratory to see that lab's own order queue, move an order through Sample Collected, Testing in Progress and Submitted, upload per-test pass or refer results with technician ID, accreditation number and a result PDF, and handle exceptions (no show, spoiled sample, accreditation-number mismatch quarantine). A refer result reports to LSMoH and routes the sample to the Lagos Biobank for confirmation.
- Stage 5: three separate regulator portals, chosen by agency at sign-in. LSMoH reviews submitted results and approves or flags; an approval issues the certificate (so the public verifier then shows it as valid) and records a signed escrow-release instruction, while a refer result triggers the referral pathway. LASEPA runs the escalating sanctions ladder (warning, fine, temporary closure, loss of operating licence) with an appeals pathway. HEFAMAA grants or suspends laboratory accreditation and records QA audits. Every sensitive action is confirmed by a 2FA code and written to an append-only audit trail that can be exported as a tamper-evident report. A 48-hour review SLA is flagged when exceeded.
- Stage 6: the Sterling Bank escrow ledger. Balance, released-to-date, fund-remitted and pending-release tiles; a full ledger; a Releases tab that executes an approved instruction by disbursing the full 76.5 / 10 / 5 / 5 / 3.5 waterfall atomically (2FA-gated and audited); a Fund tab tracking the oversight remittance; and reconciliation by SAFEPLATE ID. Sterling never sees results or medical data.
- Stage 8: the employer portal and the potable water module. An employer registers their establishment, adds team members, and registers-and-bulk-pays for pending staff in one action, seeing each member's compliance status without any medical detail. The water workstream lets a facility register (with a SAFEPLATE-W ID), choose a LASEPA-accredited lab and pay the ₦65,000 into escrow; LASEPA then reviews the readings against WHO and NAFDAC benchmarks and, on approval, issues a Facility Water Quality Certificate and disburses the 80 / 10 / 5 / 5 waterfall. Water certificates are publicly verifiable by their SAFEPLATE-W ID.
- Stage 9: notifications, fees transparency and analytics. A notifications bell in the top banner shows role-relevant alerts raised by every lifecycle event (new order, results submitted, certificate issued, release instructed, water certified). A public Fees page publishes both fee structures and their full waterfalls. An LSMoH Analytics tab shows live escrow figures alongside the five-year project economics (facility ramp, food and water fees, and cumulative programme revenue of ₦14.9bn).
- Public verification: anyone can check a certificate by ID, or by scanning its QR. Seeded IDs: `SP-LG-2026004821` (valid), `SP-LG-2025008114` (expired), `SP-LG-2026001990` (revoked).

All nine stages are built and the full loops run end to end. Food handler: register and pay, lab submits, LSMoH approves and issues the certificate and instructs release, Sterling releases the waterfall, the public verifier confirms it. Water: facility registers and pays, LASEPA reviews against benchmarks and approves, the water certificate issues and the 80/10/5/5 waterfall disburses, and the certificate verifies publicly. Notifications, fees transparency and analytics are in. Connecting the Supabase and Paystack keys switches the app from preview to live with no code change.

## Preview mode vs connected mode

The app runs immediately with no backend, using a safe in-browser preview store, so you can review the whole flow. When you add the Supabase and Paystack keys below, it switches to the real backend automatically. No code change needed.

## Deploy to Vercel, one step at a time

You do not need to write any code.

1. Create a free account at github.com and at vercel.com if you do not have one.
2. On GitHub, click the plus icon, top right, then "New repository". Name it `safeplate`. Click "Create repository".
3. On the new repository page, click "uploading an existing file". Drag in every file and folder from this project EXCEPT `node_modules`, `dist` and `.vercel` (they are not needed and are rebuilt automatically). Click "Commit changes".
4. Go to vercel.com, click "Add New", then "Project". Choose "Import" next to your `safeplate` repository.
5. Leave the settings as they are (Vercel detects Vite automatically) and click "Deploy". Wait for it to finish. You now have a live link.

## Add the keys, when you are ready to go live

In Vercel, open your project, then Settings, then Environment Variables. Add these, then redeploy (Deployments tab, click the three dots on the latest, "Redeploy").

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, from your Supabase project (Project Settings, API). These are safe to be public.
- `ANTHROPIC_API_KEY`, server only, for the AI Engine. Never shared with the browser.
- `PAYSTACK_SECRET_KEY`, server only, for verifying payments. Never shared with the browser.

## Supabase tables to create (when connecting the backend)

- `food_handlers`: `safeplate_id` (text, primary key), `name`, `phone`, `nin`, `email`, `employer`, `lab`, `tests`, `fee`, `paid`, `created_at`.
- `certificates`: `safeplate_id` (text, primary key), `name`, `panel`, `lab`, `issued`, `expiry`, `status`.
- `test_orders`: `id` (text, primary key), `safeplate_id`, `handler_name`, `phone`, `lab`, `tests`, `status`, `results`, `technician_id`, `accreditation_number`, `created_at`.
- `audit_log`: append only, no UPDATE or DELETE granted. `ts`, `actor`, `role`, `action`, `subject`, `ip`.
- `escrow_releases`: `safeplate_id`, `lab`, `amount`, `status`, `approved_by`, `ts`.
- `establishments`: `id`, `name`, `lga`, `compliance`, `sanction`, `appeal`.
- `laboratories`: `id`, `name`, `area`, `accredited`, `acc_no`.
- `escrow`: `safeplate_id` (primary key), `name`, `lab`, `amount`, `type` (FOOD or WATER), `status` (HELD or RELEASED), `ts`, `released_ts`, `released_by`.
- `businesses`: `owner_email` (primary key), `name`, `lga`, `staff` (json).
- `water_tests`: `swid` (primary key), `facility`, `lga`, `source`, `officer`, `contact`, `lab`, `amount`, `status`, `results` (json), `cert_series`, `owner_email`, `ts`.
- `notifications`: `audience`, `title`, `body`, `ts`.

Keep test result fields encrypted and make `audit_log` append only, as set out in the security section of the build prompt.

## Run locally (optional)

```
npm install
npm run dev
```

Open the local address it prints. To check a production build:

```
npm run build
```

You should see `built` with no errors.


## Going live, step by step

The app runs in preview with no backend. It switches to live automatically as each key is added, no code change.

1. Create a Supabase project at supabase.com. Open the SQL editor and run the contents of `supabase/schema.sql`. This creates every table, enables row level security, makes the audit log append-only, and seeds the accredited laboratory list.
2. In Supabase, open Project Settings then API. Copy the Project URL and the anon public key.
3. Create a Paystack account at paystack.com. From Settings then API Keys, copy your public key and your secret key.
4. Create a Termii account at termii.com. Copy your API key and register a sender ID.
5. In Vercel, open your project then Settings then Environment Variables, and add:
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (frontend, safe to be public)
   - `VITE_PAYSTACK_PUBLIC_KEY` (frontend, safe to be public)
   - `PAYSTACK_SECRET_KEY` (server only)
   - `TERMII_API_KEY` and `TERMII_SENDER_ID` (server only)
   - `ANTHROPIC_API_KEY` (server only, for the AI Engine)
6. Redeploy (Deployments tab, the three dots on the latest, Redeploy).

Once the Supabase keys are present the app reads and writes the real database. Once the Paystack public key is present the real Paystack checkout opens and payments are verified server-side through `/api/paystack-verify`. Once the Termii key is present, `/api/notify` sends real SMS on payment and certificate events.

Before real launch, tighten the row level security policies in `schema.sql` so each role and agency only sees its own rows, and move privileged writes (escrow release, audit log, certificate issuance) behind server-side Edge Functions using the service role key. Keep laboratory results encrypted at rest.

## Languages

The interface ships in English and Yoruba. Use the EN and YO toggle in the top banner to switch. The public entry pages and the food handler journey are translated; other portals fall back to English. To extend a translation, add the Yoruba string to the `STRINGS.yo` dictionary in `src/App.jsx` under the same key already used for English.

## Note on payments and notifications

- Payments use Paystack Inline. In preview a funded payment is simulated so the whole flow can be reviewed. With the public key set, the real card, transfer, USSD and mobile money popup opens.
- Notifications are two layers: an in-app alerts bell for every role, and real SMS via Termii for the person directly affected (payment confirmed, certificate issued). SMS is sent only when the Termii key is configured, and fails silently in preview.


## Interface and privacy (v1.2)

- Refreshed, more dynamic UI: a decluttered top bar with the Lagos crest hard left, a compact action cluster (language, notifications, and an account menu), animated page transitions, count-up hero figures, and hover micro-interactions, kept restrained for an official platform.
- Fees are no longer shown publicly. The fee and its waterfall appear only where a signed-in user is transacting or has oversight (the food handler payment step, the Sterling ledger, and regulator views). The public landing states only that the model is transparent and self-sustaining.
- GDPR and NDPA 2023: a consent banner on first visit, a full privacy notice (controller, lawful basis including explicit consent for health data, retention, and data-subject rights) reachable from the footer and the account menu, and a self-service option to erase local data. Certification decisions remain subject to human review.
