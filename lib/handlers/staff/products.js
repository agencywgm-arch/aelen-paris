const { getSql } = require("../../db.js");
const { requireStaff } = require("../../staffSession.js");
const PRODUCTS = require("../../../assets/js/products-data.js");

module.exports = async (req, res) => {
  if (await requireStaff(req, res)) return;

  const sql = await getSql();

  if (req.method === "GET") {
    try {
      const { rows: overrideRows } = await sql`SELECT product_id, price FROM product_overrides;`;
      const priceOverrides = {};
      overrideRows.forEach((r) => {
        priceOverrides[r.product_id] = r.price === null ? null : Number(r.price);
      });

      const { rows: stockRows } = await sql`SELECT product_id, size, quantity FROM product_stock;`;
      const stockByProduct = {};
      stockRows.forEach((r) => {
        if (!stockByProduct[r.product_id]) stockByProduct[r.product_id] = {};
        stockByProduct[r.product_id][r.size] = r.quantity;
      });

      const products = PRODUCTS.map((p) => {
        const stock = {};
        (p.sizes || []).forEach((s) => {
          const tracked = stockByProduct[p.id] && stockByProduct[p.id][s];
          stock[s] = tracked === undefined ? null : tracked;
        });
        return {
          id: p.id,
          name: p.name,
          basePrice: p.price,
          price: priceOverrides[p.id] != null ? priceOverrides[p.id] : p.price,
          sizes: p.sizes || [],
          stock,
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
    const stock = body.stock && typeof body.stock === "object" ? body.stock : {};

    try {
      await sql`
        INSERT INTO product_overrides (product_id, price, updated_at)
        VALUES (${productId}, ${price}, now())
        ON CONFLICT (product_id) DO UPDATE SET price = ${price}, updated_at = now();
      `;

      for (const size of validSizes) {
        const raw = stock[size];
        if (raw === null || raw === undefined || raw === "") {
          await sql`DELETE FROM product_stock WHERE product_id = ${productId} AND size = ${size};`;
          continue;
        }
        const quantity = Math.max(0, parseInt(raw, 10) || 0);
        await sql`
          INSERT INTO product_stock (product_id, size, quantity, updated_at)
          VALUES (${productId}, ${size}, ${quantity}, now())
          ON CONFLICT (product_id, size) DO UPDATE SET quantity = ${quantity}, updated_at = now();
        `;
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "server_error" });
    }
    return;
  }

  res.status(405).json({ error: "method_not_allowed" });
};
