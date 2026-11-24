begin;
alter table public.advisories add column if not exists student_snapshot jsonb;
update public.advisories a set student_snapshot=jsonb_build_object('name',s.full_name,'sex',s.sex,'shift',s.shift,'career',c.code::text,'group',g.name::text)
from public.students s join public.careers c on c.id=s.career_id join public.student_groups g on g.id=s.group_id
where a.student_id=s.id and a.student_snapshot is null;
insert into public.schema_migrations(version,description) values ('006','Historial de datos del alumno') on conflict(version) do nothing;
commit;
