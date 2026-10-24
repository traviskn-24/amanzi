# Amanzi

**Community water updates for South African neighbourhoods.** Amanzi helps residents share what is happening with local water service, see whether neighbours are affected, and find a practical next step.

[Open Amanzi](https://amanzi-sooty.vercel.app) · [View the source code](https://github.com/traviskn-24/amanzi)

## Why Amanzi

During an outage, people often have the same questions: Is water off nearby? Has anyone else reported it? Where can I report a fault? Information may be scattered across chats and social media, and official updates can be hard to find.

Amanzi gives neighbours one place to share local observations and follow reports. It is a community information tool: **resident reports are not official municipal notices or confirmation of a municipal fault.**

## What you can do

- Browse recent water reports for a saved area or across South Africa.
- Share a **No water**, **Low pressure**, or **Water restored** update.
- Confirm a neighbour’s report to help others understand whether it is affecting the area.
- Join area chats to exchange local information.
- Save up to three areas and choose which important area alerts to receive on a device.
- Prepare a water fault message with the relevant details, then review and send it through your chosen email, phone, or messaging app.
- Install Amanzi on a supported device as a progressive web app.

## Using the app

1. Open [Amanzi](https://amanzi-sooty.vercel.app), create an account, and confirm your email.
2. Set up an authenticator app for two-step verification before posting or confirming reports.
3. Choose or search for the neighbourhood you want to follow.
4. Browse reports, share an update, confirm a report you can verify, or join the area chat.
5. In **My areas**, save places you care about and optionally enable alerts for those places on your device.

Push alerts are sent for a water report only after two other neighbours confirm it. Chat messages do not trigger push alerts. Notification support depends on the browser and device; some Android devices without Google services may need a browser environment that supports Web Push.

## Community information and limitations

- Reports are submitted by residents and can be incomplete or mistaken. Check the report time and confirmations, and use official sources for urgent or safety-critical decisions.
- Amanzi does not currently have a live municipal notice feed. Official notices are labelled and linked to their source when available.
- The fault-report tool prepares a message for you to review and send. It does not submit a fault directly to a municipality or track a municipal service request.
- Area search uses Geoapify; map and location data may come from OpenStreetMap contributors.

## Technology

- **Frontend:** React, Vite, JavaScript, CSS
- **Accounts and data:** Supabase Auth, Postgres, Row Level Security, Realtime
- **Server-side features:** Supabase Edge Functions for location search and push delivery
- **Location search:** Geoapify and OpenStreetMap data
- **Notifications and installation:** Web Push, service workers, VAPID, web app manifest
- **Hosting:** Vercel

## Run locally

### Requirements

- Node.js and npm
- A Supabase project for shared accounts and data

### Setup

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/traviskn-24/amanzi.git
   cd amanzi
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the Supabase project URL, publishable key, and the appropriate auth redirect URL.

3. Apply the SQL migrations in `supabase/migrations/` to your Supabase project in timestamp order.

4. In Supabase Auth, enable email confirmation and configure the app’s allowed redirect URLs. Account writes require two-step verification.

5. Deploy the `location-search` Edge Function and set its `GEOAPIFY_API_KEY` secret in Supabase. Keep this key server-side; never put it in a `VITE_` variable.

6. To enable push alerts, deploy `manage-push-subscriptions` and `dispatch-water-alert`, then set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` as Supabase Edge Function secrets. The app requests the public key from the Edge Function; never commit or expose the private key.

7. Start the development server:

   ```bash
   npm run dev
   ```

Without Supabase environment settings, Amanzi opens in demo mode with local browser data. Demo data is not shared across devices.

## Build and deploy

Create a production build locally with:

```bash
npm run build
```

The Vercel project builds the Vite app from the repository. Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_AUTH_REDIRECT_URL` in the Vercel project’s environment settings. Apply database migrations and deploy Edge Functions separately through Supabase; deploying the frontend does not deploy database or Edge Function changes.

## Security notes

- The browser uses a Supabase publishable key with Row Level Security. Never use a service-role key in frontend code or a `VITE_` variable.
- Usernames and community chat messages are checked in the app and again by database triggers.
- Password content rules are checked before the password is submitted to Supabase Auth. Supabase Auth does not expose plaintext passwords to database triggers, and Amanzi does not store passwords for moderation.
- Keep API keys, VAPID private keys, service-role keys, and other secrets out of source control and chat.

## Project status

Amanzi is an evolving community project. Community water reports, area chat, saved areas, account security, location search, and opt-in push alerts are implemented. A live municipal notice feed and direct municipal fault submission are not currently integrated.
