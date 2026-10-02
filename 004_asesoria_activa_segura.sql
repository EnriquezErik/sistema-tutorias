-- Sistema de Tutorías · Migración 004
-- Recuperación segura de una asesoría en curso después de cerrar la página.

begin;

create table if not exists public.active_advisories (
  advisor_id uuid primary key references public.app_users(id) on update cascade on delete cascade,
  started_at timestamptz not null,
  form_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.active_advisories;
create trigger set_updated_at before update on public.active_advisories
for each row execute function public.set_updated_at();

alter table public.active_advisories enable row level security;
revoke all on public.active_advisories from anon, authenticated;

-- Corrige instalaciones que todavía conservan el texto provisional.
update public.institution_settings
set school_name='POLITÉCNICA DE SANTA ROSA'
where id=true and btrim(school_name)='NOMBRE DE LA INSTITUCIÓN';

insert into public.schema_migrations(version,description)
values ('004','Recuperación segura de asesorías activas')
on conflict (version) do nothing;

commit;

select table_name from information_schema.tables
where table_schema='public' and table_name='active_advisories';
