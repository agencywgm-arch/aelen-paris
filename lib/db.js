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
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await sql`ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;`;
    await sql`CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON orders (customer_email);`;

    // ---- Espace staff (dashboard admin) ----
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_carrier TEXT;`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;`;
    await sql`
      CREATE TABLE IF NOT EXISTS staff_sessions (
        token TEXT PRIMARY KEY,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS product_overrides (
        product_id TEXT PRIMARY KEY,
        price NUMERIC,
        out_of_stock_sizes TEXT[] NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    // ---- Boutique complète : stock, retours, factures ----
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT;`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;`;
    await sql`
      CREATE TABLE IF NOT EXISTS product_stock (
        product_id TEXT NOT NULL,
        size TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (product_id, size)
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS returns (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'requested',
        reason TEXT,
        refund_amount INTEGER,
        stripe_refund_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS returns_order_id_idx ON returns (order_id);`;
  })();

  return schemaReady;
}

async function getSql() {
  await ensureSchema();
  return require("@vercel/postgres").sql;
}

module.exports = { isConfigured, ensureSchema, getSql };
