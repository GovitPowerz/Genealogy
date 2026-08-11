# Généalogie de la famille

Site statique de généalogie familiale, hébergé sur GitHub Pages.
Toutes les données vivent dans un seul fichier, `data/family.json`
(personnes + unions), et quatre rendus visuels ("thèmes") affichent le
même arbre avec les mêmes interactions : panneau de détail au clic,
recherche insensible aux accents avec vol vers la personne, zoom et
déplacement, liens profonds par URL
(`#theme=ciel&person=gregory-gelly`).

Aucune dépendance, aucune étape de build : HTML, CSS et JavaScript
(modules ES) servis tels quels.

## Les quatre thèmes

| Thème | Ambiance |
|---|---|
| Manuscrit | Page de manuscrit enluminé : parchemin, rinceaux, bannières posées sur un arbre peint |
| Ciel étoilé | Ciel nocturne animé : chaque personne est une étoile, les familles forment des constellations |
| Hologramme | Interface science-fiction : cartes hexagonales, néons cyan et magenta, impulsions animées le long des liens |
| Frise du temps | Chronologie : une barre de vie par personne sur un axe des années, ligne rouge "aujourd'hui" |

Le dernier thème choisi est mémorisé dans le navigateur.

## Participer (pour la famille)

Aucun compte nécessaire, tout passe par e-mail.

1. Ouvrir la page [Participer](contribute.html) du site (`/contribute.html`).
2. Choisir le mode : Ajouter une personne, Corriger une fiche, Ajouter
   ou corriger une union, ou Autre remarque.
3. Remplir le formulaire, puis cliquer sur "Envoyer par e-mail"
   (ou "Copier le texte" et coller le résultat dans un e-mail).
4. Pour une photo : la joindre directement à l'e-mail. Le formulaire
   indique dans la soumission qu'une photo arrive.

## Appliquer une soumission (mainteneur)

1. Enregistrer le JSON reçu par e-mail dans un fichier, par exemple
   `soumission.json`.
2. Créer une branche :

   ```bash
   git switch -c feature/ajout-prenom-nom
   ```

3. Vérifier la soumission sans rien écrire :

   ```bash
   node tools/apply-submission.mjs soumission.json --dry-run
   ```

4. Appliquer. L'outil valide les données résultantes et refuse
   d'écrire `data/family.json` en cas d'erreur :

   ```bash
   node tools/apply-submission.mjs soumission.json
   ```

   La soumission peut aussi être lue sur l'entrée standard :
   `node tools/apply-submission.mjs -`.

5. Si la soumission annonce une photo, enregistrer le portrait joint à
   l'e-mail sous `assets/photos/<id>.jpg` (le résumé imprimé par
   l'outil rappelle l'id exact).
6. Contrôler puis valider :

   ```bash
   node tools/validate.mjs
   git diff data/family.json
   git add data/family.json assets/photos/
   git commit
   ```

7. Fusionner la branche dans `main` : GitHub Pages publie
   automatiquement.

## Développement

- Aucune étape de build, aucune dépendance. Servir la racine du dépôt
  avec n'importe quel serveur statique (nécessaire pour les modules ES
  et `fetch`) :

  ```bash
  python3 -m http.server 8000
  ```

  puis ouvrir <http://localhost:8000>.

- Tests unitaires (`node --test`, Node 22) :

  ```bash
  npm test
  ```

- Validation des données (unicité des ids, champs requis, formats de
  date, références, photos présentes sur le disque) :

  ```bash
  node tools/validate.mjs
  ```

  (`npm run validate` est un raccourci équivalent.)

- Intégration continue : `.github/workflows/validate.yml` rejoue ces
  deux commandes à chaque push et pull request.
- Déploiement : GitHub Pages sert la racine du dépôt depuis la branche
  `main`. Fusionner dans `main` suffit à publier.

## Modèle de données

Un seul fichier, `data/family.json` :
`{ "persons": [...], "unions": [...] }`.

Les enfants appartiennent aux unions, pas aux personnes. Parent unique
ou inconnu = union à un seul partenaire. Une personne est enfant d'au
plus une union.

### Personne

| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| `id` | slug | oui | lisible, ex. `gregory-gelly` ; le nom du fichier photo le reprend |
| `firstNames` | chaîne | oui | prénoms |
| `lastName` | chaîne | oui | nom d'usage |
| `birthName` | chaîne ou `null` | non | nom de naissance ("née X") |
| `sex` | `"M"`, `"F"` ou `null` | non | `null` = inconnu |
| `birth` | `{ "date", "place" }` ou `null` | non | date `"1942"`, `"1942-05"` ou `"1942-05-17"` |
| `death` | `{ "date", "place" }` ou `null` | non | `null` = personne vivante |
| `photo` | chemin ou `null` | non | ex. `assets/photos/gregory-gelly.jpg` |
| `bio` | chaîne | non | texte libre en français |

### Union

| Champ | Type | Notes |
|---|---|---|
| `id` | slug | ex. `u-gregory-marie` |
| `partners` | 1 ou 2 ids de personnes | partenaire unique autorisé |
| `date` | chaîne ou `null` | même format que les autres dates |
| `children` | liste d'ids de personnes | chaque enfant apparaît dans au plus une union |
