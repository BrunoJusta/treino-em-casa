-- Um dia falhado só se recupera na própria semana (segunda a domingo).
-- Depois de a semana acabar conta como falha e já não se muda (o admin pode corrigir).

create or replace function public.planned_days_guard() returns trigger
language plpgsql as $$
declare closed boolean;
begin
  if public.is_system() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.date < public.today_lisbon() and not public.is_admin() then raise exception 'Os dias que já passaram não se eliminam.'; end if;
    if old.status <> 'planned' and not public.is_admin() then raise exception 'Este dia já não se pode eliminar.'; end if;
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
