-- Depois de "Repor", a app não deve voltar a marcar dias sozinha no mês atual.
-- 1. O repor deixa marcado que o preenchimento automático deste mês já foi feito.
-- 2. O preenchimento automático só se aplica a quem já existia no início do mês.

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

  -- 3. preenchimento automático
  if extract(day from p_today) > s.plan_window_end_day then
    mk := to_char(p_today, 'YYYY-MM');
    -- só quem já existia no início do mês (quem entra a meio começa no mês seguinte)
    for pr in select * from profiles where active and created_at < cur_month loop
      flag := 'autofill:' || pr.id || ':' || mk;
      continue when exists (select 1 from audit_log where entity_id = flag);
      added := 0;
      for wk in
        select date_trunc('week', g)::date as ws, count(*) as n, array_agg(g::date order by g) as days
        from generate_series(cur_month, (cur_month + interval '1 month' - interval '1 day')::date, interval '1 day') g
        group by 1 order by 1
      loop
        need := (case when wk.n >= 4 then pr.min_days_week else least(wk.n::int, ceil(pr.min_days_week / 2.0)::int) end)
                - (select count(*) from planned_days where profile_id = pr.id and date = any (wk.days));
        continue when need <= 0;
        for cand in
          select x::date as day
          from unnest(wk.days) x
          where x >= p_today and not exists (select 1 from planned_days where profile_id = pr.id and date = x)
          order by
            -- dias da semana mais usados no mês anterior primeiro
            (select count(*) from planned_days p2 where p2.profile_id = pr.id
               and date_trunc('month', p2.date) = (cur_month - interval '1 month')
               and extract(isodow from p2.date) = extract(isodow from x)) desc,
            array_position(array[1, 4, 3, 6, 2, 5, 7], extract(isodow from x)::int)
          limit need
        loop
          insert into planned_days (profile_id, date, auto_filled) values (pr.id, cand.day, true) on conflict do nothing;
          added := added + 1;
        end loop;
      end loop;
      insert into audit_log (actor_id, action, entity, entity_id, detail)
      values (null, 'month.autofill', 'planned_days', flag, case when added > 0 then 'Preenchidos ' || added || ' dias automaticamente' else 'Mês já estava completo' end);
    end loop;
  end if;

  perform set_config('app.system', '', true);
  return trim(log);
end $$;
revoke execute on function public.run_maintenance(date) from public, anon, authenticated;

create or replace function public.reset_activity(p_include_body boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Só um admin pode repor os dados.'; end if;
  perform set_config('app.system', 'on', true);
  delete from reactions where true;
  delete from excuses where true;
  delete from sessions where true;
  delete from planned_days where true;
  delete from jar_entries where true;
  delete from month_closures where true;
  delete from audit_log where true;
  if p_include_body then
    delete from body_metrics where true;
    delete from body_profiles where true;
  end if;
  -- depois de repor, o mês atual não volta a ser preenchido automaticamente
  insert into audit_log (actor_id, action, entity, entity_id, detail)
  select auth.uid(), 'month.autofill', 'planned_days', 'autofill:' || id || ':' || to_char(today_lisbon(), 'YYYY-MM'), 'Sem preenchimento automático depois de repor'
  from profiles;
  insert into audit_log (actor_id, action, entity, detail)
  values (auth.uid(), 'reset.activity', 'all', case when p_include_body then 'Dados repostos (incluindo peso e IMC)' else 'Dados repostos' end);
  perform set_config('app.system', '', true);
end $$;
revoke execute on function public.reset_activity(boolean) from public, anon;
grant execute on function public.reset_activity(boolean) to authenticated;
