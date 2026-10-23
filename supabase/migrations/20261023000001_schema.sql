-- Treino em Casa: esquema, RLS e regras de proteção.
-- Uma instalação = uma família. Todas as datas de calendário estão no fuso Europe/Lisbon.

create or replace function public.today_lisbon() returns date
language sql stable as $$ select (now() at time zone 'Europe/Lisbon')::date $$;

-- ---------- Tabelas ----------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._-]{2,20}$'),
  display_name text not null,
  avatar text not null default '',
  color text not null default '#39C2EF',
  role text not null default 'member' check (role in ('admin', 'member')),
  min_days_week int not null default 2 check (min_days_week between 1 and 7),
  active boolean not null default true,
  voice_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- Restrições físicas: só a própria pessoa e os admins as veem.
create table public.profile_private (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  restrictions text[] not null default '{}'
);

create table public.equipment (
  id text primary key,
  name text not null,
  category text not null check (category in ('cardio', 'machine', 'free_weight', 'accessory')),
  icon text not null default 'dumbbell',
  details text not null default '',
  location text not null default 'Lá em baixo',
  status text not null default 'ok' check (status in ('ok', 'broken', 'arriving')),
  max_load_kg numeric,
  notes text not null default '',
  photo_url text
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade, -- null = plano da família
  name text not null,
  description text not null default '',
  color text not null default '#39C2EF',
  icon text not null default 'dumbbell',
  items jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table public.planned_days (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  plan_id uuid references public.plans(id) on delete set null,
  status text not null default 'planned' check (status in ('planned', 'done', 'missed', 'excused')),
  auto_filled boolean not null default false,
  moved_from date,
  created_at timestamptz not null default now(),
  unique (profile_id, date)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  plan_id uuid references public.plans(id) on delete set null,
  kind text not null check (kind in ('quick', 'guided')),
  completed_all boolean not null default false,
  minutes int not null check (minutes between 1 and 600),
  photo_path text,
  photo_taken_at timestamptz not null,
  in_feed boolean not null default true,
  planned_day_id uuid references public.planned_days(id) on delete set null,
  sets jsonb not null default '[]',
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (profile_id, date)
);

create table public.excuses (
  id uuid primary key default gen_random_uuid(),
  planned_day_id uuid not null references public.planned_days(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  type text not null check (type in ('sick', 'injury', 'travel', 'other')),
  note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  auto boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.jar_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('penalty', 'payment', 'spend', 'adjust')),
  amount_cents int not null check (amount_cents > 0),
  reason text not null default '',
  related_days date[] not null default '{}',
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'void')),
  month_key text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
-- nunca duas multas para os mesmos dias
create unique index jar_penalty_unique on public.jar_entries (profile_id, related_days) where kind = 'penalty';

create table public.settings (
  id int primary key default 1 check (id = 1),
  penalty_cents int not null default 500,
  consecutive_misses int not null default 2,
  monthly_cap_cents int not null default 1500,
  plan_window_end_day int not null default 5,
  excuse_auto_day int not null default 5,
  goal_name text not null default 'Jantar de Natal',
  goal_cents int not null default 10000,
  family_goal_sessions int not null default 40,
  family_goal_reward text not null default 'Escolher o restaurante do jantar pago pelo jarro'
);
insert into public.settings (id) values (1) on conflict do nothing;

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('palmas', 'fogo', 'musculo')),
  created_at timestamptz not null default now(),
  unique (session_id, profile_id, kind)
);

create table public.month_closures (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  month_key text not null,
  closed_at timestamptz not null default now(),
  misses int not null default 0,
  penalties_cents int not null default 0,
  primary key (profile_id, month_key)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create table public.exercise_edits (
  exercise_id text primary key,
  patch jsonb not null default '{}'
);

create table public.custom_exercises (
  id text primary key,
  data jsonb not null
);

-- Corpo: privado. Nem os admins leem.
create table public.body_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  height_cm numeric,
  goal_kg numeric,
  weekly_reminder boolean not null default false
);

create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  weight_kg numeric not null check (weight_kg between 25 and 300),
  unique (profile_id, date)
);

create index on public.planned_days (profile_id, date);
create index on public.sessions (profile_id, date);
create index on public.excuses (status);

-- ---------- Ajudas ----------

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role = 'admin')
$$;

-- As funções do sistema (fecho do mês, desculpas) ligam esta flag para passar as proteções.
create or replace function public.is_system() returns boolean
language sql stable as $$ select coalesce(current_setting('app.system', true), '') = 'on' or auth.uid() is null $$;

-- ---------- Proteções ----------

create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if public.is_system() or public.is_admin() then return new; end if;
  -- um membro só muda o avatar e a voz
  new.username := old.username;
  new.display_name := old.display_name;
  new.color := old.color;
  new.role := old.role;
  new.min_days_week := old.min_days_week;
  new.active := old.active;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

create or replace function public.planned_days_guard() returns trigger
language plpgsql as $$
declare closed boolean;
begin
  if public.is_system() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.date < public.today_lisbon() and not public.is_admin() then raise exception 'Os dias que já passaram não se tiram.'; end if;
    if old.status <> 'planned' and not public.is_admin() then raise exception 'Este dia já não se pode tirar.'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.date < public.today_lisbon() and not public.is_admin() then raise exception 'Só podes marcar dias de hoje em diante.'; end if;
    new.status := 'planned';
    return new;
  end if;
  -- UPDATE
  new.profile_id := old.profile_id;
  if not public.is_admin() then new.status := old.status; end if;
  select exists (select 1 from month_closures where profile_id = old.profile_id and month_key = to_char(old.date, 'YYYY-MM')) into closed;
  if new.date <> old.date then
    if closed then raise exception 'Este mês já fechou.'; end if;
    if old.status in ('done', 'excused', 'missed') then raise exception 'Este dia já não se pode mudar.'; end if;
    if date_trunc('month', new.date) <> date_trunc('month', old.date) then raise exception 'Os dias não passam para outro mês.'; end if;
    if new.date < public.today_lisbon() then raise exception 'Só podes mudar para hoje ou para a frente.'; end if;
    if exists (select 1 from excuses where planned_day_id = old.id and status = 'pending') then raise exception 'Este dia tem uma desculpa por decidir.'; end if;
  end if;
  return new;
end $$;
create trigger planned_days_guard before insert or update or delete on public.planned_days for each row execute function public.planned_days_guard();

create or replace function public.sessions_guard_insert() returns trigger
language plpgsql as $$
begin
  if public.is_system() then return new; end if;
  -- hoje, ou ontem quando o treino ficou na fila offline
  if new.date not between public.today_lisbon() - 1 and public.today_lisbon() then raise exception 'O treino tem de ser registado no próprio dia.'; end if;
  if new.photo_path is null then raise exception 'Falta a foto do treino.'; end if;
  new.in_feed := true;
  return new;
end $$;
create trigger sessions_guard_insert before insert on public.sessions for each row execute function public.sessions_guard_insert();

-- Depois do registo, um membro só pode tirar a foto do feed (o treino continua a contar).
create or replace function public.sessions_guard_update() returns trigger
language plpgsql as $$
begin
  if public.is_system() or public.is_admin() then return new; end if;
  if new.photo_path is not null and new.photo_path is distinct from old.photo_path then raise exception 'A foto não se troca depois do treino.'; end if;
  new.profile_id := old.profile_id;
  new.date := old.date;
  new.started_at := old.started_at;
  new.ended_at := old.ended_at;
  new.plan_id := old.plan_id;
  new.kind := old.kind;
  new.completed_all := old.completed_all;
  new.minutes := old.minutes;
  new.photo_taken_at := old.photo_taken_at;
  new.planned_day_id := old.planned_day_id;
  new.sets := old.sets;
  new.created_at := old.created_at;
  return new;
end $$;
create trigger sessions_guard_update before update on public.sessions for each row execute function public.sessions_guard_update();

-- Ao registar um treino, liga-o ao dia marcado e marca o dia como feito.
create or replace function public.sessions_link_day() returns trigger
language plpgsql security definer set search_path = public as $$
declare pd uuid;
begin
  perform set_config('app.system', 'on', true);
  select id into pd from planned_days where profile_id = new.profile_id and date = new.date;
  if pd is not null then
    update planned_days set status = 'done' where id = pd;
    update sessions set planned_day_id = pd where id = new.id;
  end if;
  perform set_config('app.system', '', true);
  return null;
end $$;
create trigger sessions_link_day after insert on public.sessions for each row execute function public.sessions_link_day();

-- ---------- RLS ----------

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.equipment enable row level security;
alter table public.plans enable row level security;
alter table public.planned_days enable row level security;
alter table public.sessions enable row level security;
alter table public.excuses enable row level security;
alter table public.jar_entries enable row level security;
alter table public.settings enable row level security;
alter table public.reactions enable row level security;
alter table public.month_closures enable row level security;
alter table public.audit_log enable row level security;
alter table public.exercise_edits enable row level security;
alter table public.custom_exercises enable row level security;
alter table public.body_profiles enable row level security;
alter table public.body_metrics enable row level security;

-- leitura da família
create policy "família lê" on public.profiles for select using (public.is_member());
create policy "família lê" on public.equipment for select using (public.is_member());
create policy "família lê" on public.plans for select using (public.is_member());
create policy "família lê" on public.planned_days for select using (public.is_member());
create policy "família lê" on public.sessions for select using (public.is_member());
create policy "família lê" on public.excuses for select using (public.is_member());
create policy "família lê" on public.jar_entries for select using (public.is_member());
create policy "família lê" on public.settings for select using (public.is_member());
create policy "família lê" on public.reactions for select using (public.is_member());
create policy "família lê" on public.month_closures for select using (public.is_member());
create policy "família lê" on public.exercise_edits for select using (public.is_member());
create policy "família lê" on public.custom_exercises for select using (public.is_member());

-- perfis
create policy "próprio ou admin muda" on public.profiles for update using (id = auth.uid() or public.is_admin());
create policy "próprio ou admin" on public.profile_private for all using (profile_id = auth.uid() or public.is_admin()) with check (profile_id = auth.uid() or public.is_admin());

-- material, exercícios, regras: admin
create policy "admin gere" on public.equipment for all using (public.is_admin()) with check (public.is_admin());
create policy "admin gere" on public.exercise_edits for all using (public.is_admin()) with check (public.is_admin());
create policy "admin gere" on public.custom_exercises for all using (public.is_admin()) with check (public.is_admin());
create policy "admin muda" on public.settings for update using (public.is_admin());

-- planos: os meus, ou os da família se for admin
create policy "dono gere" on public.plans for all
  using ((owner_id = auth.uid()) or (owner_id is null and public.is_admin()))
  with check ((owner_id = auth.uid()) or (owner_id is null and public.is_admin()));

-- dias marcados: os meus (as regras finas estão no trigger)
create policy "próprio ou admin marca" on public.planned_days for insert with check ((profile_id = auth.uid() and public.is_member()) or public.is_admin());
create policy "próprio ou admin muda" on public.planned_days for update using (profile_id = auth.uid() or public.is_admin());
create policy "próprio ou admin tira" on public.planned_days for delete using (profile_id = auth.uid() or public.is_admin());

-- treinos
create policy "próprio regista" on public.sessions for insert with check (profile_id = auth.uid() and public.is_member());
create policy "próprio ou admin muda" on public.sessions for update using (profile_id = auth.uid() or public.is_admin());
create policy "admin apaga" on public.sessions for delete using (public.is_admin());

-- reações
create policy "próprio reage" on public.reactions for insert with check (profile_id = auth.uid() and public.is_member());
create policy "próprio tira" on public.reactions for delete using (profile_id = auth.uid());

-- jarro: só admin escreve (as multas vêm do fecho do mês)
create policy "admin insere" on public.jar_entries for insert with check (public.is_admin());
create policy "admin muda" on public.jar_entries for update using (public.is_admin());

-- registo
create policy "admin lê" on public.audit_log for select using (public.is_admin());
create policy "membro escreve o seu" on public.audit_log for insert with check (actor_id = auth.uid() and public.is_member());

-- corpo: só a própria pessoa
create policy "só eu" on public.body_profiles for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "só eu" on public.body_metrics for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.planned_days, public.sessions, public.excuses, public.jar_entries,
  public.reactions, public.plans, public.profiles, public.settings, public.month_closures, public.equipment;
