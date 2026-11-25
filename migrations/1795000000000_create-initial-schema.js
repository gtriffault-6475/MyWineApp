/**
 * Schéma initial — parité stricte avec la base SQLite de l'app iOS (DB_VERSION 4).
 *
 * Correspondance des tables iOS → web :
 *   caves  → cave
 *   cellar → cellar_entry
 *   wines  → wine
 *
 * `legacy_id` conserve l'identifiant entier de l'app iOS pour les lignes
 * importées (scripts/import-legacy.mjs) ; NULL pour les lignes créées dans
 * l'app web. Contrainte UNIQUE : un ancien id ne peut être importé qu'une fois.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

const timestamps = (pgm) => ({
  created_at: {
    type: "timestamptz",
    notNull: true,
    default: pgm.func("now()"),
  },
  updated_at: {
    type: "timestamptz",
    notNull: true,
    default: pgm.func("now()"),
  },
});

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createExtension("pgcrypto", { ifNotExists: true });

  pgm.createTable("cave", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    legacy_id: { type: "integer", unique: true },
    name: { type: "text", notNull: true },
    ...timestamps(pgm),
  });

  pgm.createTable("cellar_entry", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    legacy_id: { type: "integer", unique: true },
    cave_id: { type: "uuid", references: "cave", onDelete: "SET NULL" },
    name: { type: "text", notNull: true },
    producer: { type: "text" },
    appellation: { type: "text" },
    // Texte libre dans l'app iOS (ex. "NV") — conservé tel quel.
    vintage: { type: "text" },
    quantity: { type: "integer", notNull: true, default: 1 },
    quantity_initial: { type: "integer", notNull: true, default: 1 },
    purchase_date: { type: "date" },
    purchase_price: { type: "numeric(10,2)" },
    optimal_from: { type: "integer" },
    optimal_to: { type: "integer" },
    storage_location: { type: "text" },
    notes: { type: "text" },
    photo_path: { type: "text" },
    archived: { type: "boolean", notNull: true, default: false },
    ...timestamps(pgm),
  });
  pgm.createIndex("cellar_entry", "cave_id");

  pgm.createTable("wine", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    legacy_id: { type: "integer", unique: true },
    cellar_entry_id: {
      type: "uuid",
      references: "cellar_entry",
      onDelete: "SET NULL",
    },
    name: { type: "text", notNull: true },
    producer: { type: "text" },
    appellation: { type: "text" },
    vintage: { type: "integer" },
    score: { type: "real" },
    location_type: {
      type: "text",
      notNull: true,
      default: "home",
      check: "location_type IN ('home','friend','restaurant')",
    },
    restaurant_name: { type: "text" },
    drunk_at: { type: "date", notNull: true },
    food_pairing: { type: "text" },
    photo_path: { type: "text" },
    comment: { type: "text" },
    companion: { type: "text" },
    buy_again: { type: "boolean", notNull: true, default: false },
    ...timestamps(pgm),
  });
  pgm.createIndex("wine", [{ name: "drunk_at", sort: "DESC" }]);
  pgm.createIndex("wine", [{ name: "score", sort: "DESC" }]);
  pgm.createIndex("wine", "producer");
  pgm.createIndex("wine", "appellation");
  pgm.createIndex("wine", "cellar_entry_id");
};

/**
 * Pas de down destructif : le schéma porte les données utilisateur.
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = false;
