# Mon Dressing Idéal

Crée une application complète en français appelée « Vestiaire », pensée d'abord pour iPhone. L'utilisateur veut à la fois un dressing visuel de ses vrais vêtements photographiés et un conseiller de tenues. Construis une première version utilisable, pas une simple maquette. Utilise les capacités Lovable disponibles pour les fonctions réelles; ne simule jamais une analyse IA ou une météo.

Design: élégant, chaleureux, éditorial mode, fond ivoire, texte anthracite, accent vert olive, typographie soignée, grandes photos des pièces, cartes aux coins doux, beaucoup d'espace. Navigation basse mobile avec Dressing, Ajouter (bouton central), Conseiller, Favoris. Responsive desktop également. Nom provisoire Vestiaire, interface en français, aucune marque externe inutile. PWA avec manifest et icônes, compatible ajout écran d'accueil iPhone, safe areas et zones tactiles confortables.

Fonctions prioritaires:
1. Dressing: grille visuelle des pièces, recherche, filtres catégorie/couleur/saison, fiche vêtement modifiable, supprimer avec confirmation, disponible / au lavage, favoris. Catégories hauts, bas, chaussures, vestes, accessoires, robes/combinaisons. Interface inclusive sans imposer de genre ni acheter une garde-robe.
2. Ajouter: photo depuis appareil ou galerie iPhone (vrais inputs capture et file), prévisualisation, compression raisonnable, analyse visuelle réelle si IA disponible pour suggérer nom/type/couleurs/motif/style/saisons. Validation et correction utilisateur avant enregistrement. Ne pas inventer taille ou composition matière à partir d'image. Détourage réel si disponible et fiable, sinon conserver photo d'origine avec cadrage, sans prétendre avoir détouré. Montrer progression et erreurs actionnables. Ne jamais exposer une clé API dans client. Si une intégration/permission IA bloque, permettre immédiatement une vraie saisie manuelle et expliquer clairement la limite.
3. Conseiller: choisir occasion (quotidien, travail, sortie, chic), style et température manuelle; partir éventuellement d'une pièce imposée du dressing. Composer jusqu'à 3 tenues réellement distinctes avec exclusivement les vêtements de l'utilisateur disponibles. Illustrer avec les photos et expliquer harmonie couleurs, proportions et usage. Mode simple / travaillé / audacieux. Moteur de règles transparent fonctionnel minimum (couleurs neutres, harmonies simples, adéquation occasion/saison, catégories complémentaires); enrichir via IA réelle si disponible. Ne jamais afficher « IA » pour une règle locale. Si inventaire insuffisant, dire précisément quelles catégories manquent au lieu d'inventer des pièces. Ne jamais mélanger vêtements démo et vêtements personnels.
4. Composer soi-même: sélectionner haut/bas/chaussures/veste/accessoires ou tenue robe/combinaison, aperçu collage propre, enregistrer une tenue avec nom. Depuis fiche vêtement bouton « Associer cette pièce ». Favoris tenues persistants, suppression/édition, avis j'aime/moins mon style conservés et utilisés si possible.
5. Persistance réelle des photos et données. Préférer stockage sécurisé avec compte et isolation utilisateur si backend disponible sans blocage; autrement IndexedDB local (photos en blobs, pas localStorage saturé) avec mention claire « enregistré sur cet appareil », sauvegarde/export et import si possible. Ne pas exiger login pour essayer démo. Photos personnelles jamais publiques et pas de bucket public. Aucun tracking inutile.
6. Premier lancement honnête: dressing vide avec CTA « Ajouter ma première pièce » et option explicite « Explorer une démonstration ». Démo séparée visuellement indiquée et effaçable, vêtements d'exemple uniquement dans ce mode; beaux visuels cohérents. Ne pas afficher faux compteurs ou fausses fonctions météo. Prévoir états chargement/erreur/vide.
Teste parcours ajout photo => validation => dressing => édition => conseiller => favori => rechargement persistance. Vérifie rendu mobile 390px, absence overflow, navigation et boutons. Fournis un résumé exact des fonctions réalisées et de celles nécessitant activation. Ne publie pas automatiquement de données personnelles. Priorise ce MVP opérationnel plutôt que valise/shopping qui pourront venir ensuite.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/12fab141-3187-4cc4-bbfd-8e14c24a5066).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
