-- A multa passa a ser lançada no fecho da SEMANA (segunda-feira, na manutenção de hora a hora),
-- e não só no fecho do mês. Vale quando cada falha conta sozinha (consecutive_misses = 1).
-- O fecho do mês continua a existir: marca os dias, não repete multas e regista o resumo.
-- Uma desculpa aprovada depois de a multa ser lançada anula a multa (se ainda estiver por pagar).

-- Anula a multa por pagar de um dia (quando a desculpa desse dia é aprovada).
create or replace function public.void_day_penalty(p_profile uuid, p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  update jar_entries set status = 'void', reason = reason || ' (anulada: desculpa aprovada)'
  where kind = 'penalty' and profile_id = p_profile and related_days = array[p_date] and status = 'unpaid';
end $$;
revoke execute on function public.void_day_penalty(uuid, date) from public, anon, authenticated;

-- Volta a pôr a multa de um dia que foi anulada por desculpa (quando a desculpa passa a recusada):
-- apaga a anulada para o fecho da semana a lançar de novo.
create or replace function public.unvoid_day_penalty(p_profile uuid, p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from jar_entries
  where kind = 'penalty' and profile_id = p_profile and related_days = array[p_date] and status = 'void'
    and reason like '%(anulada: desculpa aprovada)';
end $$;
revoke execute on function public.unvoid_day_penalty(uuid, date) from public, anon, authenticated;

-- Pedir desculpa: também para dias que já passaram a falha nesta altura do mês (antes de o mês fechar).
create or replace function public.create_excuse(p_planned_day uuid, p_type text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare d planned_days;
begin
  select * into d from planned_days where id = p_planned_day;
  if d.id is null or d.profile_id <> auth.uid() then raise exception 'Dia não encontrado.'; end if;
  if d.date > today_lisbon() then raise exception 'Só se pede desculpa para hoje ou para dias que já passaram.'; end if;
  if d.status not in ('planned', 'missed') or exists (select 1 from sessions where profile_id = d.profile_id and date = d.date) then raise exception 'Este dia já não precisa de desculpa.'; end if;
  if exists (select 1 from month_closures where profile_id = d.profile_id and month_key = to_char(d.date, 'YYYY-MM')) then raise exception 'Este mês já fechou.'; end if;
  if exists (select 1 from excuses where planned_day_id = d.id and status <> 'rejected') then raise exception 'Já há uma desculpa para este dia.'; end if;
  insert into excuses (planned_day_id, profile_id, date, type, note) values (d.id, d.profile_id, d.date, p_type, coalesce(p_note, ''));
  insert into audit_log (actor_id, action, entity, entity_id, detail) values (auth.uid(), 'excuse.create', 'planned_day', d.id::text, 'Desculpa para ' || d.date);
end $$;

create or replace function public.decide_excuse(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare e excuses;
begin
  if not is_admin() then raise exception 'Só um admin pode decidir desculpas.'; end if;
  select * into e from excuses where id = p_id for update;
  if e.id is null or e.status <> 'pending' then raise exception 'Esta desculpa já foi decidida.'; end if;
  perform set_config('app.system', 'on', true);
  update excuses set status = case when p_approve then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now() where id = p_id;
  if p_approve then
    update planned_days set status = 'excused' where id = e.planned_day_id and status <> 'done';
    perform void_day_penalty(e.profile_id, e.date);
  end if;
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
    -- recusada num mês aberto: o dia volta a "por fazer" e, se a semana já passou, o fecho da semana lança a multa
    update planned_days set status = case when p_approve then 'excused' when closed then 'missed' else 'planned' end where id = d.id;
  end if;
  if p_approve then perform void_day_penalty(e.profile_id, e.date);
  elsif not closed then perform unvoid_day_penalty(e.profile_id, e.date);
  end if;
  perform set_config('app.system', '', true);
  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), case when p_approve then 'excuse.change_approve' else 'excuse.change_reject' end, 'excuse', p_id::text,
          'Decisão mudada para ' || case when p_approve then 'aprovada' else 'recusada' end || ' (' || e.date || case when closed then ', mês já fechado' else '' end || ')');
end $$;

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
    perform void_day_penalty(ex.profile_id, ex.date);
    insert into audit_log (actor_id, action, entity, entity_id, detail)
    values (null, 'excuse.auto_approve', 'excuse', ex.id::text, 'Desculpa de ' || ex.date || ' aceite automaticamente no prazo');
  end loop;

  -- 1b. fecho das semanas que já acabaram (só quando cada falha conta sozinha):
  -- um dia marcado de uma semana anterior, sem treino e sem desculpa, passa a falha e a multa é lançada logo.
  if s.consecutive_misses <= 1 then
    for d in
      select pd.* from planned_days pd
      where pd.status = 'planned' and pd.date < date_trunc('week', p_today)::date
        and not exists (select 1 from month_closures c where c.profile_id = pd.profile_id and c.month_key = to_char(pd.date, 'YYYY-MM'))
        and not exists (select 1 from sessions x where x.profile_id = pd.profile_id and x.date = pd.date)
        and not exists (select 1 from excuses e where e.planned_day_id = pd.id and e.status in ('pending', 'approved'))
      order by pd.date
    loop
      update planned_days set status = 'missed' where id = d.id;
      mk := to_char(d.date, 'YYYY-MM');
      select coalesce(sum(amount_cents), 0) into total from jar_entries
      where profile_id = d.profile_id and kind = 'penalty' and month_key = mk and status <> 'void';
      amount := least(s.penalty_cents, s.monthly_cap_cents - total);
      if amount > 0 then
        insert into jar_entries (profile_id, kind, amount_cents, reason, related_days, status, month_key)
        values (d.profile_id, 'penalty', amount,
                'Falha no dia ' || extract(day from d.date)::int || ' de ' || (array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'])[extract(month from d.date)::int],
                array[d.date], 'unpaid', mk)
        on conflict do nothing;
      end if;
      insert into audit_log (actor_id, action, entity, entity_id, detail)
      values (null, 'week.close', 'planned_day', d.id::text,
              'Falha no dia ' || d.date || case when amount > 0 then ': ' || (amount / 100.0) || ' €' else ' (teto do mês atingido)' end);
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
        if counter >= s.consecutive_misses then
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

-- corre já, para lançar as multas das semanas que já acabaram
select public.run_maintenance();
