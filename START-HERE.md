# RHSC Realms — How to put it online (very simple steps)

You will use 3 free websites: GitHub (holds the files), Vercel (makes the website),
and Supabase (the memory that saves data). Do them in order. Take your time.

Keep two things open in a notepad as you go, you will need them near the end:
- SUPABASE URL
- SUPABASE KEY

--------------------------------------------------
PART A — Put the files on GitHub
--------------------------------------------------
1. Unzip the file `realms-field.zip` on your computer. You now have a folder called `realms-field`.
2. Go to https://github.com and log in (make a free account if you do not have one).
3. Click the green "New" button to make a new repository.
4. Name it `realms-field`. Leave everything else as is. Click "Create repository".
5. On the next page click the link "uploading an existing file".
6. Open the `realms-field` folder on your computer. Select ALL the files and folders inside it
   (do NOT include the folders named `node_modules`, `dist`, or `.vercel` if you see them).
7. Drag them into the GitHub upload box. Wait for them to finish.
8. Click the green "Commit changes" button. Done with GitHub.

--------------------------------------------------
PART B — Make the memory (Supabase)
--------------------------------------------------
1. Go to https://supabase.com and log in (free account).
2. Click "New project". Give it a name like `realms`. Choose any region near Nigeria (e.g. London/EU).
   Set a database password (write it down somewhere safe). Click "Create new project". Wait 1-2 minutes.
3. On the left, click "SQL Editor". Click "New query".
4. Open the file `realms-setup.sql` (it is inside your folder). Copy ALL of it. Paste it into the box.
   Click "Run". You should see "Success". This builds the tables.
5. On the left click "Project Settings" (the gear), then "API".
6. Copy the "Project URL". Paste it into your notepad next to SUPABASE URL.
7. Copy the "anon public" key (the long one). Paste it into your notepad next to SUPABASE KEY.

(Optional, for photos) On the left click "Storage", click "New bucket", name it exactly `evidence`,
turn ON "Public bucket", click "Create". If you skip this, photos still work, just stored differently.

--------------------------------------------------
PART C — Make the website (Vercel)
--------------------------------------------------
1. Go to https://vercel.com and log in with your GitHub account.
2. Click "Add New..." then "Project".
3. Find `realms-field` in the list and click "Import".
4. Do not change anything. Click "Deploy". Wait 1-2 minutes. You will get a website link. 
   (It will look plain right now because we have not added the keys yet. That is normal.)

--------------------------------------------------
PART D — Give the website the keys
--------------------------------------------------
1. Still in Vercel, open your project. Click "Settings", then "Environment Variables".
2. Add the first one:
   - Name: `VITE_SUPABASE_URL`
   - Value: paste your SUPABASE URL from the notepad
   - Click "Save".
3. Add the second one:
   - Name: `VITE_SUPABASE_ANON_KEY`
   - Value: paste your SUPABASE KEY from the notepad
   - Click "Save".
4. Go to the "Deployments" tab. Click the "..." menu on the latest one and click "Redeploy".
   Wait 1-2 minutes.

--------------------------------------------------
YOU ARE LIVE
--------------------------------------------------
Open your Vercel website link. Click "Staff sign-in", create an account with your email,
type your name, and pick a role.

GO LIVE WITH YOUR FACILITIES: sign in as RHSC HQ. On the Dashboard, if it shows
"No facilities yet", tap "Load live facilities" once. This loads the 207 real facilities
(Alimosho & Ifako-Ijaiye, first visits completed). You only do this once. To reset, use
"Clear all data". You can also bulk-upload realms-live-facilities.csv on the Facilities tab.

To install it on a phone: open the link in the phone browser, then choose "Add to Home Screen".

--------------------------------------------------
LATER (optional) — turn on text / WhatsApp / email sending
--------------------------------------------------
Add these in Vercel Environment Variables the same way as Part D, only the ones you want,
then Redeploy:
- Text (SMS): `TERMII_API_KEY`, `TERMII_SENDER_ID`
- Email: `RESEND_API_KEY`, `NOTIFY_FROM`
- WhatsApp: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
Without these, the "open SMS / WhatsApp / email app" buttons still work by hand.

--------------------------------------------------
LATER (optional) — turn on the AI features
--------------------------------------------------
The app has AI helpers (website assistant, report drafting, data assistant,
photo checks, form consistency, call briefings, smart import, translations).
They stay off until you add a key. In Vercel Environment Variables add:
- `ANTHROPIC_API_KEY`  (your Anthropic API key from console.anthropic.com)
- `AI_MODEL`  (optional, defaults to a sensible Claude model)
Then Redeploy. Until then, each AI button politely says it is not set up yet.

--------------------------------------------------
IF SOMETHING LOOKS WRONG
--------------------------------------------------
- Blank or error page after adding keys: check the URL starts with https:// and the key has
  no extra spaces, then Redeploy.
- To show demo data for a walkthrough: on the Dashboard use "Load sample data".
  On the real site it starts empty on purpose so you add your own facilities.
- The small code near the bottom of a database error box should read `field-2026-07-17d`.
  That confirms the newest version is live.

--------------------------------------------------
CONNECT YOUR DOMAIN (realmsconsulting.com at GoDaddy)
--------------------------------------------------
1. In Vercel, open your project > Settings > Domains.
2. Type realmsconsulting.com and click Add. Accept the "add www and redirect" suggestion.
3. Vercel shows you the exact records to add. Usually:
   - A record:    Name @    Value 76.76.21.21   (use whatever Vercel shows)
   - CNAME record: Name www  Value cname.vercel-dns.com   (use whatever Vercel shows)
4. In a new tab go to GoDaddy > your profile > My Products > find realmsconsulting.com > DNS.
5. DELETE GoDaddy's default Parked "A @" record and any Forwarding, so they don't clash.
6. Add new record: Type A, Name @, Value (the IP Vercel showed). Save.
7. Add new record: Type CNAME, Name www, Value (the value Vercel showed). Save.
8. Go back to Vercel > Domains and wait. It flips from "Invalid" to "Valid" (a few minutes,
   sometimes up to a couple of hours). Vercel adds the padlock (HTTPS) automatically.
Done. realmsconsulting.com now shows your app.
