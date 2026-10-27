## Progress Tracker

The Vite app uses Clerk for sign-in. When Supabase is configured, it syncs workspace data directly to Supabase Postgres with the signed-in Clerk session token; Supabase row-level security (RLS) limits each account to its own workspace. Without Supabase configuration, sign-in still works and workspace data stays on the device. Vercel hosts the frontend; the app does not need a Render API.

## Configure Clerk and Supabase

1. Create or select a Clerk application. Enable email sign-in/sign-up, add your local and Vercel URLs, and activate Clerk's Supabase integration.
2. In Supabase, add Clerk as a third-party auth provider using the Clerk domain. Clerk session tokens must contain the `authenticated` role claim.
3. Run [`../supabase/schema.sql`](../supabase/schema.sql) in the Supabase SQL editor.
4. Set `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local`; this public key is required for sign-in and sign-up.
5. To enable cloud workspace sync, also set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. If either is missing, authentication remains available but cloud sync is disabled and the app reports that data is saved on this device.
6. Add the Clerk key to Vercel for Preview and Production, and add the two Supabase variables there when enabling cloud sync. Never expose a Supabase secret/service-role key in a `VITE_` variable.

### Enable Google sign-in and sign-up

Google is a Clerk social connection; Clerk remains the authentication provider, so its normal session and the existing Supabase sync continue to apply. In the Clerk Dashboard, select the app instance and open **SSO connections**:

1. Select **Add connection → For all users → Google**.
2. For a development instance, Clerk's shared Google OAuth credentials are preconfigured; save the connection.
3. For a production instance, enable **Enable for sign-up and sign-in** and **Use custom credentials**. Copy the **Authorized Redirect URI** Clerk displays.
4. In Google Cloud Console, select or create a project, open **APIs & Services → Credentials → Create Credentials → OAuth client ID**, and use **Web application**. Configure the authorized JavaScript origins with the deployed app origin (and `http://localhost:PORT` for local testing); paste Clerk's URI into **Authorized Redirect URIs**. If prompted, configure the OAuth consent screen first.
5. Create the client, then enter its client ID and client secret in the corresponding fields in Clerk's Google connection and select **Save**. Keep the secret in Clerk only; never put it in frontend environment variables or source code.

Once enabled, Clerk's existing sign-in and sign-up components display Google alongside email/password; no frontend provider credentials or account migration are needed. During sign-up, the optional name, mobile, age, and gender fields are user-entered and stored only in that browser. Google does not supply or verify those values.

See Clerk's [Google social connection guide](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google) for dashboard screenshots and current provider-specific requirements.

## Import legacy Mongo data (optional)

Mongo is no longer used at runtime. To import existing users' routines and finances, create Clerk accounts using the same verified emails as the Mongo accounts. Set `MONGO_URI`, `CLERK_SECRET_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`, then run from the repository root:

```powershell
cd backend
npm install
npm run migrate:users
```

The local script imports only users with a matching verified Clerk email. It skips users who already have a Supabase workspace, so rerunning it will not overwrite newer records. Password hashes are not migrated. The service-role key is used only by the local migration script.

## Run locally

```powershell
cd frontend
npm install
npm run dev
```

Without Clerk and Supabase public configuration, the dashboard remains available in local-only mode and indicates that account/cloud sync is not configured.
