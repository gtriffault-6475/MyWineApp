#!/usr/bin/env node
/**
 * Vérifie la configuration Vercel / Neon / Blob / clés API.
 *
 * Usage (après `npx vercel env pull .env.local`) :
 *   npm run check:setup
 *   npm run check:setup -- https://<projet>.vercel.app   # vérifie aussi le déploiement
 *
 * N'affiche jamais la valeur d'un secret. Le fichier de test Blob est supprimé.
 */
import { put, get, del, BlobAccessError } from "@vercel/blob";
import { connectDatabase } from "./lib/db-connect.mjs";

// Tolère « https:xxx », « xxx.vercel.app » sans schéma, etc.
function normalizeUrl(raw) {
  if (!raw) return null;
  const host = raw.replace(/^https?:\/*/i, "").replace(/\/.*$/, "");
  return `https://${host}`;
}
const deployUrl = normalizeUrl(process.argv.slice(2).find((a) => !a.startsWith("--")));

/** Message d'erreur renvoyé par une API (jamais de secret dedans), tronqué. */
async function apiError(res) {
  const body = await res.text().catch(() => "");
  let message = body;
  try {
    const json = JSON.parse(body);
    message = json?.error?.message ?? json?.message ?? body;
  } catch {}
  return `HTTP ${res.status}${message ? ` — ${String(message).slice(0, 200)}` : ""}`;
}
let failures = 0;

const ok = (msg) => console.log(`✅ ${msg}`);
const warn = (msg) => console.log(`⚠️  ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.log(`❌ ${msg}`);
};

async function check(title, fn) {
  console.log(`\n— ${title}`);
  try {
    await fn();
  } catch (error) {
    fail(error.message);
  }
}

await check("Variables d'environnement", async () => {
  const required = [
    "APP_PASSWORD",
    "SESSION_SECRET",
    "DATABASE_URL",
    "ANTHROPIC_API_KEY",
    "FOURSQUARE_API_KEY",
  ];
  for (const name of required) {
    if (process.env[name]) ok(`${name} définie`);
    else fail(`${name} manquante (Vercel → Settings → Environment Variables, puis vercel env pull)`);
  }
  // Blob : authentification OIDC (BLOB_STORE_ID + VERCEL_OIDC_TOKEN, mode par
  // défaut des stores connectés) ou ancien token BLOB_READ_WRITE_TOKEN.
  if (process.env.BLOB_STORE_ID) {
    ok("BLOB_STORE_ID définie (authentification Blob par OIDC)");
    if (!process.env.VERCEL_OIDC_TOKEN) {
      warn("VERCEL_OIDC_TOKEN absente : relancez « npx vercel env pull » (le jeton expire après quelques heures)");
    }
  } else if (process.env.BLOB_READ_WRITE_TOKEN) {
    ok("BLOB_READ_WRITE_TOKEN définie (authentification Blob par token)");
  } else {
    fail("Ni BLOB_STORE_ID ni BLOB_READ_WRITE_TOKEN : store Blob non connecté au projet ?");
  }
  const secret = process.env.SESSION_SECRET;
  if (secret && !/^[A-Za-z0-9+/]{43}=$/.test(secret)) {
    fail("SESSION_SECRET mal formé : 44 caractères base64 finissant par « = » attendus");
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (key && !key.startsWith("sk-ant-")) {
    const hint = key.trim() !== key ? " (espaces ou retour à la ligne autour de la valeur)" : "";
    fail(`ANTHROPIC_API_KEY ne commence pas par « sk-ant- »${hint} — longueur ${key.length} caractères`);
  }
});

await check("Base Neon", async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL absente, test ignoré");
  const { client, transport } = await connectDatabase(process.env.DATABASE_URL);
  try {
    ok(`Canal : ${transport}`);
    const { rows } = await client.query(
      "SELECT current_database() AS db, split_part(version(), ' ', 2) AS v",
    );
    ok(`Connexion OK — base « ${rows[0].db} », Postgres ${rows[0].v}`);

    const tables = (
      await client.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name IN ('cave','cellar_entry','wine')`,
      )
    ).rows.map((r) => r.table_name);
    if (tables.length === 3) {
      ok("Tables cave, cellar_entry, wine présentes (migrations appliquées)");
      const counts = (
        await client.query(
          `SELECT (SELECT count(*) FROM cave)::int AS caves,
                  (SELECT count(*) FROM cellar_entry)::int AS bouteilles,
                  (SELECT count(*) FROM wine)::int AS degustations`,
        )
      ).rows[0];
      ok(`Contenu : ${counts.caves} cave(s), ${counts.bouteilles} bouteille(s), ${counts.degustations} dégustation(s)`);
    } else {
      warn("Tables absentes — lancez « npm run migrate »");
    }
  } finally {
    await client.end();
  }
});

await check("Stockage Vercel Blob", async () => {
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("aucun identifiant Blob, test ignoré");
  }
  const pathname = `_check/setup-${Date.now()}.txt`;
  const uploaded = await put(pathname, "myvine-check", {
    access: "private",
    contentType: "text/plain",
    addRandomSuffix: false,
  });
  try {
    ok("Écriture privée OK");
    const blob = await get(uploaded.url, { access: "private", useCache: false });
    if (blob?.statusCode !== 200) throw new Error("Relecture du fichier de test impossible");
    const text = await new Response(blob.stream).text();
    if (text !== "myvine-check") throw new Error("Contenu relu différent du contenu écrit");
    ok("Relecture privée OK");
  } finally {
    await del(uploaded.url);
  }

  // Le code suppose un store privé : un envoi public doit être refusé.
  const publicPath = `_check/public-${Date.now()}.txt`;
  try {
    const pub = await put(publicPath, "x", { access: "public", addRandomSuffix: false });
    await del(pub.url);
    fail("Le store accepte les fichiers publics : recréez-le en accès « Private »");
  } catch (error) {
    if (error instanceof BlobAccessError || /private store|private access/i.test(error.message ?? "")) {
      ok("Store en accès privé (envoi public refusé, comme attendu)");
    } else if (error.message?.startsWith("Le store accepte")) {
      throw error;
    } else {
      warn(`Accès du store non déterminé : ${error.message}`);
    }
  }
});

await check("Clé Anthropic", async () => {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("clé absente, test ignoré");
  // Liste des modèles : valide la clé sans consommer de tokens.
  const res = await fetch("https://api.anthropic.com/v1/models?limit=1", {
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
  });
  if (res.ok) ok("Clé acceptée par l'API Anthropic");
  else fail(`API Anthropic : ${await apiError(res)}`);
});

await check("Clé Foursquare", async () => {
  if (!process.env.FOURSQUARE_API_KEY) throw new Error("clé absente, test ignoré");
  const res = await fetch(
    // Mêmes paramètres que l'app iOS (ll + radius autour de Paris).
    "https://places-api.foursquare.com/places/search?query=restaurant&limit=1&ll=48.8566%2C2.3522&radius=5000",
    {
      headers: {
        Authorization: `Bearer ${process.env.FOURSQUARE_API_KEY}`,
        "X-Places-Api-Version": "2025-06-17",
        Accept: "application/json",
      },
    },
  );
  if (res.ok) ok("Clé acceptée par l'API Foursquare");
  else fail(`API Foursquare : ${await apiError(res)}`);
});

if (deployUrl) {
  await check(`Déploiement ${deployUrl}`, async () => {
    const base = deployUrl.replace(/\/$/, "");
    const login = await fetch(`${base}/login`).catch((e) => {
      throw new Error(`${base} injoignable (${e.cause?.code ?? e.message}) — vérifiez l'URL dans Vercel`);
    });
    if (login.status === 200) ok("Page de connexion servie");
    else fail(`/login : HTTP ${login.status} (déploiement en échec ? voir l'onglet Deployments)`);

    const home = await fetch(`${base}/`, { redirect: "manual" });
    if (home.status === 307 && home.headers.get("location")?.includes("/login")) {
      ok("Accueil protégé (redirection vers /login sans session)");
    } else {
      fail(`/ : HTTP ${home.status} au lieu d'une redirection vers /login`);
    }

    const auth = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: process.env.APP_PASSWORD ?? "" }),
    });
    if (auth.status === 200) ok("Connexion avec APP_PASSWORD acceptée par le déploiement");
    else fail(`Connexion refusée (HTTP ${auth.status}) : APP_PASSWORD différent entre Vercel et .env.local ?`);
  });
}

console.log(failures === 0 ? "\nTout est bon. 🍷" : `\n${failures} problème(s) à corriger.`);
process.exit(failures === 0 ? 0 : 1);
