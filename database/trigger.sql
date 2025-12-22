'''Otomatik kayıt triggeri'''
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role_id)
  values (
    new.id,
    new.email,
    (select id from public.roles where name = 'user' limit 1)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();



'''Admin kontrolü (policyler için)'''
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.name = 'admin'
  );
$$;




'''roles: authenticated herkes okuyabilsin'''
alter table public.roles enable row level security;

drop policy if exists "roles_read" on public.roles;
create policy "roles_read"
on public.roles for select
to authenticated
using (true);




'''users: kullanıcı kendi kaydını görsün, admin herkesi'''
alter table public.users enable row level security;

drop policy if exists "users_select" on public.users;
create policy "users_select"
on public.users for select
to authenticated
using (id = auth.uid() or public.is_admin());




'''istasyonlar: herkes okur, admin yazar'''
alter table public.istasyonlar enable row level security;

drop policy if exists "stations_read_all" on public.istasyonlar;
create policy "stations_read_all"
on public.istasyonlar for select
to authenticated
using (true);

drop policy if exists "stations_write_admin" on public.istasyonlar;
create policy "stations_write_admin"
on public.istasyonlar for all
to authenticated
using (public.is_admin())
with check (public.is_admin());




'''araclar: herkes okur, admin yazar'''
alter table public.araclar enable row level security;

drop policy if exists "vehicles_read_all" on public.araclar;
create policy "vehicles_read_all"
on public.araclar for select
to authenticated
using (true);

drop policy if exists "vehicles_write_admin" on public.araclar;
create policy "vehicles_write_admin"
on public.araclar for all
to authenticated
using (public.is_admin())
with check (public.is_admin());




'''senaryolar: seed (created_by null) herkes, kendi senaryosu kullanıcı, hepsi admin'''
alter table public.senaryolar enable row level security;

drop policy if exists "scenarios_select" on public.senaryolar;
create policy "scenarios_select"
on public.senaryolar for select
to authenticated
using (
  created_by is null
  or created_by = auth.uid()
  or public.is_admin()
);

drop policy if exists "scenarios_insert" on public.senaryolar;
create policy "scenarios_insert"
on public.senaryolar for insert
to authenticated
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "scenarios_update" on public.senaryolar;
create policy "scenarios_update"
on public.senaryolar for update
to authenticated
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "scenarios_delete" on public.senaryolar;
create policy "scenarios_delete"
on public.senaryolar for delete
to authenticated
using (created_by = auth.uid() or public.is_admin());




'''senaryo_yukleri: senaryoya erişim varsa yükleri de gör'''
alter table public.senaryo_yukleri enable row level security;

drop policy if exists "scenario_loads_select" on public.senaryo_yukleri;
create policy "scenario_loads_select"
on public.senaryo_yukleri for select
to authenticated
using (
  exists (
    select 1
    from public.senaryolar s
    where s.id = senaryo_id
      and (
        s.created_by is null
        or s.created_by = auth.uid()
        or public.is_admin()
      )
  )
);

drop policy if exists "scenario_loads_write" on public.senaryo_yukleri;
create policy "scenario_loads_write"
on public.senaryo_yukleri for all
to authenticated
using (
  exists (
    select 1
    from public.senaryolar s
    where s.id = senaryo_id
      and (s.created_by = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.senaryolar s
    where s.id = senaryo_id
      and (s.created_by = auth.uid() or public.is_admin())
  )
);
