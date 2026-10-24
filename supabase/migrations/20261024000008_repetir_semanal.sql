-- A app deixa de marcar dias sozinha. Só repete os dias de semana em semana quando a pessoa o pede
-- (Calendário > O meu > Repetir todas as semanas). O padrão fica no perfil: [{ "wd": 0..6 (0 = segunda), "plan_id": "..." }].
alter table public.profiles add column if not exists repeat_weekly jsonb;

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
begin
  perform set_config('app.system', 'on', true);
  select * into s from settings where id = 1;

  -- 1. desculpas fora de prazo
  with upd as (
    update excuses e set status = 'approved', auto = true, decided_at = now()
    where e.status = 'pending'
      and p_today > (date_trunc('month', e.date) + interval '1 month')::date + (s.excuse_auto_day - 1)
    returning e.id, e.planned_day_id, e.date
  ), pd as (
    update planned_days set status = 'excused' where id in (select planned_day_id from upd) returning id
  )
  insert into audit_log (actor_id, action, entity, entity_id, detail)
  select null, 'excuse.auto_approve', 'excuse', upd.id::text, 'Desculpa de ' || upd.date || ' aceite automaticamente no prazo' from upd;

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
      counter := 0; chain := '{}'; total := 0; misses := 0;
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
        update planned_days set status = 'missed' where id = d.id;
        misses := misses + 1;
        counter := counter + 1;
        chain := chain || d.date;
        if counter >= s.consecutive_misses then
          amount := least(s.penalty_cents, s.monthly_cap_cents - total);
          if amount > 0 then
            insert into jar_entries (profile_id, kind, amount_cents, reason, related_days, status, month_key)
            values (pr.id, 'penalty', amount,
                    'Falhas seguidas nos dias ' || array_to_string(array(select extract(day from x)::int from unnest(chain[array_length(chain, 1) - s.consecutive_misses + 1:]) x), ' e ') || ' de ' || (array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'])[substr(mk, 6, 2)::int],
                    chain[array_length(chain, 1) - s.consecutive_misses + 1:], 'unpaid', mk)
            on conflict do nothing;
            total := total + amount;
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
revoke execute on function public.run_maintenance(date) from public, anon, authenticated;
