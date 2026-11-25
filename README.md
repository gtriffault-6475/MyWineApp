# MyVine (web)

Journal de dégustation et gestion de cave, en web mobile (PWA). Refonte de l'app iOS
MyVine. Contexte, décisions et conventions : [`CLAUDE.md`](CLAUDE.md).

## Démarrer en local

```bash
npm install
cp .env.local.example .env.local   # puis renseigner les valeurs
npm run migrate
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

### Variables d'environnement (`.env.local`, et dans le projet Vercel)

| Variable | Où l'obtenir |
| --- | --- |
| `APP_PASSWORD` | À choisir : mot de passe de connexion à l'app |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `DATABASE_URL` | [console.neon.tech](https://console.neon.tech) → nouveau projet → URL de connexion |
| `BLOB_READ_WRITE_TOKEN` | Projet Vercel → Storage → créer un store Blob **privé** |
| `ANTHROPIC_API_KEY` | console.anthropic.com (reconnaissance d'étiquettes) |
| `FOURSQUARE_API_KEY` | Foursquare Developer (recherche de restaurants) |

### Vérifier la configuration

```bash
npx vercel env pull .env.local
npm run check:setup -- https://<projet>.vercel.app
```

Teste réellement chaque service (connexion Neon et migrations, écriture/lecture
Blob privé, clés Anthropic et Foursquare, déploiement et mot de passe) sans
afficher aucun secret.

## Récupérer les données de l'app iOS

### 1. Sauvegarder le conteneur de l'app (sur le Mac)

1. Brancher l'iPhone, ouvrir Xcode → *Window* → *Devices and Simulators*.
2. Sélectionner l'iPhone, puis MyVine dans *Installed Apps*.
3. Roue crantée → *Download Container…* → enregistrer `MyVine.xcappdata`.
4. Garder **deux copies** (Mac + cloud) et noter dans l'app iOS le nombre de
   dégustations, de bouteilles et de caves.

Le conteneur contient `AppData/Library/LocalDatabase/myvine.db` (SQLite) et
`AppData/Documents/wine-photos/` (photos d'étiquettes).

### 2. Simuler l'import (n'écrit rien)

```bash
npm run import:legacy -- ~/Desktop/MyVine.xcappdata
```

Le rapport affiche les compteurs, les avertissements (photo manquante, lien vers
une bouteille supprimée…) et les erreurs bloquantes (date invalide…).

### 3. Importer

```bash
npm run import:legacy -- ~/Desktop/MyVine.xcappdata --apply
```

1. Upload des photos vers Vercel Blob (privé).
2. Insertion de toutes les lignes dans **une seule transaction** (tout ou rien).
3. Vérification : les compteurs en base doivent égaler ceux de la sauvegarde.

L'import est **rejouable** sans doublon. Conseil : faire d'abord un essai sur une
branche Neon (copie instantanée de la base), puis sur la base principale.

Les clés API (Anthropic, Foursquare) ne sont pas dans la sauvegarde : elles
deviennent des variables d'environnement Vercel.

## Tests

```bash
npm run test        # Vitest
npm run lint
npx tsc --noEmit
```
