const { isConfigured, getSql } = require("../lib/db.js");

// Endpoint public (pas d'authentification) : expose les surcharges de prix
// et les niveaux de stock définis depuis le dashboard staff, pour que la
// boutique les applique à l'affichage. Se dégrade en objet vide si la base
// n'est pas configurée — le site retombe alors sur les prix statiques du
// catalogue et aucune taille n'est marquée indisponible.
module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  if (!isConfigured()) {
    res.status(200).json({ overrides: {} });
    return;
  }

  try {
    const sql = await getSql();
    const [{ rows: priceRows }, { rows: stockRows }] = await Promise.all([
      sql`SELECT product_id, price FROM product_overrides;`,
      sql`SELECT product_id, size, quantity FROM product_stock;`,
    ]);

    const overrides = {};
    priceRows.forEach((r) => {
      overrides[r.product_id] = { price: r.price === null ? null : Number(r.price), outOfStockSizes: [] };
    });
    stockRows.forEach((r) => {
      if (!overrides[r.product_id]) overrides[r.product_id] = { price: null, outOfStockSizes: [] };
      if (r.quantity <= 0) overrides[r.product_id].outOfStockSizes.push(r.size);
    });

    res.setHeader("Cache-Control", "public, max-age=30");
    res.status(200).json({ overrides });
  } catch (err) {
    res.status(200).json({ overrides: {} });
  }
};
