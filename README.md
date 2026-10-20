# Progress Tracker

Progress Tracker is a React/Vite dashboard with an Express API. Clerk provides account sessions, and Supabase Postgres stores each user's routines, finance records, categories, and theme.

## Provider setup

1. Create or select a Clerk application. Configure email/password sign-in and add the local and production web URLs to its allowed origins.
2. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor.
3. Copy [`frontend/.env.example`](frontend/.env.example) to `frontend/.env.local` and set the Clerk publishable key.
4. Copy [`backend/.env.example`](backend/.env.example) to `backend/.env`. Set the Clerk secret key, Supabase URL, and Supabase service-role key. Keep the service-role key server-side; never add it to a `VITE_` variable.
5. Keep `MONGO_URI` configured while legacy Mongo data is being migrated. Existing records are matched by email after Clerk confirms that email. Users create a Clerk account with that same verified email; old password hashes are not imported, and Mongo remains read-only for this migration.
6. Configure the same variables in Render. The `render.yaml` declares them as unsynchronized secrets so they must be entered in the Render dashboard before account and cloud-data features are available.

The API reads and writes Supabase only after verifying a Clerk session. Supabase RLS is enabled and direct `anon`/`authenticated` table access is revoked; the server uses the service-role key. Existing Mongo records are left in place after import.

## Run locally

Install dependencies in both folders, then start the API and frontend in separate terminals:

```powershell
cd backend
npm install
npm start
```

```powershell
cd frontend
npm install
npm run dev
```

Without a Clerk publishable key, the dashboard remains available in local-only mode and account controls explain that sign-in is not configured.