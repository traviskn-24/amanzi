# Amanzi

Community water updates for Phoenix, Durban. Residents can share what they are experiencing and confirm nearby updates. Community reports are not municipal fault tickets.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
3. Enable anonymous sign-ins in Supabase Auth so residents can post without submitting personal information.
4. Apply the migrations in `supabase/migrations/` in timestamp order.
5. Start the app with `npm run dev`.

The publishable key is intended for browser use with Row Level Security enabled. Never put a Supabase secret or service-role key in a `VITE_` variable or commit it to the repository.

Without Supabase settings, the app opens in demo mode with local browser data. That data is not shared between devices.

## Judge demo flow

1. Select **Phoenix** and review the live water picture. It summarizes resident reports from the last 24 hours; it is not an official municipal status.
2. Choose **Share an update** and select a water status: no water, low pressure, or water restored. Add a short observation without an exact address.
3. Select **Across Durban**, open the update form, choose a neighbourhood, and share another status report.
4. Open **Join area chat** on a report to see the Phoenix or Greater Durban neighbour conversation.
5. In another browser, confirm a report or send a chat message to show that the shared feed updates across sessions.

Official municipal notices and service fault submissions are not integrated yet. Community reports are separate from municipal reports.
