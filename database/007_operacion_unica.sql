begin;
alter table public.advisories add column if not exists operation_id uuid;
create unique index if not exists advisories_advisor_operation_unique on public.advisories(advisor_id,operation_id);
insert into public.schema_migrations(version,description) values ('007','Identificador único de operación') on conflict(version) do nothing;
commit;
