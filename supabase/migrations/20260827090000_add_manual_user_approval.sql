create schema if not exists private;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from anon;
revoke all on public.user_profiles from authenticated;
grant select, update(status, updated_at) on public.user_profiles to authenticated;
grant select, insert, update, delete on public.user_profiles to service_role;

create unique index if not exists user_profiles_single_admin
on public.user_profiles (role)
where role = 'admin';

create or replace function private.is_approved(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_profiles
    where id = p_user_id and status = 'approved'
  );
$$;

create or replace function private.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_profiles
    where id = p_user_id and status = 'approved' and role = 'admin'
  );
$$;

revoke all on function private.is_approved(uuid) from public, anon;
revoke all on function private.is_admin(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_approved(uuid) to authenticated;
grant execute on function private.is_admin(uuid) to authenticated;

create policy user_profiles_select
on public.user_profiles for select
to authenticated
using (id = (select auth.uid()) or (select private.is_admin((select auth.uid()))));

create policy user_profiles_admin_update
on public.user_profiles for update
to authenticated
using ((select private.is_admin((select auth.uid()))))
with check ((select private.is_admin((select auth.uid()))));

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, email, role, status)
  values (new.id, coalesce(new.email, ''), 'user', 'pending')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_mdv_profile on auth.users;
create trigger on_auth_user_created_mdv_profile
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.user_profiles (id, email, role, status, created_at)
select id, coalesce(email, ''), 'user', 'pending', created_at
from auth.users
on conflict (id) do nothing;

do $$
begin
  if (select count(*) from auth.users where lower(email) = 'mat-almeida@hotmail.com') <> 1 then
    raise exception 'A conta administradora mat-almeida@hotmail.com não foi encontrada ou não é única';
  end if;

  update public.user_profiles
  set role = 'user', status = 'pending', updated_at = now()
  where lower(email) <> 'mat-almeida@hotmail.com';

  update public.user_profiles
  set role = 'admin', status = 'approved', updated_at = now()
  where lower(email) = 'mat-almeida@hotmail.com';
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clientes', 'fornecedores', 'produtos', 'orcamentos',
    'orcamento_revisoes', 'orcamento_itens', 'vendas', 'venda_itens'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_auth_all', table_name);
    execute format(
      'create policy mdv_approved_all on public.%I for all to authenticated using ((select private.is_approved((select auth.uid())))) with check ((select private.is_approved((select auth.uid()))))',
      table_name
    );
  end loop;
end;
$$;
