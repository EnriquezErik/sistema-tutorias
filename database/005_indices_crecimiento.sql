-- Sistema de Tutorías · Migración 005
-- Índices no destructivos para reportes, filtros y crecimiento de datos.

begin;

create index if not exists advisories_started_at_idx on public.advisories(started_at desc);
create index if not exists advisories_period_started_idx on public.advisories(period_id,started_at desc);
create index if not exists advisories_advisor_started_idx on public.advisories(advisor_id,started_at desc);
create index if not exists advisories_student_started_idx on public.advisories(student_id,started_at desc);
create index if not exists advisories_subject_idx on public.advisories(subject_id);
create index if not exists advisories_reason_idx on public.advisories(reason_id);
create index if not exists students_name_idx on public.students(lower(full_name));

insert into public.schema_migrations(version,description)
values ('005','Índices de crecimiento y consultas administrativas paginadas')
on conflict (version) do nothing;

commit;
