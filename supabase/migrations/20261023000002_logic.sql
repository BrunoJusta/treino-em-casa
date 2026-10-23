-- Treino em Casa: funções do jarro, desculpas, manutenção e Storage.
-- A lógica do fecho do mês espelha src/lib/rules/jar.ts (testada com Vitest).

-- ---------- Ecrã de entrada ----------
-- Lista só o que o ecrã "Quem vai treinar?" precisa, antes de haver sessão.
create or replace function public.list_login_profiles()
returns table (id uuid, username text, display_name text, avatar text, color text)
language sql stable security definer set search_path = public as $$
  select id, username, display_name, avatar, color from profiles where active order by created_at
$$;
grant execute on function public.list_login_profiles() to anon, authenticated;

-- ---------- Desculpas ----------
create or replace function public.create_excuse(p_planned_day uuid, p_type text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare d planned_days;
begin
  select * into d from planned_days where id = p_planned_day;
  if d.id is null or d.profile_id <> auth.uid() then raise exception 'Dia não encontrado.'; end if;
  if d.date > today_lisbon() then raise exception 'Só se pede desculpa para hoje ou para dias que já passaram.'; end if;
  if d.status <> 'planned' or exists (select 1 from sessions where profile_id = d.profile_id and date = d.date) then raise exception 'Este dia já não precisa de desculpa.'; end if;
  if exists (select 1 from month_closures where profile_id = d.profile_id and month_key = to_char(d.date, 'YYYY-MM')) then raise exception 'Este mês já fechou.'; end if;
  if exists (select 1 from excuses where planned_day_id = d.id and status <> 'rejected') then raise exception 'Já há uma desculpa para este dia.'; end if;
  insert into excuses (planned_day_id, profile_id, date, type, note) values (d.id, d.profile_id, d.date, p_type, coalesce(p_note, ''));
  insert into audit_log (actor_id, action, entity, entity_id, detail) values (auth.uid(), 'excuse.create', 'planned_day', d.id::text, 'Desculpa para ' || d.date);
end $$;
grant execute on function public.create_excuse(uuid, text, text) to authenticated;

create or replace function public.decide_excuse(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare e excuses;
begin
  if not is_admin() then raise exception 'Só um admin pode decidir desculpas.'; end if;
  select * into e from excuses where id = p_id for update;
  if e.id is null or e.status <> 'pending' then raise exception 'Esta desculpa já foi decidida.'; end if;
  perform set_config('app.system', 'on', true);
  update excuses set status = case when p_approve then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now() where id = p_id;
  if p_approve then update planned_days set status = 'excused' where id = e.planned_day_id; end if;
  perform set_config('app.system', '', true);
  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), case when p_approve then 'excuse.approve' else 'excuse.reject' end, 'excuse', p_id::text,
          case when p_approve then 'Desculpa aprovada' else 'Desculpa recusada' end || ' (' || e.date || case when e.profile_id = auth.uid() then ', a própria' else '' end || ')');
end $$;
grant execute on function public.decide_excuse(uuid, boolean) to authenticated;

-- ---------- Jarro ----------
create or replace function public.set_jar_status(p_id uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Só um admin mexe no jarro.'; end if;
  if p_status not in ('paid', 'unpaid', 'void') then raise exception 'Estado inválido.'; end if;
  if p_status = 'void' and coalesce(trim(p_reason), '') = '' then raise exception 'Para anular é preciso um motivo.'; end if;
  update jar_entries set status = p_status, reason = case when p_status = 'void' then reason || ' (anulada: ' || p_reason || ')' else reason end where id = p_id;
  insert into audit_log (actor_id, action, entity, entity_id, detail) values (auth.uid(), 'jar.' || p_status, 'jar_entry', p_id::text, coalesce(p_reason, p_status));
end $$;
grant execute on function public.set_jar_status(uuid, text, text) to authenticated;

-- ---------- Manutenção (idempotente) ----------
-- 1. Aceita desculpas pendentes do mês anterior a partir do dia (excuse_auto_day + 1).
-- 2. Fecha os meses anteriores de quem não tem desculpas pendentes: multa por cada falha a partir da segunda seguida, com teto.
-- 3. A partir do dia (plan_window_end_day + 1), completa as semanas abaixo do mínimo, repetindo os dias da semana do mês anterior.
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
    for pr in select * from profiles where active loop
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

-- ---------- Fotos com mais de 90 dias ----------
-- O Storage só se apaga pela API, por isso é o telemóvel do admin que apaga os ficheiros ao abrir a app.
create or replace function public.photos_to_cleanup()
returns table (id uuid, photo_path text) language sql stable security definer set search_path = public as $$
  select id, photo_path from sessions where is_admin() and photo_path is not null and date < today_lisbon() - 90
$$;
grant execute on function public.photos_to_cleanup() to authenticated;

create or replace function public.mark_photos_cleaned(p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Só um admin.'; end if;
  perform set_config('app.system', 'on', true);
  update sessions set photo_path = null, in_feed = false where id = any (p_ids) and date < today_lisbon() - 90;
  perform set_config('app.system', '', true);
end $$;
grant execute on function public.mark_photos_cleaned(uuid[]) to authenticated;

-- ---------- Agendamento: de hora a hora (o fuso é tratado dentro da função) ----------
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('treino-em-casa-manutencao', '15 * * * *', $$ select public.run_maintenance(); $$);

-- ---------- Storage ----------
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

-- fotos dos treinos: cada pessoa escreve na sua pasta; a família lê; dono ou admin apaga
create policy "fotos: escrever na minha pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos: família lê" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.is_member());
create policy "fotos: dono ou admin apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- fotos de perfil: públicas (o ecrã de entrada mostra-as antes do login); escreve o próprio ou o admin
create policy "avatares: escrever" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (name = auth.uid()::text || '.jpg' or public.is_admin()));
create policy "avatares: substituir" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (name = auth.uid()::text || '.jpg' or public.is_admin()));
create policy "avatares: ler" on storage.objects for select using (bucket_id = 'avatars');
