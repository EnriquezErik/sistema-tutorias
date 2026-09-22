-- Sistema de Tutorías · Migración 003
-- Bitácora, sesiones y controles de seguridad para la v41.

begin;

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.app_users(id) on update cascade on delete set null,
  username text,
  action text not null,
  entity_type text,
  entity_id text,
  ip_address inet,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log(created_at desc);
create index if not exists audit_log_user_idx on public.audit_log(user_id,created_at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
revoke all on sequence public.audit_log_id_seq from anon, authenticated;

comment on table public.audit_log is
  'Bitácora de acciones relevantes. No debe almacenar contraseñas, claves de recuperación ni comentarios sensibles.';

insert into public.schema_migrations(version,description)
values ('003','Fortalecimiento de seguridad y bitácora administrativa')
on conflict (version) do nothing;

commit;

-- Antes de desplegar la v41, todas las cuentas deben mostrar password_configured=true.
select username,role,active,(password_hash is not null) as password_configured
from public.app_users
order by role,username;
