-- Diagnóstico exclusivamente de lectura. Ejecutar después de verificar que existe el esquema base.
begin read only;
select version, description from public.schema_migrations order by version;
select table_name, column_name, data_type from information_schema.columns
where table_schema='public' and ((table_name='advisories' and column_name in ('student_snapshot','operation_id')) or table_name='advisory_drafts' or (table_name='app_users' and column_name='session_version')) order by table_name,column_name;
select indexname,indexdef from pg_indexes where schemaname='public' and indexname='advisories_advisor_operation_unique';
select period_id,status,count(*) as registros, sum(duration_minutes) as minutos from public.advisories group by period_id,status order by period_id,status;
select count(*) filter(where period_id is null) as sin_periodo,count(*) filter(where duration_minutes<0) as duracion_negativa from public.advisories;
select count(*) as operaciones_duplicadas from (select advisor_id,operation_id from public.advisories where operation_id is not null group by advisor_id,operation_id having count(*)>1) d;
commit;
