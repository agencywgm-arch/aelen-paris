const Stripe = require("stripe");
const PRODUCTS = require("../assets/js/products-data.js");
const { isConfigured, getSql } = require("../lib/db.js");

// Fonction serverless Vercel : crée une session Stripe Checkout à partir
// du panier envoyé par le client. Les prix ne sont JAMAIS pris depuis la
// requête — on relit le catalogue serveur (products-data.js) pour éviter
// qu'un client ne puisse falsifier le montant payé.
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    res.status(500).json({ error: "stripe_not_configured" });
    return;
  }

  const items = req.body && req.body.items;
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "empty_cart" });
    return;
  }

  const origin = req.headers.origin || `https://${req.headers.host}`;

  function absoluteImageUrl(product) {
    const first = product.images && product.images[0];
    if (!first) return null;
    const src = typeof first === "string" ? first : first.src;
    return `${origin}/${src}`;
  }

  // Surcharges prix/stock définies depuis le dashboard staff (si la base
  // est configurée) — c'est la seule source de vérité pour le montant
  // facturé et le stock disponible, jamais les valeurs envoyées par le client.
  let priceOverrides = {};
  let stockByKey = {}; // "productId|size" -> quantité restante, absent = non suivi (illimité)
  if (isConfigured()) {
    try {
      const sql = await getSql();
      const [{ rows: priceRows }, { rows: stockRows }] = await Promise.all([
        sql`SELECT product_id, price FROM product_overrides;`,
        sql`SELECT product_id, size, quantity FROM product_stock;`,
      ]);
      priceRows.forEach((r) => {
        priceOverrides[r.product_id] = r.price === null ? null : Number(r.price);
      });
      stockRows.forEach((r) => {
        stockByKey[`${r.product_id}|${r.size}`] = r.quantity;
      });
    } catch (err) {
      // En cas d'erreur on continue avec les prix statiques du catalogue.
    }
  }

  const line_items = [];
  for (const entry of items) {
    const product = PRODUCTS.find((p) => p.id === entry.id);
    if (!product || typeof product.price !== "number") continue;

    const size = typeof entry.size === "string" ? entry.size.slice(0, 10) : "";
    const trackedStock = stockByKey[`${product.id}|${size}`];
    if (trackedStock !== undefined && trackedStock <= 0) continue;

    let qty = Math.max(1, Math.min(20, parseInt(entry.qty, 10) || 1));
    if (trackedStock !== undefined) qty = Math.min(qty, trackedStock);
    const image = absoluteImageUrl(product);
    const unitPrice = priceOverrides[product.id] != null ? priceOverrides[product.id] : product.price;

    line_items.push({
      quantity: qty,
      price_data: {
        currency: "eur",
        unit_amount: Math.round(unitPrice * 100),
        product_data: {
          name: size ? `${product.name} — Taille ${size}` : product.name,
          images: image ? [image] : undefined,
          metadata: { productId: product.id, size },
        },
      },
    });
  }

  if (line_items.length === 0) {
    res.status(400).json({ error: "no_valid_items" });
    return;
  }

  const stripe = Stripe(stripeSecretKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      locale: "fr",
      phone_number_collection: { enabled: true },
      shipping_address_collection: {
        allowed_countries: ["FR", "BE", "CH", "LU", "MC", "DE", "ES", "IT"],
      },
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/index.html`,
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: "stripe_error" });
  }
};
