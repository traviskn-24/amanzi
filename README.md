# Amanzi

Community water updates for Phoenix, Durban. Residents can share what they are experiencing and confirm nearby updates. Community reports are not municipal fault tickets.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
3. Enable anonymous sign-ins in Supabase Auth so residents can post without submitting personal information.
4. Apply `supabase/migrations/20261023095000_amanzi_community_updates.sql` to the Supabase project.
5. Start the app with `npm run dev`.

The publishable key is intended for browser use with Row Level Security enabled. Never put a Supabase secret or service-role key in a `VITE_` variable or commit it to the repository.

Without Supabase settings, the app opens in demo mode with local browser data. That data is not shared between devices.
