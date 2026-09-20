const { getSql } = require("../../db.js");
const { requireStaff } = require("../../staffSession.js");
const PRODUCTS = require("../../../assets/js/products-data.js");

module.exports = async (req, res) => {
  if (await requireStaff(req, res)) return;

  const sql = await getSql();

  if (req.method === "GET") {
    try {
      const { rows } = await sql`SELECT product_id, price, out_of_stock_sizes FROM product_overrides;`;
      const overrides = {};
      rows.forEach((r) => {
        overrides[r.product_id] = {
          price: r.price === null ? null : Number(r.price),
          outOfStockSizes: r.out_of_stock_sizes || [],
        };
      });

      const products = PRODUCTS.map((p) => {
        const o = overrides[p.id] || {};
        return {
          id: p.id,
          name: p.name,
          basePrice: p.price,
          price: o.price != null ? o.price : p.price,
          sizes: p.sizes || [],
          outOfStockSizes: o.outOfStockSizes || [],
        };
      });

      res.status(200).json({ products });
    } catch (err) {
      res.status(500).json({ error: "server_error" });
    }
    return;
  }

  if (req.method === "PUT") {
    const body = req.body || {};
    const productId = typeof body.productId === "string" ? body.productId : null;
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) {
      res.status(400).json({ error: "invalid_product_id" });
      return;
    }

    let price = null;
    if (body.price !== null && body.price !== undefined && body.price !== "") {
      price = Number(body.price);
      if (!Number.isFinite(price) || price <= 0) {
        res.status(400).json({ error: "invalid_price" });
        return;
      }
    }

    const validSizes = new Set(product.sizes || []);
    const outOfStockSizes = Array.isArray(body.outOfStockSizes)
      ? body.outOfStockSizes.filter((s) => validSizes.has(s))
      : [];

    try {
      await sql`
        INSERT INTO product_overrides (product_id, price, out_of_stock_sizes, updated_at)
        VALUES (${productId}, ${price}, ${outOfStockSizes}, now())
        ON CONFLICT (product_id) DO UPDATE
          SET price = ${price}, out_of_stock_sizes = ${outOfStockSizes}, updated_at = now();
      `;
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "server_error" });
    }
    return;
  }

  res.status(405).json({ error: "method_not_allowed" });
};
