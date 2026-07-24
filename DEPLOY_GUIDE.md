# Realms Field — Stages 1 and 2

The public Realms website for REALMS Healthcare Services Consulting Limited, plus staff sign-in and the role-aware workspace. A Vite + React + Supabase project, built as a single-file `src/App.jsx`, ready to deploy to Vercel.

## What is in this build
- **Tabbed public site.** The top bar has a tab for each page (Home, Process, Services, About, Contact) so each page stands alone with limited scrolling.
- **Staff sign-in (Stage 2).** Sign in or create an account, then choose your role from five cards: Team Leader, Field Monitor, RHSC HQ, HEFAMAA Reviewer, Facility Proprietor.
- **Per-user identity.** Each signed-in person is greeted by name and role. You can map specific emails to a name and title in the `IDENTITY` object in `src/App.jsx`.
- **Role-aware dashboard.** Each role sees its own set of tools, tagged with the stage in which they unlock.
- Brand-locked to Lora and RHSC purple on white, using your real logo from `public/`.

## Demo mode vs real accounts
The app runs in **demo mode** until you add Supabase keys. In demo mode, any email signs in (no password needed) and the role is saved in the browser, so you can preview the whole flow immediately. Once you add the two keys below, it switches automatically to **real Supabase accounts**.

## Two things to complete before publishing
1. **Coverage figures.** In `src/App.jsx`, find `EDIT: replace each value with a verified figure` and replace each dash on the Home tab.
2. **Contact details.** In `src/App.jsx`, find `EDIT: add real contact details` on the Contact tab.

## Set up Supabase (for real accounts)
1. Create a free project at supabase.com.
2. In the project, open **Project Settings → API** and copy the Project URL and the anon public key.
3. In Vercel, open your project's **Settings → Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
4. In Supabase, open the **SQL Editor** and run this once to create the store for roles:

```sql
create table if not exists kv (
  user_id uuid references auth.users(id) on delete cascade,
  k text not null,
  v jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, k)
);
alter table kv enable row level security;
create policy "own rows" on kv
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

5. Optional: in **Authentication → Providers → Email**, turn email confirmation on or off to suit your rollout.
6. Redeploy on Vercel so the new environment variables take effect.

## Run it on your computer (optional)
1. Install Node.js 18 or newer from nodejs.org.
2. Open a terminal in this folder.
3. Type `npm install`, then `npm run dev`, and open the address it prints.

## Put it online with Vercel
1. Create free accounts at github.com and vercel.com.
2. On GitHub, create a new repository named `realms-field`.
3. Upload every file and folder from this project **including the `public` folder**, but not `node_modules`, `dist` or `.vercel`.
4. On Vercel, **Add New… → Project**, import the repository, leave the detected Vite settings, and **Deploy**.
5. Add the two environment variables above when you are ready for real accounts, then redeploy.

## Next stage
Stage 3 (Map) adds facility-list ingestion, area clustering and route planning onto the Field Monitor and Team Leader dashboards.

## Troubleshooting a blank page
A blank page almost always means a bad Supabase value. This build now falls back to demo mode instead of blanking, so if the site loads but shows the small "Demo mode" note on the sign-in screen, your keys did not take. Check in Vercel:
- `VITE_SUPABASE_URL` begins with `https://` and ends in `.supabase.co`, with no quotes or spaces.
- `VITE_SUPABASE_ANON_KEY` is the long anon public key, pasted whole with no line breaks.
- Both are set for the Production environment, then redeploy so the new values are built in.
To see the exact issue, open the site, press F12, and read the Console tab. A line starting with "Realms:" will name the problem.

## Stage 3 (Map) setup
Stage 3 adds Facilities, a Map & Route view and Team Leader assignment. In demo mode these save in the browser. For real accounts, run this once in the Supabase SQL Editor (paste from `create` to the last `);`, without the code fences):

```sql
create table if not exists facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  area text,
  address text,
  lat double precision,
  lng double precision,
  last_visit date,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table facilities enable row level security;
create policy "auth read facilities" on facilities for select using (auth.uid() is not null);
create policy "auth write facilities" on facilities for insert with check (auth.uid() is not null);
create policy "auth update facilities" on facilities for update using (auth.uid() is not null);
create policy "auth delete facilities" on facilities for delete using (auth.uid() is not null);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  visit_date date,
  area text,
  facility_ids jsonb,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table assignments enable row level security;
create policy "auth all assignments" on assignments for all using (auth.uid() is not null) with check (auth.uid() is not null);
```

### Importing facilities by CSV
Use a header row with any of these columns (only `name` is required): `name, category, area` (or `lga`), `address, lat, lng, last_visit`. If a row has `lat` and `lng`, it appears on the map straight away. Rows without coordinates can be placed later with the Locate button, which looks the address up on OpenStreetMap.

### Maps and directions
The map uses OpenStreetMap, so it needs no API key. Build route orders the stops for the shortest hop-to-hop path, and Open in Google Maps hands the ordered stops to the Google Maps app for turn-by-turn on the day. If you later want in-app Google directions, that is a small addition and will need a Google Maps key.

## Stage 4 (Engage) setup
Stage 4 adds the arrival check-in, saved as a visit. In demo mode visits save in the browser. For real accounts, run this once in the Supabase SQL Editor:

```sql
create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  facility_id text,
  facility_name text,
  area text,
  status text default 'engaged',
  arrival_time timestamptz,
  lat double precision,
  lng double precision,
  team jsonb,
  person_in_charge jsonb,
  greeting_confirmed boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table visits enable row level security;
create policy "auth all visits" on visits for all using (auth.uid() is not null) with check (auth.uid() is not null);
```

The Engage tab appears for Field Monitor and Team Leader. It walks four steps: choose the facility, confirm arrival and capture location, present the monitoring letter and team ID cards with the introduction script, then record the person in charge and confirm the greeting. Location capture uses the browser and needs the site on https, which Vercel provides. The assessment checklist that follows arrives in Stage 5.

## Stage 5 (Monitor) setup
Stage 5 adds the six-category HEFAMAA checklist onto a visit, with red/amber/green scoring and evidence capture. In demo mode this saves in the browser. For real accounts, add three columns to the existing visits table (run once in the Supabase SQL Editor):

```sql
alter table visits add column if not exists monitoring jsonb;
alter table visits add column if not exists score int;
alter table visits add column if not exists overall_rating text;
```

### How it works
Open Monitor, choose a checked-in visit, and rate each item Green, Amber or Red. The category and overall compliance scores update live. Per item you can add a photo, a document scan, or a voice note, and each piece of evidence is stamped with the time and, if allowed, the location. Photos and scans are shrunk in the browser before saving to keep them small. Your work autosaves to the device as you go, so a lost connection will not lose it: an Online or Offline badge shows the state, and if a save cannot reach Supabase it is kept locally and marked Pending sync, with a Sync now button to retry.

Two notes. Camera, microphone and location need the site on https, which Vercel provides. Evidence is stored inline for now, which is fine for routine volumes; if you later capture a great deal of media per visit, moving evidence to Supabase Storage is the clean next step.

## Stage 6 (Debrief) setup
Stage 6 closes out a visit: strengths and gaps, corrective actions, a remediation timeline, the proprietor e-signature, and the monitoring report and corrective letter. In demo mode this saves in the browser. For real accounts, add one column to the visits table (run once in the Supabase SQL Editor):

```sql
alter table visits add column if not exists debrief jsonb;
```

### How it works
Open Debrief and choose an assessed visit. The strengths (green items) and gaps (amber and red items) are pulled straight from the Monitor ratings. Enter a required action and timeline for each gap, set a remediation deadline and re-inspection window, and record the person in charge with their acknowledgement and signature, drawn on the device. Save debrief stores everything and moves the visit to debriefed, with the same offline and Sync now safety as Monitor. Monitoring report and Corrective letter open a formatted document in a new tab; use the browser's Print or Save as PDF. Signing and drawing need the site on https, which Vercel provides. Reports are drafts for human review before they are issued.

## Stage 7 (Reports & notifications) and Stage 8 (Analytics)
These two stages read the data already stored, so there are no new tables to create.

### Reports (Stage 7)
The Reports tab (RHSC HQ, Team Leader, HEFAMAA Reviewer) lists every visit with filters for area and status. For each visit you can open the Monitoring report or Corrective letter, or open Notify. A Re-inspections due panel lists debriefed visits by their remediation deadline, flagging overdue and near-due ones. Export CSV downloads the filtered list.

Notifications work without a backend: Email report and HQ alert open your mail app with the summary prefilled, and SMS proprietor opens your phone's messaging app to the proprietor's number. To send SMS and email automatically instead, connect a provider (for example Termii or Africa's Talking for SMS, and a transactional email service) behind a small serverless function; the buttons can then post to it. That is an optional integration and needs provider keys.

### Analytics (Stage 8)
The Analytics tab (RHSC HQ, Team Leader, HEFAMAA Reviewer) shows headline figures (facilities, areas covered, visits, assessed, average score, green rate), a visits-by-area bar chart, a compliance-outcomes breakdown, and a geographic map where every facility is coloured by its most recent visit outcome, green, amber, red, or grey for not yet assessed. Everything is computed live from your facilities and visits.

## Optional: automated notifications and evidence storage
These are optional upgrades. The app runs fully without them; they improve real-account deployments.

### Automated SMS and email (serverless function)
A function at `api/notify.js` sends SMS via Termii and email via Resend. Set these environment variables in Vercel (add only the ones you want; missing ones make the app fall back to opening your device's mail or SMS app):
- SMS: `TERMII_API_KEY`, and optionally `TERMII_SENDER_ID` (defaults to RHSC).
- Email: `RESEND_API_KEY`, and `NOTIFY_FROM` (a sender address verified with Resend).

Redeploy after adding them. In Reports, open Notify on a visit: Send SMS uses the proprietor's phone; enter an address and Send email to email the summary. The open-app links remain as a manual fallback. You can swap Termii or Resend for another provider by editing the two fetch calls in `api/notify.js`.

### Evidence in Supabase Storage
By default, photos, scans and voice notes are stored inline with the visit, which is fine for routine volumes. To store heavier media as files instead, create a Storage bucket named `evidence` in Supabase and make it public (Storage, New bucket, name it evidence, tick Public). The app then uploads each piece of evidence and stores its URL; if the bucket is missing or upload fails, it quietly falls back to inline storage, so nothing breaks. For tighter access you can keep the bucket private and switch the app to signed URLs later.

## This build adds
- Installable app (PWA): on a phone, open the site and choose "Add to Home Screen". It then launches full-screen and caches the shell for offline use.
- Proprietor view: the Facility Proprietor role now has a "My Facility" tab with read-only outcomes, corrective actions and re-inspection timelines. (In production, scope this to the proprietor's own facility.)
- WhatsApp notifications: add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (e.g. `whatsapp:+14155238886`) in Vercel to enable automated WhatsApp from the Reports Notify panel. Without them, the "open WhatsApp" link still works.
- Exports: Reports now export CSV, Excel and a PDF summary.
- Google Sheet import: on Facilities, "Google Sheet" imports from a view-shared sheet link. "HEFAMAA sync" is ready to wire once you share the Agency's API endpoint.
- Field evidence rules: photo required on red items, a voice note per rated category, and GPS mandatory at check-in.
