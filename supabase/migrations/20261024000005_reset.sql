-- Backoffice > Repor: apaga a atividade de toda a família (para testes e demonstrações).
-- Mantém as pessoas, os códigos, o material, os planos, as regras e as edições dos exercícios.
create or replace function public.reset_activity(p_include_body boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Só um admin pode repor os dados.'; end if;
  perform set_config('app.system', 'on', true);
  delete from reactions;
  delete from excuses;
  delete from sessions;
  delete from planned_days;
  delete from jar_entries;
  delete from month_closures;
  delete from audit_log;
  if p_include_body then
    delete from body_metrics;
    delete from body_profiles;
  end if;
  insert into audit_log (actor_id, action, entity, detail)
  values (auth.uid(), 'reset.activity', 'all', case when p_include_body then 'Dados repostos (incluindo peso e IMC)' else 'Dados repostos' end);
  perform set_config('app.system', '', true);
end $$;
revoke execute on function public.reset_activity(boolean) from public, anon;
grant execute on function public.reset_activity(boolean) to authenticated;
