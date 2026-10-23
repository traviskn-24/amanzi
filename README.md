# Amanzi

Community water updates for neighbourhoods across South Africa. Residents choose their neighbourhood or town, municipality or city, and province to find local reports, share water conditions, and talk with neighbours. Amanzi community reports are not municipal fault tickets.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
3. Enable anonymous sign-ins in Supabase Auth so residents can post without submitting personal information.
4. Apply the migrations in `supabase/migrations/` in timestamp order.
5. Add the Geoapify API key as the `GEOAPIFY_API_KEY` secret in Supabase Edge Function secrets. Never place it in `.env.local`, a `VITE_` variable, or client code.
6. Deploy `supabase/functions/location-search` with JWT verification enabled, then start the app with `npm run dev`.

The publishable key is intended for browser use with Row Level Security enabled. Never put a Supabase secret or service-role key in a `VITE_` variable or commit it to the repository.

Without Supabase settings, the app opens in demo mode with local browser data. That data is not shared between devices.

## Judge demo flow

1. Select **Phoenix** and review the live water picture. It summarizes resident reports from the last 24 hours; it is not an official municipal status.
2. Choose **Share an update** and select a water status: no water, low pressure, or water restored. Add a short observation without an exact address.
3. Use the community search above the feed to find a South African neighbourhood or town, then select a result. Amanzi resolves its municipality and province against the Municipal Demarcation Board boundary service.
4. Select **Across South Africa**, choose a different community with the report location search, share a report, then compare the national feed with the local area feed.
5. Open **Join area chat** on a report to switch between the exact area, province, and nationwide community conversations.
6. In another browser, confirm a report or send a chat message to show that the shared feed updates across sessions.

Official municipal notices and service fault submissions are not integrated yet. Community reports are separate from municipal reports.
