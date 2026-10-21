-- Vestiaire : compte, dressing privé, photos privées, limite quotidienne de l'analyse.
-- Chaque personne ne peut lire et modifier que ses propres lignes.
-- À appliquer une fois dans Lovable Cloud (éditeur SQL), après avoir activé Cloud.

create table if not exists public.garments (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null,
  colors text[] not null default '{}',
  pattern text not null,
  style text not null,
  seasons text[] not null default '{}',
  available boolean not null default true,
  favorite boolean not null default false,
  notes text not null default '',
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint garments_name_len check (char_length(name) between 1 and 200),
  constraint garments_notes_len check (char_length(notes) <= 4000),
  constraint garments_category check (category in ('haut', 'bas', 'chaussures', 'veste', 'accessoire', 'robe')),
  constraint garments_pattern check (pattern in ('uni', 'rayé', 'carreaux', 'fleuri', 'pois', 'imprimé', 'texturé')),
  constraint garments_style check (style in ('decontracte', 'classique', 'chic', 'sport', 'minimaliste', 'boheme', 'streetwear')),
  constraint garments_colors_known check (
    cardinality(colors) <= 8
    and colors <@ array['noir', 'blanc', 'ecru', 'gris', 'beige', 'camel', 'marron', 'marine', 'bleu', 'denim', 'kaki', 'vert', 'rouge', 'bordeaux', 'rose', 'orange', 'jaune', 'violet', 'multicolore']::text[]
  ),
  constraint garments_seasons_known check (
    seasons <@ array['printemps', 'ete', 'automne', 'hiver']::text[]
  )
);

create table if not exists public.outfits (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  item_ids text[] not null default '{}',
  source text not null,
  explanation text,
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint outfits_name_len check (char_length(name) between 1 and 200),
  constraint outfits_explanation_len check (explanation is null or char_length(explanation) <= 4000),
  constraint outfits_source check (source in ('manuel', 'conseiller')),
  constraint outfits_feedback check (feedback is null or feedback in ('like', 'dislike')),
  constraint outfits_items_count check (cardinality(item_ids) <= 12)
);

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  analyses integer not null default 0 check (analyses >= 0 and analyses <= 50),
  advice integer not null default 0 check (advice >= 0 and advice <= 50),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists garments_user_updated_idx on public.garments (user_id, updated_at desc);
create index if not exists outfits_user_updated_idx on public.outfits (user_id, updated_at desc);

alter table public.garments enable row level security;
alter table public.outfits enable row level security;
alter table public.ai_usage enable row level security;

revoke all on table public.garments from public;
revoke all on table public.garments from anon;
revoke all on table public.garments from authenticated;
grant select, insert, update, delete on table public.garments to authenticated;

revoke all on table public.outfits from public;
revoke all on table public.outfits from anon;
revoke all on table public.outfits from authenticated;
grant select, insert, update, delete on table public.outfits to authenticated;

revoke all on table public.ai_usage from public;
revoke all on table public.ai_usage from anon;
revoke all on table public.ai_usage from authenticated;
grant select on table public.ai_usage to authenticated;

drop policy if exists garments_select_own on public.garments;
create policy garments_select_own on public.garments
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists garments_insert_own on public.garments;
create policy garments_insert_own on public.garments
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists garments_update_own on public.garments;
create policy garments_update_own on public.garments
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists garments_delete_own on public.garments;
create policy garments_delete_own on public.garments
  for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists outfits_select_own on public.outfits;
create policy outfits_select_own on public.outfits
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists outfits_insert_own on public.outfits;
create policy outfits_insert_own on public.outfits
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists outfits_update_own on public.outfits;
create policy outfits_update_own on public.outfits
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists outfits_delete_own on public.outfits;
create policy outfits_delete_own on public.outfits
  for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.enforce_row_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    return new;
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'Propriétaire non modifiable';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_row_owner() from public;
revoke all on function public.enforce_row_owner() from anon;
grant execute on function public.enforce_row_owner() to authenticated;

drop trigger if exists garments_owner on public.garments;
create trigger garments_owner
  before insert or update on public.garments
  for each row execute function public.enforce_row_owner();

drop trigger if exists outfits_owner on public.outfits;
create trigger outfits_owner
  before insert or update on public.outfits
  for each row execute function public.enforce_row_owner();

-- Compteur quotidien. Seul auth.uid() est utilisé : l'appelant ne peut pas
-- choisir un autre compte, ni baisser le compteur. La limite est 50.
create or replace function public.consume_ai_quota(kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lim constant int := 50;
  today date := (timezone('Europe/Paris', now()))::date;
  current_count integer;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'code', 'auth');
  end if;
  if kind is distinct from 'analysis' and kind is distinct from 'advice' then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  insert into public.ai_usage (user_id, day)
  values (uid, today)
  on conflict (user_id, day) do nothing;

  if kind = 'analysis' then
    select analyses into current_count
    from public.ai_usage
    where user_id = uid and day = today
    for update;
    if current_count is null then
      return jsonb_build_object('ok', false, 'code', 'unavailable');
    end if;
    if current_count >= lim then
      return jsonb_build_object('ok', false, 'code', 'limit', 'used', current_count, 'limit', lim, 'remaining', 0);
    end if;
    update public.ai_usage
      set analyses = analyses + 1, updated_at = now()
      where user_id = uid and day = today;
  else
    select advice into current_count
    from public.ai_usage
    where user_id = uid and day = today
    for update;
    if current_count is null then
      return jsonb_build_object('ok', false, 'code', 'unavailable');
    end if;
    if current_count >= lim then
      return jsonb_build_object('ok', false, 'code', 'limit', 'used', current_count, 'limit', lim, 'remaining', 0);
    end if;
    update public.ai_usage
      set advice = advice + 1, updated_at = now()
      where user_id = uid and day = today;
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'ok',
    'used', current_count + 1,
    'limit', lim,
    'remaining', lim - current_count - 1
  );
end;
$$;

revoke all on function public.consume_ai_quota(text) from public;
revoke all on function public.consume_ai_quota(text) from anon;
grant execute on function public.consume_ai_quota(text) to authenticated;

drop policy if exists vestiaire_garment_photos_select on storage.objects;
create policy vestiaire_garment_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'garment-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and array_length(storage.foldername(name), 1) = 1
  );

drop policy if exists vestiaire_garment_photos_insert on storage.objects;
create policy vestiaire_garment_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'garment-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and array_length(storage.foldername(name), 1) = 1
  );

drop policy if exists vestiaire_garment_photos_update on storage.objects;
create policy vestiaire_garment_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'garment-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'garment-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and array_length(storage.foldername(name), 1) = 1
  );

drop policy if exists vestiaire_garment_photos_delete on storage.objects;
create policy vestiaire_garment_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'garment-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
