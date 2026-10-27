## Progress Tracker

The Vite app uses Clerk for sign-in and connects directly to Supabase Postgres with the signed-in Clerk session token. Supabase row-level security (RLS) limits each account to its own workspace. Vercel hosts the frontend; the app does not need a Render API.

## Configure Clerk and Supabase

1. Create or select a Clerk application. Enable email sign-in/sign-up, add your local and Vercel URLs, and activate Clerk's Supabase integration.
2. In Supabase, add Clerk as a third-party auth provider using the Clerk domain. Clerk session tokens must contain the `authenticated` role claim.
3. Run [`../supabase/schema.sql`](../supabase/schema.sql) in the Supabase SQL editor.
4. Copy `.env.example` to `.env.local` and set `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Add the same three variables to Vercel for Preview and Production. Never expose a Supabase secret/service-role key in a `VITE_` variable.

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
