begin;
alter table public.advisory_drafts add column if not exists revision integer not null default 0;
alter table public.advisories add column if not exists operation_fingerprint text;
insert into public.schema_migrations(version,description) values ('009','Control de revisión de borradores') on conflict(version) do nothing;
commit;
