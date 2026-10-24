# Amanzi authentication email setup

The app now sends sign-up confirmations to `/create-account` and password recovery links to `/reset-password` on the configured app origin. For local development, auth emails intentionally point to the deployed app so a link opened from another device cannot lead to the developer's localhost.

## Supabase dashboard settings

In **Authentication → URL Configuration**:

- Set **Site URL** to `https://amanzi-sooty.vercel.app`.
- Add `https://amanzi-sooty.vercel.app/**` to **Redirect URLs**.
- Keep `http://localhost:5173/**` as a development redirect if local testing is needed.
- If Amanzi gets a custom domain, add that domain and update `VITE_AUTH_REDIRECT_URL` in Vercel and the email logo URLs in the templates.

In **Authentication → Email Templates**:

- Open **Confirm signup**. Set the subject to `Confirm your Amanzi account` and replace the body with `supabase/templates/confirm-signup.html`.
- Open **Reset Password**. Set the subject to `Reset your Amanzi password` and replace the body with `supabase/templates/reset-password.html`.
- Keep `{{ .ConfirmationURL }}` in each button's `href`. Supabase generates the one-time link and appends the redirect target passed by the app.

The hosted Supabase dashboard does not read these local HTML files automatically; paste each file's contents into its matching email template and save. These templates use Amanzi's public logo at `/brand/amanzi-logo.png`.
