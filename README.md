# SafePlate

The Lagos State Unified Food Handler Safety and Compliance Platform. This package covers Stages 1 to 3 of the build plan, plus the public certificate verification portal.

Built as a single-file React app (`src/App.jsx`) on Vite + React + Supabase, deployed to Vercel, exactly like the Qura and Cooperatives builds.

## What works right now

- Stage 1: public landing with the four pillars, the health and economy case, live compliance figures, and a working certificate verifier.
- Stage 2: role entry for Food Handler, Employer, Approved Laboratory, Regulator (LSMoH / LASEPA / HEFAMAA) and Sterling Bank, with Supabase sign-in and a role-aware dashboard. Ministry and Sterling Bank logins are marked for 2FA.
- Stage 3: the food handler journey from registration (with a SAFEPLATE ID) through the mandatory test panel, accredited laboratory choice, and a Paystack payment into escrow, with the full waterfall shown.
- Public verification: anyone can check a certificate by ID, or by scanning its QR. Seeded IDs: `SP-LG-2026004821` (valid), `SP-LG-2025008114` (expired), `SP-LG-2026001990` (revoked).

Later stages (laboratory pipeline, regulator portals, escrow ledger, certificate issuance, water module) sign in and show a role-aware placeholder, and are built next.

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
- Later stages add `test_orders`, `payments`, `audit_log` (append only) and the water-testing tables.

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
