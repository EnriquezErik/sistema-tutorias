-- EJECUTAR UNA SOLA VEZ EN SUPABASE SQL EDITOR ANTES DE PUBLICAR LA V25.
begin;
alter table public.app_users add column if not exists recovery_code_hash text;
comment on column public.app_users.recovery_code_hash is 'Hash bcrypt de la clave de recuperación. Nunca almacena la clave original.';
insert into public.app_users (username, full_name, password_hash, recovery_code_hash, role, active)
values ('Administrador', 'Administrador del sistema', null, null, 'admin', true)
on conflict (username) do update set role = 'admin', active = true;
insert into public.schema_migrations (version, description)
values ('002', 'Acceso administrativo y recuperación segura')
on conflict (version) do nothing;
commit;
select username, full_name, role, active,
       (password_hash is not null) as password_configured,
       (recovery_code_hash is not null) as recovery_configured
from public.app_users order by role, username;
