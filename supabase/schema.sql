create table if not exists public.user_workspace_data (
    clerk_user_id text primary key,
    data jsonb not null default '{"routineTasks": [], "financeData": [], "financeCategories": [], "appTheme": "dark"}'::jsonb,
    updated_at timestamptz not null default now()
);

alter table public.user_workspace_data enable row level security;

revoke all on table public.user_workspace_data from anon, authenticated;
grant select, insert, update on table public.user_workspace_data to authenticated;
grant all on table public.user_workspace_data to service_role;

drop policy if exists "Clerk users can read their workspace" on public.user_workspace_data;
create policy "Clerk users can read their workspace"
    on public.user_workspace_data
    for select
    to authenticated
    using (clerk_user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "Clerk users can create their workspace" on public.user_workspace_data;
create policy "Clerk users can create their workspace"
    on public.user_workspace_data
    for insert
    to authenticated
    with check (clerk_user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "Clerk users can update their workspace" on public.user_workspace_data;
create policy "Clerk users can update their workspace"
    on public.user_workspace_data
    for update
    to authenticated
    using (clerk_user_id = (select auth.jwt() ->> 'sub'))
    with check (clerk_user_id = (select auth.jwt() ->> 'sub'));