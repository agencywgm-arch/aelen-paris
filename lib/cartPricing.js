const PRODUCTS = require("../assets/js/products-data.js");

// Relit un panier envoyé par le navigateur à partir du catalogue serveur et
// des surcharges du dashboard staff (prix, stock) : jamais les prix du client.
// Renvoie { lines, total, unavailable } — total en centimes.
async function priceCart(sql, rawItems) {
  const items = Array.isArray(rawItems) ? rawItems.slice(0, 30) : [];

  const [{ rows: priceRows }, { rows: stockRows }] = await Promise.all([
    sql`SELECT product_id, price FROM product_overrides;`,
    sql`SELECT product_id, size, quantity FROM product_stock;`,
  ]);
  const priceOverrides = {};
  priceRows.forEach((r) => {
    priceOverrides[r.product_id] = r.price === null ? null : Number(r.price);
  });
  const stockByKey = {}; // "productId|size" -> quantité restante, absent = non suivi (illimité)
  stockRows.forEach((r) => {
    stockByKey[`${r.product_id}|${r.size}`] = r.quantity;
  });

  // Regroupe les doublons (même produit + même taille).
  const merged = new Map();
  for (const entry of items) {
    if (!entry || typeof entry.id !== "string") continue;
    const size = typeof entry.size === "string" ? entry.size.slice(0, 10) : "";
    const qty = Math.max(1, Math.min(20, parseInt(entry.qty, 10) || 1));
    const key = `${entry.id}|${size}`;
    const previous = merged.get(key);
    merged.set(key, { id: entry.id, size, qty: Math.min(20, (previous ? previous.qty : 0) + qty) });
  }

  const lines = [];
  const unavailable = [];
  for (const { id, size, qty } of merged.values()) {
    const product = PRODUCTS.find((p) => p.id === id);
    if (!product || typeof product.price !== "number") {
      unavailable.push({ id, size, reason: "unknown_product" });
      continue;
    }
    if (product.sizes && product.sizes.length && !product.sizes.includes(size)) {
      unavailable.push({ id, size, name: product.name, reason: "invalid_size" });
      continue;
    }
    const tracked = stockByKey[`${id}|${size}`];
    if (tracked !== undefined && tracked < qty) {
      unavailable.push({ id, size, name: product.name, reason: "out_of_stock", remaining: Math.max(0, tracked) });
      continue;
    }
    const unitPrice = priceOverrides[id] != null ? priceOverrides[id] : product.price;
    lines.push({ productId: id, productName: product.name, size, qty, unitPrice: Math.round(unitPrice * 100) });
  }

  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  return { lines, total, unavailable };
}

function formatEuros(cents) {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

module.exports = { priceCart, formatEuros };
