@AGENTS.md

# MyVine (web) — Contexte projet

Refonte en web mobile (PWA) de l'app iOS MyVine (dépôt `gtriffault-6475/MyVineApp`,
React Native, désormais archive). Journal de dégustation + gestion de cave.
Stack et conventions calquées sur le projet Euskara.

## Décisions produit (v1)

- **Parité stricte** avec l'app iOS : mêmes 5 onglets (Cave, Dégustations,
  Recherche, Stats, Paramètres), mêmes champs. Pas de nouvelle fonctionnalité en v1.
- Utilisateur unique → mot de passe partagé (`APP_PASSWORD`), pas de comptes.
- Interface en **français uniquement**.
- **Pas de mode hors ligne** : sans réseau, une action échoue avec un message clair.
- Photo d'étiquette : **appareil photo ET photothèque**. Utiliser
  `<input type="file" accept="image/*">` **sans** l'attribut `capture` — sur iOS,
  `capture` force l'appareil photo et masque la photothèque.
- Reconnaissance d'étiquette : Claude **Haiku**, appelé côté serveur uniquement.
- Hébergement : Vercel (`*.vercel.app`, pas de domaine) + Neon + Vercel Blob privé.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5.9 · Tailwind 4 · Neon Postgres
(`@neondatabase/serverless` au runtime, `pg` pour migrations et import) ·
`node-pg-migrate` · Vercel Blob (privé) · `jose` (session) · `@anthropic-ai/sdk` · Vitest.

## Architecture (reprise d'Euskara)

- UI (`app/**`) → Route Handlers (`app/api/**`) → `lib/db` (seule couche qui
  touche Postgres) | `lib/clients` (Claude, Foursquare).
- Un Server Component peut lire `lib/db` directement pour son rendu initial ;
  toute mutation passe par un Route Handler.
- Auth vérifiée une seule fois dans `proxy.ts` (liste noire minimale de chemins publics).
- Photos : Blob **privé**, jamais d'URL Blob exposée au client — une route
  `app/api/.../photo` streame le fichier. Compression côté client avant envoi
  (≈2000 px, JPEG q0.8) à cause de la limite de 4,5 Mo des requêtes Vercel.
- Secrets uniquement en variables d'environnement (voir `.env.local.example`).

## Base de données

**Règle absolue :** le schéma évolue uniquement par migrations `node-pg-migrate`
(`npm run migrate:create -- <nom>`, puis `npm run migrate`). Jamais de `DROP TABLE`
ni de recréation : cela détruirait les données. Pas de migration `down` destructive
(`export const down = false`).

Conventions : UUID (`gen_random_uuid()`), `timestamptz` UTC, snake_case, noms de
tables au singulier en anglais.

| Table | Équivalent iOS | Notes |
|---|---|---|
| `cave` | `caves` | |
| `cellar_entry` | `cellar` | `cave_id` → `cave` |
| `wine` | `wines` | dégustation ; `cellar_entry_id` → `cellar_entry` |

Colonne `legacy_id` : id entier de l'app iOS pour les lignes importées, NULL sinon.
`photo_path` : chemin du fichier dans Blob (`wine-photos/<nom>`), pas une URL.

## Import des données iOS

`scripts/import-legacy.mjs` lit une sauvegarde Xcode (`.xcappdata`) et importe
caves, bouteilles, dégustations et photos. Simulation par défaut, `--apply` pour
écrire. Rejouable (UUID déterministes dérivés des id iOS). Mode d'emploi : README.

## Tests

Vitest pour la logique, les routes et le script d'import. Pas de tests de
composants React (comme Euskara) : l'UI est vérifiée manuellement sur iPhone.
