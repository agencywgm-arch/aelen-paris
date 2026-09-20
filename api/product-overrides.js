const { isConfigured, getSql } = require("../lib/db.js");

// Endpoint public (pas d'authentification) : expose les surcharges de prix
// et de stock définies depuis le dashboard staff, pour que la boutique les
// applique à l'affichage. Se dégrade en objet vide si la base n'est pas
// configurée — le site retombe alors sur les prix statiques du catalogue.
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
    const { rows } = await sql`SELECT product_id, price, out_of_stock_sizes FROM product_overrides;`;
    const overrides = {};
    rows.forEach((r) => {
      overrides[r.product_id] = {
        price: r.price === null ? null : Number(r.price),
        outOfStockSizes: r.out_of_stock_sizes || [],
      };
    });
    res.setHeader("Cache-Control", "public, max-age=30");
    res.status(200).json({ overrides });
  } catch (err) {
    res.status(200).json({ overrides: {} });
  }
};
