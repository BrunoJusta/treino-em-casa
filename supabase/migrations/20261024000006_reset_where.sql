-- Correção: o Supabase bloqueia DELETE sem WHERE nos pedidos da app (extensão safeupdate).
-- Erro visto: "DELETE requires a WHERE clause". Cada DELETE passa a ter "where true".
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
  insert into audit_log (actor_id, action, entity, detail)
  values (auth.uid(), 'reset.activity', 'all', case when p_include_body then 'Dados repostos (incluindo peso e IMC)' else 'Dados repostos' end);
  perform set_config('app.system', '', true);
end $$;
revoke execute on function public.reset_activity(boolean) from public, anon;
grant execute on function public.reset_activity(boolean) to authenticated;
