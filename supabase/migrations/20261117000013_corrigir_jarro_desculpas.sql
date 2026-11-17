-- Backoffice: corrigir movimentos do jarro (editar ou apagar) e mudar a decisão de uma desculpa.
-- Tudo passa por funções do servidor, só para admins, e fica no registo.

create or replace function public.update_jar_entry(p_id uuid, p_amount_cents int, p_reason text, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare j jar_entries;
begin
  if not is_admin() then raise exception 'Só um admin mexe no jarro.'; end if;
  select * into j from jar_entries where id = p_id for update;
  if j.id is null then raise exception 'Este movimento já não existe.'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'O valor tem de ser maior que zero.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Escreve o motivo.'; end if;
  if p_status not in ('paid', 'unpaid', 'void') then raise exception 'Estado inválido.'; end if;
  update jar_entries set amount_cents = p_amount_cents, reason = trim(p_reason), status = p_status where id = p_id;
  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), 'jar.edit', 'jar_entry', p_id::text,
          'Corrigido: ' || (j.amount_cents / 100.0) || ' € → ' || (p_amount_cents / 100.0) || ' €'
          || case when j.reason <> trim(p_reason) then ', "' || j.reason || '" → "' || trim(p_reason) || '"' else '' end
          || case when j.status <> p_status then ', ' || j.status || ' → ' || p_status else '' end);
end $$;
grant execute on function public.update_jar_entry(uuid, int, text, text) to authenticated;

create or replace function public.delete_jar_entry(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare j jar_entries;
begin
  if not is_admin() then raise exception 'Só um admin mexe no jarro.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Para apagar é preciso um motivo.'; end if;
  select * into j from jar_entries where id = p_id for update;
  if j.id is null then raise exception 'Este movimento já não existe.'; end if;
  delete from jar_entries where id = p_id;
  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), 'jar.delete', 'jar_entry', p_id::text,
          'Apagado (' || j.kind || ', ' || (j.amount_cents / 100.0) || ' €, "' || j.reason || '"): ' || trim(p_reason));
end $$;
grant execute on function public.delete_jar_entry(uuid, text) to authenticated;

-- Muda uma desculpa já decidida (aprovada ↔ recusada). O dia marcado acompanha:
-- aprovada → dia desculpado; recusada → dia volta a "por fazer" (ou "falhado" se o mês já fechou).
-- As multas de um mês já fechado não são recalculadas: corrigem-se à mão no Jarro.
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
  perform set_config('app.system', '', true);
  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), case when p_approve then 'excuse.change_approve' else 'excuse.change_reject' end, 'excuse', p_id::text,
          'Decisão mudada para ' || case when p_approve then 'aprovada' else 'recusada' end || ' (' || e.date || case when closed then ', mês já fechado' else '' end || ')');
end $$;
grant execute on function public.change_excuse_decision(uuid, boolean) to authenticated;
