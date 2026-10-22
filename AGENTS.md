<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Vestiaire — règles du projet

- Le dressing se lit d'abord dans IndexedDB et se copie ensuite dans le compte
  (tables `public.garments` / `public.outfits`, RLS au propriétaire) : l'application
  doit rester utilisable sans compte et sans réseau, donc jamais de lecture en ligne
  sur le chemin critique de l'affichage.
- Les photos vont dans le bac privé `garment-photos`, dans le dossier de leur
  propriétaire, et jamais dans un bac public : une photo personnelle ne doit pas
  avoir d'URL lisible par d'autres.
- Tout appel au service d'analyse passe par `gateAiCall` + `consume_ai_quota`
  (compteur quotidien lu par son propriétaire) : le nombre restant affiché doit
  venir de la base, et aucune analyse n'est simulée côté client.
- Les tenues proposées viennent du moteur de règles local (`src/lib/rules.ts`) ;
  le texte du styliste n'est marqué « Conseil IA » que lorsqu'il vient réellement
  du service.
- Les pièces de démonstration restent dans leur propre mode, jamais mélangées aux
  pièces personnelles, et restent effaçables.
