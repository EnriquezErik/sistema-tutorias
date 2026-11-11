-- Sistema de Tutorías · Migración 004
-- Controles acumulativos y no destructivos para la versión 1.7.5.

begin;

alter table public.app_users
  add column if not exists session_version integer not null default 1;

create table if not exists public.login_attempts (
  rate_key text primary key,
  attempts integer not null default 0 check (attempts >= 0),
  first_attempt_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='app_users_username_length') then alter table public.app_users add constraint app_users_username_length check (char_length(btrim(username::text)) between 1 and 80) not valid; end if;
  if not exists(select 1 from pg_constraint where conname='app_users_full_name_length') then alter table public.app_users add constraint app_users_full_name_length check (char_length(btrim(full_name)) between 1 and 160) not valid; end if;
  if not exists(select 1 from pg_constraint where conname='students_enrollment_length') then alter table public.students add constraint students_enrollment_length check (char_length(btrim(enrollment::text)) between 1 and 40) not valid; end if;
  if not exists(select 1 from pg_constraint where conname='students_full_name_length') then alter table public.students add constraint students_full_name_length check (char_length(btrim(full_name)) between 1 and 160) not valid; end if;
  if not exists(select 1 from pg_constraint where conname='careers_code_length') then alter table public.careers add constraint careers_code_length check (char_length(btrim(code::text)) between 1 and 30) not valid; end if;
  if not exists(select 1 from pg_constraint where conname='careers_name_length') then alter table public.careers add constraint careers_name_length check (char_length(btrim(name)) between 1 and 160) not valid; end if;
  if not exists(select 1 from pg_constraint where conname='student_groups_name_length') then alter table public.student_groups add constraint student_groups_name_length check (char_length(btrim(name::text)) between 1 and 80) not valid; end if;
  if not exists(select 1 from pg_constraint where conname='subjects_name_length') then alter table public.subjects add constraint subjects_name_length check (char_length(btrim(name::text)) between 1 and 160) not valid; end if;
  if not exists(select 1 from pg_constraint where conname='advisory_reasons_name_length') then alter table public.advisory_reasons add constraint advisory_reasons_name_length check (char_length(btrim(name::text)) between 1 and 160) not valid; end if;
  if not exists(select 1 from pg_constraint where conname='advisories_comments_length') then alter table public.advisories add constraint advisories_comments_length check (char_length(comments) <= 2000) not valid; end if;
  if not exists(select 1 from pg_constraint where conname='advisories_duration_consistent') then alter table public.advisories add constraint advisories_duration_consistent check (duration_minutes = greatest(0, round(extract(epoch from (ended_at - started_at)) / 60.0)::integer)) not valid; end if;
end $$;

insert into public.schema_migrations(version,description)
values ('004','Integridad, sesiones revocables y control persistente de acceso')
on conflict (version) do nothing;

commit;

-- Esta migración no elimina ni reescribe registros existentes.
-- Las restricciones NOT VALID protegen altas y cambios nuevos sin bloquear datos históricos.
