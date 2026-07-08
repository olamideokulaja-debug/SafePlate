# SafePlate Mobile (Expo)

A React Native app that shares the same Supabase backend as the web platform.
Mobile-first surfaces: public certificate verification, food-handler sign in /
register, and a certification-status dashboard.

## Run it on your phone
1. Install Node.js (nodejs.org, the LTS button).
2. In this folder, copy `.env.example` to `.env` and paste your Supabase URL and anon key.
3. `npm install`
4. `npx expo start`
5. Install "Expo Go" on your phone, open it, scan the QR code shown in the terminal.

## Build real installable apps later
- `npm install -g eas-cli`
- `eas build -p android` and `eas build -p ios` (needs a free Expo account).

Payment and the full onboarding wizard currently hand off to the web app; those
are the next mobile build.
