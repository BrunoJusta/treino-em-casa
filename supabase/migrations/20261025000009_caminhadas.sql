-- Caminhadas: complemento ao treino. Não dão XP nem contam como dia marcado,
-- mas ficam registadas, aparecem no feed e desbloqueiam conquistas próprias.

create table if not exists public.walks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  companions uuid[] not null default '{}',
  date date not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_s int not null check (duration_s between 60 and 86400),
  distance_m int check (distance_m between 0 and 200000),
  route jsonb,
  source text not null check (source in ('manual', 'live')),
  notes text not null default '' check (char_length(notes) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists walks_profile_idx on public.walks (profile_id, date);

create or replace function public.walks_guard() returns trigger
language plpgsql as $$
begin
  -- quem foi tem de ser da família, sem repetir quem registou
  new.companions := array(
    select distinct c from unnest(new.companions) as c
    where c <> new.profile_id and exists (select 1 from public.profiles p where p.id = c and p.active)
  );
  if public.is_system() then return new; end if;
  if tg_op = 'UPDATE' then
    -- depois de registada, só se mudam as notas e quem foi
    new.profile_id := old.profile_id;
    new.date := old.date;
    new.started_at := old.started_at;
    new.ended_at := old.ended_at;
    new.duration_s := old.duration_s;
    new.distance_m := old.distance_m;
    new.route := old.route;
    new.source := old.source;
    new.created_at := old.created_at;
  end if;
  if new.date > public.today_lisbon() then raise exception 'A caminhada não pode ser no futuro.'; end if;
  if new.ended_at < new.started_at then raise exception 'A caminhada acaba antes de começar.'; end if;
  return new;
end $$;
drop trigger if exists walks_guard on public.walks;
create trigger walks_guard before insert or update on public.walks for each row execute function public.walks_guard();

alter table public.walks enable row level security;
drop policy if exists "família lê caminhadas" on public.walks;
drop policy if exists "próprio regista caminhada" on public.walks;
drop policy if exists "próprio muda caminhada" on public.walks;
drop policy if exists "próprio ou admin apaga caminhada" on public.walks;
create policy "família lê caminhadas" on public.walks for select using (public.is_member());
create policy "próprio regista caminhada" on public.walks for insert with check (profile_id = auth.uid() and public.is_member());
create policy "próprio muda caminhada" on public.walks for update using (profile_id = auth.uid());
create policy "próprio ou admin apaga caminhada" on public.walks for delete using (profile_id = auth.uid() or public.is_admin());

do $$ begin
  alter publication supabase_realtime add table public.walks;
exception when duplicate_object then null; end $$;

-- Repor dados também apaga as caminhadas.
create or replace function public.reset_activity(p_include_body boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Só um admin pode repor os dados.'; end if;
  perform set_config('app.system', 'on', true);
  delete from reactions where true;
  delete from excuses where true;
  delete from sessions where true;
  delete from walks where true;
  delete from planned_days where true;
  delete from jar_entries where true;
  delete from month_closures where true;
  delete from audit_log where true;
  if p_include_body then
    delete from body_metrics where true;
    delete from body_profiles where true;
  end if;
  insert into audit_log (actor_id, action, entity, entity_id, detail)
  select auth.uid(), 'month.autofill', 'planned_days', 'autofill:' || id || ':' || to_char(today_lisbon(), 'YYYY-MM'), 'Sem preenchimento automático depois de repor'
  from profiles;
  insert into audit_log (actor_id, action, entity, detail)
  values (auth.uid(), 'reset.activity', 'all', case when p_include_body then 'Dados repostos (incluindo peso e IMC)' else 'Dados repostos' end);
  perform set_config('app.system', '', true);
end $$;
revoke execute on function public.reset_activity(boolean) from public, anon;
grant execute on function public.reset_activity(boolean) to authenticated;
