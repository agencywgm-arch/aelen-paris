const { getSql } = require("../../db.js");
const { requireStaff } = require("../../staffSession.js");
const { buildInvoicePdfBuffer } = require("../../invoice.js");

// Facture PDF pour le staff — accès à n'importe quelle commande.
module.exports = async (req, res) => {
  if (await requireStaff(req, res)) return;
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const orderId = parseInt(req.query.orderId, 10);
  if (!orderId) {
    res.status(400).json({ error: "invalid_order_id" });
    return;
  }

  try {
    const sql = await getSql();
    const { rows: orders } = await sql`
      SELECT id, customer_email, amount_total, currency, created_at
      FROM orders WHERE id = ${orderId};
    `;
    if (orders.length === 0) {
      res.status(404).json({ error: "order_not_found" });
      return;
    }

    const { rows: items } = await sql`
      SELECT product_name, size, qty, unit_price FROM order_items WHERE order_id = ${orderId};
    `;

    const pdf = await buildInvoicePdfBuffer(orders[0], items);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="facture-aelen-${orderId}.pdf"`);
    res.status(200).send(pdf);
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
};
