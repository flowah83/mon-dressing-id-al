-- Le compteur quotidien doit être lisible par son propriétaire, sinon l'écran
-- « Aujourd'hui : X analyses restantes » reste faux et affiche la limite pleine.
-- Rien d'autre n'est ajouté : l'écriture passe toujours par consume_ai_quota.

drop policy if exists ai_usage_select_own on public.ai_usage;
create policy ai_usage_select_own on public.ai_usage
  for select to authenticated
  using (auth.uid() = user_id);
