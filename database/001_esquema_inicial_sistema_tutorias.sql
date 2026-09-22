-- Sistema de Tutorías
-- Migración 001: esquema inicial PostgreSQL / Supabase
-- Diseñada para ejecutarse desde SQL Editor.

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.schema_migrations (
  version text primary key,
  description text not null,
  applied_at timestamptz not null default now()
);

create table if not exists public.institution_settings (
  id boolean primary key default true check (id),
  school_name text not null default 'NOMBRE DE LA INSTITUCIÓN',
  footer_text text,
  timezone text not null default 'America/Mexico_City',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.periods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date not null,
  ends_on date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint periods_valid_dates check (ends_on >= starts_on)
);

create table if not exists public.careers (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_groups (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique,
  career_id uuid references public.careers(id) on update cascade on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.advisory_reasons (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username citext not null unique,
  full_name text not null,
  password_hash text,
  role text not null default 'advisor',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_role_check check (role in ('advisor', 'admin')),
  constraint app_users_username_not_blank check (btrim(username::text) <> '')
);

comment on column public.app_users.password_hash is
  'Hash seguro de contraseña; nunca se almacena la contraseña original. Puede ser NULL durante la migración del prototipo.';

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  enrollment citext not null unique,
  full_name text not null,
  sex text not null,
  career_id uuid not null references public.careers(id) on update cascade on delete restrict,
  group_id uuid not null references public.student_groups(id) on update cascade on delete restrict,
  shift text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_sex_check check (sex in ('Hombre', 'Mujer')),
  constraint students_shift_check check (shift in ('Matutino', 'Vespertino')),
  constraint students_enrollment_not_blank check (btrim(enrollment::text) <> ''),
  constraint students_name_not_blank check (btrim(full_name) <> '')
);

create table if not exists public.advisories (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on update cascade on delete restrict,
  advisor_id uuid not null references public.app_users(id) on update cascade on delete restrict,
  subject_id uuid not null references public.subjects(id) on update cascade on delete restrict,
  reason_id uuid not null references public.advisory_reasons(id) on update cascade on delete restrict,
  period_id uuid not null references public.periods(id) on update cascade on delete restrict,
  comments text not null default '',
  referred_to_psychopedagogy boolean not null default false,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes integer not null default 0,
  status text not null default 'FINALIZADA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advisories_valid_times check (ended_at >= started_at),
  constraint advisories_duration_nonnegative check (duration_minutes >= 0),
  constraint advisories_status_check check (status in ('EN_CURSO', 'FINALIZADA', 'CANCELADA'))
);

create index if not exists advisories_advisor_started_idx
  on public.advisories (advisor_id, started_at desc);
create index if not exists advisories_student_started_idx
  on public.advisories (student_id, started_at desc);
create index if not exists advisories_period_started_idx
  on public.advisories (period_id, started_at desc);
create index if not exists advisories_subject_idx
  on public.advisories (subject_id);
create index if not exists students_name_idx
  on public.students (full_name);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'institution_settings', 'periods', 'careers', 'student_groups',
    'subjects', 'advisory_reasons', 'app_users', 'students', 'advisories'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

-- El navegador no accede directamente a estas tablas. El servidor/API será
-- el único responsable de validar usuarios y de aplicar permisos por asesor.
alter table public.institution_settings enable row level security;
alter table public.periods enable row level security;
alter table public.careers enable row level security;
alter table public.student_groups enable row level security;
alter table public.subjects enable row level security;
alter table public.advisory_reasons enable row level security;
alter table public.app_users enable row level security;
alter table public.students enable row level security;
alter table public.advisories enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

insert into public.institution_settings (id, school_name)
values (true, 'NOMBRE DE LA INSTITUCIÓN')
on conflict (id) do nothing;

insert into public.periods (name, starts_on, ends_on, active)
values ('Septiembre-Diciembre 2026', date '2026-09-01', date '2026-12-31', true)
on conflict (name) do nothing;

insert into public.careers (code, name)
values
  ('IAEV', 'IAEV'),
  ('ICM', 'ICM'),
  ('IRC', 'IRC'),
  ('ITIID', 'ITIID'),
  ('LTF', 'LTF'),
  ('ISA', 'ISA')
on conflict (code) do nothing;

insert into public.student_groups (name, career_id)
values
  ('IAEV-PA-08', (select id from public.careers where code = 'IAEV')),
  ('IAEV-PA-07', (select id from public.careers where code = 'IAEV')),
  ('ITIID-IA-02', (select id from public.careers where code = 'ITIID')),
  ('ITIID-SM-02', (select id from public.careers where code = 'ITIID')),
  ('ISA-SA-06', (select id from public.careers where code = 'ISA')),
  ('ICM-CYM-03', (select id from public.careers where code = 'ICM')),
  ('IRC-MPR-02', (select id from public.careers where code = 'IRC')),
  ('LTF 08', (select id from public.careers where code = 'LTF')),
  ('SW 28', null)
on conflict (name) do nothing;

insert into public.subjects (name)
values
  ('Matemáticas'),
  ('Física'),
  ('Cálculo'),
  ('Estadística'),
  ('Programación'),
  ('Álgebra')
on conflict (name) do nothing;

insert into public.advisory_reasons (name)
values
  ('Motivos académicos'),
  ('Motivos familiares'),
  ('Motivos personales'),
  ('Motivos sociales')
on conflict (name) do nothing;

insert into public.schema_migrations (version, description)
values ('001', 'Esquema inicial del Sistema de Tutorías')
on conflict (version) do nothing;

commit;

-- Comprobación: debe devolver 9 filas, una por cada tabla funcional.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'institution_settings', 'periods', 'careers', 'student_groups',
    'subjects', 'advisory_reasons', 'app_users', 'students', 'advisories'
  )
order by table_name;
