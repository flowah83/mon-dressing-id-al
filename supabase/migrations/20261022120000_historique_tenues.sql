-- Historique des tenues portées. Chaque personne ne voit que ses lignes.
-- L'application continue de fonctionner sans cette table : l'historique reste
-- alors uniquement sur l'appareil, et la copie des pièces n'est pas bloquée.
-- À appliquer une fois dans Lovable Cloud (éditeur SQL).

create table if not exists public.worn_outfits (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  worn_on date not null,
  item_ids text[] not null default '{}',
  outfit_id text,
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint worn_outfits_name_len check (char_length(name) <= 200),
  constraint worn_outfits_outfit_len check (outfit_id is null or char_length(outfit_id) <= 80),
  constraint worn_outfits_items_count check (cardinality(item_ids) between 1 and 12)
);

create index if not exists worn_outfits_user_updated_idx on public.worn_outfits (user_id, updated_at desc);
create index if not exists worn_outfits_user_day_idx on public.worn_outfits (user_id, worn_on desc);

alter table public.worn_outfits enable row level security;

revoke all on table public.worn_outfits from public;
revoke all on table public.worn_outfits from anon;
revoke all on table public.worn_outfits from authenticated;
grant select, insert, update, delete on table public.worn_outfits to authenticated;

drop policy if exists worn_outfits_select_own on public.worn_outfits;
create policy worn_outfits_select_own on public.worn_outfits
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists worn_outfits_insert_own on public.worn_outfits;
create policy worn_outfits_insert_own on public.worn_outfits
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists worn_outfits_update_own on public.worn_outfits;
create policy worn_outfits_update_own on public.worn_outfits
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists worn_outfits_delete_own on public.worn_outfits;
create policy worn_outfits_delete_own on public.worn_outfits
  for delete to authenticated
  using (auth.uid() = user_id);

drop trigger if exists worn_outfits_owner on public.worn_outfits;
create trigger worn_outfits_owner
  before insert or update on public.worn_outfits
  for each row execute function public.enforce_row_owner();
