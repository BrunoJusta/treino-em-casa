-- Só os dias mínimos da semana (2) são obrigatórios: um dia a mais que já passou sem treino
-- (ex.: o 3.º da semana) pode ser eliminado pela própria pessoa, desde que a semana fique com o mínimo.
-- A multa não muda: conta os treinos feitos na semana, não os dias marcados.

create or replace function public.planned_days_guard() returns trigger
language plpgsql as $$
declare
  closed boolean;
  v_d1 date;
  v_d2 date;
  v_n int;
  v_min int;
  v_req int;
  v_left int;
begin
  if public.is_system() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if public.is_admin() then return old; end if;
    if old.date < public.today_lisbon() then
      -- um dia que já passou sem treino só se elimina se a semana ficar com o mínimo de dias marcados
      if old.status not in ('planned', 'missed') then raise exception 'Este dia já não se pode eliminar.'; end if;
      if exists (select 1 from month_closures where profile_id = old.profile_id and month_key = to_char(old.date, 'YYYY-MM')) then raise exception 'Este mês já fechou.'; end if;
      if exists (select 1 from sessions where profile_id = old.profile_id and date = old.date) then raise exception 'Este dia já tem treino feito.'; end if;
      if exists (select 1 from excuses where planned_day_id = old.id and status <> 'rejected') then raise exception 'Este dia tem uma desculpa.'; end if;
      v_d1 := greatest(date_trunc('week', old.date)::date, date_trunc('month', old.date)::date);
      v_d2 := least(date_trunc('week', old.date)::date + 6, (date_trunc('month', old.date) + interval '1 month' - interval '1 day')::date);
      v_n := v_d2 - v_d1 + 1;
      select min_days_week into v_min from profiles where id = old.profile_id;
      v_req := case when v_n >= 5 then v_min when v_n <= 1 then 0 else least(v_n, ceil(v_min / 2.0)::int) end;
      select count(*) into v_left from planned_days where profile_id = old.profile_id and id <> old.id and date between v_d1 and v_d2;
      if v_left < v_req then raise exception '%', 'Esta semana tem de ficar com ' || v_req || case when v_req = 1 then ' dia marcado' else ' dias marcados' end || '. Só dá para eliminar um dia a mais.'; end if;
      insert into audit_log (actor_id, action, entity, entity_id, detail)
      values (auth.uid(), 'day.delete_past', 'planned_day', old.id::text, 'Dia ' || old.date || ' eliminado (não feito, a mais na semana)');
      return old;
    end if;
    if old.status <> 'planned' then raise exception 'Este dia já não se pode eliminar.'; end if;
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
    if old.date < public.today_lisbon() and not public.is_admin() then
      if date_trunc('week', old.date) < date_trunc('week', public.today_lisbon()) then raise exception 'A semana deste dia já passou: conta como falha.'; end if;
      if date_trunc('week', new.date) <> date_trunc('week', old.date) then raise exception 'Um dia falhado só se recupera na mesma semana.'; end if;
    end if;
    if exists (select 1 from excuses where planned_day_id = old.id and status = 'pending') then raise exception 'Este dia tem uma desculpa por decidir.'; end if;
  end if;
  return new;
end $$;
