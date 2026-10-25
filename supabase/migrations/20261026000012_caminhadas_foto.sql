-- Foto (opcional) nas caminhadas. Vai para o bucket "photos", na pasta de quem registou,
-- que já tem as regras certas (só o próprio escreve, a família lê, o próprio ou o admin apaga).

alter table public.walks add column if not exists photo_path text;
alter table public.walks add column if not exists photo_taken_at timestamptz;

create or replace function public.walks_guard() returns trigger
language plpgsql as $$
begin
  -- quem foi tem de ser da família, sem repetir quem registou
  new.companions := array(
    select distinct c from unnest(new.companions) as c
    where c <> new.profile_id and exists (select 1 from public.profiles p where p.id = c and p.active)
  );
  if public.is_system() then return new; end if;
  if tg_op = 'UPDATE' then
    -- depois de registada, só se mudam as notas e quem foi; a foto só pode ser apagada
    new.profile_id := old.profile_id;
    new.date := old.date;
    new.started_at := old.started_at;
    new.ended_at := old.ended_at;
    new.duration_s := old.duration_s;
    new.distance_m := old.distance_m;
    new.route := old.route;
    new.source := old.source;
    new.created_at := old.created_at;
    new.photo_taken_at := old.photo_taken_at;
    if new.photo_path is not null and new.photo_path is distinct from old.photo_path then
      raise exception 'A foto não se troca depois de guardar.';
    end if;
  else
    if new.photo_path is not null and split_part(new.photo_path, '/', 1) <> new.profile_id::text then
      raise exception 'A foto tem de estar na tua pasta.';
    end if;
  end if;
  if new.date > public.today_lisbon() then raise exception 'A caminhada não pode ser no futuro.'; end if;
  if new.ended_at < new.started_at then raise exception 'A caminhada acaba antes de começar.'; end if;
  return new;
end $$;

-- Fotos das caminhadas com mais de 90 dias (como as dos treinos). O Storage só se apaga pela API,
-- por isso é o telemóvel do admin que apaga os ficheiros ao abrir a app.
create or replace function public.walk_photos_to_cleanup()
returns table (id uuid, photo_path text) language sql stable security definer set search_path = public as $$
  select id, photo_path from walks where is_admin() and photo_path is not null and date < today_lisbon() - 90
$$;
grant execute on function public.walk_photos_to_cleanup() to authenticated;

create or replace function public.mark_walk_photos_cleaned(p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Só um admin.'; end if;
  perform set_config('app.system', 'on', true);
  update walks set photo_path = null where id = any (p_ids) and date < today_lisbon() - 90;
  perform set_config('app.system', '', true);
end $$;
grant execute on function public.mark_walk_photos_cleaned(uuid[]) to authenticated;
