-- Regra do jarro por SEMANA (a contar de 2 de novembro de 2026):
-- conta o que se fez, não o que se marcou. Cada semana (segunda a domingo, cortada no mês) pede o mínimo
-- de treinos da pessoa (2; menos nas semanas cortadas). Cada treino em falta custa 2,50 €:
-- 0 treinos = 5 €, 1 treino = 2,50 €, 2 treinos = nada. Uma desculpa aprovada conta como treino.
-- A multa é lançada na segunda-feira seguinte (manutenção de hora a hora), com o teto do mês (20 €).

alter table public.settings add column if not exists weekly_from date not null default '2026-11-02';

-- Teto mensal passa a 20 € por pessoa.
alter table public.settings alter column monthly_cap_cents set default 2000;
update public.settings set monthly_cap_cents = 2000 where id = 1;
insert into public.audit_log (actor_id, action, entity, entity_id, detail)
values (null, 'settings.update', 'settings', null, 'monthly_cap_cents=2000 (teto de 20 € por mês)');

-- Tira as multas "por dia falhado" da migração anterior (regra que durou umas horas).
delete from public.jar_entries
where kind = 'penalty' and created_by is null and month_key >= '2026-11' and status = 'unpaid'
  and array_length(related_days, 1) = 1 and reason like 'Falha no dia %';

-- Lança, ou refaz, a multa de uma semana de uma pessoa. Uma multa já paga não se mexe.
create or replace function public.week_settle(p_profile uuid, p_mk text, p_ws date, p_d1 date, p_d2 date, p_n int, p_first boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  s settings;
  v_min int;
  v_req int;
  v_done int;
  v_exc int;
  v_missing int;
  v_amount int;
  v_already int;
  v_reason text;
  cur jar_entries;
begin
  select * into s from settings where id = 1;
  select min_days_week into v_min from profiles where id = p_profile;
  v_req := case when p_n >= 5 then v_min when p_n <= 1 then 0 else least(p_n, ceil(v_min / 2.0)::int) end;
  select count(distinct date) into v_done from sessions where profile_id = p_profile and date between p_d1 and p_d2;
  select count(distinct e.date) into v_exc from excuses e
  where e.profile_id = p_profile and e.status = 'approved' and e.date between p_d1 and p_d2
    and not exists (select 1 from sessions x where x.profile_id = p_profile and x.date = e.date);
  v_missing := greatest(0, v_req - v_done - v_exc);
  select * into cur from jar_entries where kind = 'penalty' and profile_id = p_profile and related_days = array[p_d1, p_d2];
  if cur.id is not null and cur.status = 'paid' then return; end if;
  select coalesce(sum(amount_cents), 0) into v_already from jar_entries
  where profile_id = p_profile and kind = 'penalty' and month_key = p_mk and status <> 'void' and id is distinct from cur.id;
  v_amount := greatest(0, least(v_missing * s.penalty_cents, s.monthly_cap_cents - v_already));
  v_reason := case when p_d1 = p_d2 then 'Dia ' || extract(day from p_d1)::int
                   else 'Semana de ' || extract(day from p_d1)::int || ' a ' || extract(day from p_d2)::int end
              || ' de ' || (array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'])[substr(p_mk, 6, 2)::int]
              || ': ' || (v_done + v_exc) || ' de ' || v_req || ' treinos (' || v_missing || ' em falta)';
  if cur.id is not null then
    if v_amount > 0 then update jar_entries set amount_cents = v_amount, reason = v_reason, status = 'unpaid' where id = cur.id;
    else update jar_entries set status = 'void', reason = v_reason || ' (anulada: desculpa aprovada)' where id = cur.id;
    end if;
  elsif v_amount > 0 then
    insert into jar_entries (profile_id, kind, amount_cents, reason, related_days, status, month_key)
    values (p_profile, 'penalty', v_amount, v_reason, array[p_d1, p_d2], 'unpaid', p_mk);
  end if;
  if p_first then
    insert into audit_log (actor_id, action, entity, entity_id, detail)
    values (null, 'week.close', 'profile', 'week:' || p_profile || ':' || p_mk || ':' || p_ws,
            v_reason || case when v_amount > 0 then ': ' || (v_amount / 100.0) || ' €' else '' end);
  end if;
end $$;
revoke execute on function public.week_settle(uuid, text, date, date, date, int, boolean) from public, anon, authenticated;

-- Depois de decidir uma desculpa: se a semana desse dia já fechou, refaz a multa.
create or replace function public.recheck_week(p_profile uuid, p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ws date := date_trunc('week', p_date)::date;
  v_mk text := to_char(p_date, 'YYYY-MM');
  v_d1 date := greatest(date_trunc('week', p_date)::date, date_trunc('month', p_date)::date);
  v_d2 date := least(date_trunc('week', p_date)::date + 6, (date_trunc('month', p_date) + interval '1 month' - interval '1 day')::date);
begin
  if (select consecutive_misses from settings where id = 1) > 1 then return; end if;
  if not exists (select 1 from audit_log where entity_id = 'week:' || p_profile || ':' || v_mk || ':' || v_ws) then return; end if;
  perform week_settle(p_profile, v_mk, v_ws, v_d1, v_d2, (v_d2 - v_d1 + 1), false);
end $$;
revoke execute on function public.recheck_week(uuid, date) from public, anon, authenticated;

create or replace function public.decide_excuse(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare e excuses;
begin
  if not is_admin() then raise exception 'Só um admin pode decidir desculpas.'; end if;
  select * into e from excuses where id = p_id for update;
  if e.id is null or e.status <> 'pending' then raise exception 'Esta desculpa já foi decidida.'; end if;
  perform set_config('app.system', 'on', true);
  update excuses set status = case when p_approve then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now() where id = p_id;
  if p_approve then update planned_days set status = 'excused' where id = e.planned_day_id and status <> 'done'; end if;
  perform recheck_week(e.profile_id, e.date);
  perform set_config('app.system', '', true);
  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), case when p_approve then 'excuse.approve' else 'excuse.reject' end, 'excuse', p_id::text,
          case when p_approve then 'Desculpa aprovada' else 'Desculpa recusada' end || ' (' || e.date || case when e.profile_id = auth.uid() then ', a própria' else '' end || ')');
end $$;

create or replace function public.change_excuse_decision(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  e excuses;
  d planned_days;
  closed boolean;
begin
  if not is_admin() then raise exception 'Só um admin pode decidir desculpas.'; end if;
  select * into e from excuses where id = p_id for update;
  if e.id is null then raise exception 'Esta desculpa já não existe.'; end if;
  if e.status = 'pending' then raise exception 'Esta desculpa ainda está por decidir.'; end if;
  if (e.status = 'approved') = p_approve then return; end if;
  if p_approve and exists (select 1 from excuses where planned_day_id = e.planned_day_id and id <> e.id and status <> 'rejected') then
    raise exception 'Este dia já tem outra desculpa.';
  end if;
  select * into d from planned_days where id = e.planned_day_id;
  select exists (select 1 from month_closures where profile_id = e.profile_id and month_key = to_char(e.date, 'YYYY-MM')) into closed;
  perform set_config('app.system', 'on', true);
  update excuses set status = case when p_approve then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now(), auto = false where id = p_id;
  if d.id is not null and d.status <> 'done' then
    update planned_days set status = case when p_approve then 'excused' when closed then 'missed' else 'planned' end where id = d.id;
  end if;
  perform recheck_week(e.profile_id, e.date);
  perform set_config('app.system', '', true);
  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), case when p_approve then 'excuse.change_approve' else 'excuse.change_reject' end, 'excuse', p_id::text,
          'Decisão mudada para ' || case when p_approve then 'aprovada' else 'recusada' end || ' (' || e.date || ')');
end $$;

drop function if exists public.void_day_penalty(uuid, date);
drop function if exists public.unvoid_day_penalty(uuid, date);

-- Repor dados: a regra semanal só volta a contar a partir da semana atual (não cobra semanas antigas sem treinos).
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
  update settings set weekly_from = date_trunc('week', today_lisbon())::date where id = 1;
  insert into audit_log (actor_id, action, entity, entity_id, detail)
  select auth.uid(), 'month.autofill', 'planned_days', 'autofill:' || id || ':' || to_char(today_lisbon(), 'YYYY-MM'), 'Sem preenchimento automático depois de repor'
  from profiles;
  insert into audit_log (actor_id, action, entity, detail)
  values (auth.uid(), 'reset.activity', 'all', case when p_include_body then 'Dados repostos (incluindo peso e IMC)' else 'Dados repostos' end);
  perform set_config('app.system', '', true);
end $$;
revoke execute on function public.reset_activity(boolean) from public, anon;
grant execute on function public.reset_activity(boolean) to authenticated;

create or replace function public.run_maintenance(p_today date default public.today_lisbon())
returns text language plpgsql security definer set search_path = public as $$
declare
  s settings;
  pr profiles;
  mk text;
  d record;
  counter int;
  chain date[];
  total int;
  misses int;
  amount int;
  cur_month date := date_trunc('month', p_today)::date;
  log text := '';
  wk record;
  need int;
  cand record;
  flag text;
  added int;
  ex record;
begin
  perform set_config('app.system', 'on', true);
  select * into s from settings where id = 1;

  -- 1. desculpas fora de prazo (aceites; se o dia já tinha multa por pagar, é anulada)
  for ex in
    select e.* from excuses e
    where e.status = 'pending'
      and p_today > (date_trunc('month', e.date) + interval '1 month')::date + (s.excuse_auto_day - 1)
  loop
    update excuses set status = 'approved', auto = true, decided_at = now() where id = ex.id;
    update planned_days set status = 'excused' where id = ex.planned_day_id and status <> 'done';
    perform recheck_week(ex.profile_id, ex.date);
    insert into audit_log (actor_id, action, entity, entity_id, detail)
    values (null, 'excuse.auto_approve', 'excuse', ex.id::text, 'Desculpa de ' || ex.date || ' aceite automaticamente no prazo');
  end loop;

  -- 1b. fecho das semanas (regra semanal): cada semana pede o mínimo de treinos FEITOS;
  -- cada treino em falta custa penalty_cents. Lança-se uma vez, na segunda-feira seguinte.
  if s.consecutive_misses <= 1 then
    for wk in
      select date_trunc('week', g)::date as ws, to_char(g, 'YYYY-MM') as mk, min(g)::date as d1, max(g)::date as d2, count(*)::int as n
      from generate_series(date_trunc('week', s.weekly_from)::date, date_trunc('week', p_today)::date - 1, interval '1 day') g
      group by 1, 2 order by 1, 2
    loop
      for pr in select * from profiles where active and created_at::date <= wk.d2 loop
        flag := 'week:' || pr.id || ':' || wk.mk || ':' || wk.ws;
        continue when exists (select 1 from audit_log where entity_id = flag);
        continue when exists (select 1 from excuses e where e.profile_id = pr.id and e.status = 'pending' and e.date between wk.d1 and wk.d2);
        perform week_settle(pr.id, wk.mk, wk.ws, wk.d1, wk.d2, wk.n, true);
      end loop;
    end loop;
  end if;

  -- 2. fecho dos meses anteriores
  for pr in select * from profiles loop
    for mk in
      select distinct to_char(pd.date, 'YYYY-MM') from planned_days pd
      where pd.profile_id = pr.id and pd.date < cur_month
        and not exists (select 1 from month_closures c where c.profile_id = pr.id and c.month_key = to_char(pd.date, 'YYYY-MM'))
      order by 1
    loop
      if exists (select 1 from excuses e where e.profile_id = pr.id and e.status = 'pending' and to_char(e.date, 'YYYY-MM') = mk) then
        continue; -- espera pela decisão do admin (ou pelo prazo)
      end if;
      counter := 0; chain := '{}'; misses := 0;
      select coalesce(sum(amount_cents), 0) into total from jar_entries
      where profile_id = pr.id and kind = 'penalty' and month_key = mk and status <> 'void';
      for d in
        select pd.*, exists (select 1 from sessions x where x.profile_id = pr.id and x.date = pd.date) as trained,
               exists (select 1 from excuses e where e.planned_day_id = pd.id and e.status = 'approved') as excused_ok
        from planned_days pd where pd.profile_id = pr.id and to_char(pd.date, 'YYYY-MM') = mk order by pd.date
      loop
        if d.trained or d.status in ('done', 'excused') or d.excused_ok then
          if d.trained then update planned_days set status = 'done' where id = d.id; end if;
          counter := 0; chain := '{}';
          continue;
        end if;
        misses := misses + 1;
        counter := counter + 1;
        chain := chain || d.date;
        if d.status = 'missed' then continue; end if; -- já foi tratado no fecho da semana
        update planned_days set status = 'missed' where id = d.id;
        if s.consecutive_misses > 1 and counter >= s.consecutive_misses then -- na regra semanal as multas são do fecho da semana
          amount := least(s.penalty_cents, s.monthly_cap_cents - total);
          if amount > 0 then
            insert into jar_entries (profile_id, kind, amount_cents, reason, related_days, status, month_key)
            values (pr.id, 'penalty', amount,
                    case when s.consecutive_misses = 1 then 'Falha no dia ' else 'Falhas seguidas nos dias ' end || array_to_string(array(select extract(day from x)::int from unnest(chain[array_length(chain, 1) - s.consecutive_misses + 1:]) x), ' e ') || ' de ' || (array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'])[substr(mk, 6, 2)::int],
                    chain[array_length(chain, 1) - s.consecutive_misses + 1:], 'unpaid', mk)
            on conflict do nothing;
            if found then total := total + amount; end if;
          end if;
        end if;
      end loop;
      insert into month_closures (profile_id, month_key, misses, penalties_cents) values (pr.id, mk, misses, total) on conflict do nothing;
      insert into audit_log (actor_id, action, entity, entity_id, detail) values (null, 'month.close', 'profile', pr.id::text, 'Fecho de ' || mk || ': ' || misses || ' falhas, ' || (total / 100.0) || ' €');
      log := log || pr.username || ':' || mk || ' ';
    end loop;
  end loop;

  -- 3. repetir todas as semanas (só para quem o pediu): preenche cada mês uma vez, a partir de hoje
  mk := to_char(p_today, 'YYYY-MM');
  for pr in select * from profiles where active and repeat_weekly is not null and jsonb_array_length(repeat_weekly) > 0 loop
    flag := 'repeat:' || pr.id || ':' || mk;
    continue when exists (select 1 from audit_log where entity_id = flag);
    added := 0;
    for cand in
      select g::date as day,
             (select e->>'plan_id' from jsonb_array_elements(pr.repeat_weekly) e where (e->>'wd')::int = extract(isodow from g)::int - 1 limit 1) as plan
      from generate_series(greatest(cur_month, p_today), (cur_month + interval '1 month' - interval '1 day')::date, interval '1 day') g
      where exists (select 1 from jsonb_array_elements(pr.repeat_weekly) e where (e->>'wd')::int = extract(isodow from g)::int - 1)
    loop
      insert into planned_days (profile_id, date, plan_id, auto_filled)
      values (pr.id, cand.day, (select id from plans where id::text = cand.plan), true)
      on conflict do nothing;
      added := added + 1;
    end loop;
    insert into audit_log (actor_id, action, entity, entity_id, detail)
    values (null, 'month.repeat', 'planned_days', flag, 'Repetição semanal: ' || added || ' dias marcados');
  end loop;

  perform set_config('app.system', '', true);
  return trim(log);
end $$;

-- Já meteram dinheiro no pote: Paula Almeida e Pedro Carreira, 10 € cada (entrada no jarro).
do $$
declare
  nm text;
  pid uuid;
begin
  foreach nm in array array['Paula Almeida', 'Pedro Carreira'] loop
    select id into pid from profiles where display_name ilike nm;
    if pid is null and (select count(*) from profiles where display_name ilike split_part(nm, ' ', 1) || '%') = 1 then
      -- nome curto no perfil (só o primeiro nome), se não houver dúvidas
      select id into pid from profiles where display_name ilike split_part(nm, ' ', 1) || '%';
    end if;
    insert into jar_entries (profile_id, kind, amount_cents, reason, status)
    values (pid, 'adjust', 1000, nm || ' meteu 10 € no pote', 'paid');
    insert into audit_log (actor_id, action, entity, detail) values (null, 'jar.adjust', 'jar', nm || ' meteu 10 € no pote: 10 €');
  end loop;
end $$;

-- corre já: fecha as semanas de novembro que já acabaram com a regra nova
select public.run_maintenance();
