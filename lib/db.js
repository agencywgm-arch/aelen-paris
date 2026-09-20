// Accès base de données (Vercel Postgres). Toutes les tables sont créées
// à la volée au premier appel — aucune migration manuelle nécessaire une
// fois la variable d'environnement POSTGRES_URL configurée dans Vercel.

function isConfigured() {
  return Boolean(process.env.POSTGRES_URL);
}

let schemaReady = null;

async function ensureSchema() {
  if (!isConfigured()) throw new Error("db_not_configured");
  if (schemaReady) return schemaReady;

  const { sql } = require("@vercel/postgres");

  schemaReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS magic_link_tokens (
        token TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        stripe_session_id TEXT UNIQUE NOT NULL,
        customer_email TEXT NOT NULL,
        amount_total INTEGER NOT NULL,
        currency TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        size TEXT,
        qty INTEGER NOT NULL,
        unit_price INTEGER NOT NULL
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON orders (customer_email);`;
  })();

  return schemaReady;
}

async function getSql() {
  await ensureSchema();
  return require("@vercel/postgres").sql;
}

module.exports = { isConfigured, ensureSchema, getSql };
