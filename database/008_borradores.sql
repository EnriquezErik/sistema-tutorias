begin;
create table if not exists public.advisory_drafts (
 advisor_id uuid primary key references public.app_users(id) on delete restrict,
 operation_id uuid not null,
 payload jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.advisory_drafts enable row level security;
revoke all on public.advisory_drafts from anon, authenticated;
insert into public.schema_migrations(version,description) values ('008','Borradores privados de asesoría') on conflict(version) do nothing;
commit;
