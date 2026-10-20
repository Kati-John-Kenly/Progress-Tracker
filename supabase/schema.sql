create table if not exists public.user_workspace_data (
    clerk_user_id text primary key,
    data jsonb not null default '{"routineTasks": [], "financeData": [], "financeCategories": [], "appTheme": "dark"}'::jsonb,
    updated_at timestamptz not null default now()
);

alter table public.user_workspace_data enable row level security;

revoke all on table public.user_workspace_data from anon, authenticated;
grant all on table public.user_workspace_data to service_role;