const { getSql } = require("../../db.js");
const { getSessionEmail } = require("../../session.js");
const { buildInvoicePdfBuffer } = require("../../invoice.js");

// Facture PDF pour le client connecté — vérifie qu'il est bien
// propriétaire de la commande avant de générer quoi que ce soit.
module.exports = async (req, res) => {
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
    const email = await getSessionEmail(req);
    if (!email) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }

    const sql = await getSql();
    const { rows: orders } = await sql`
      SELECT id, customer_email, amount_total, currency, created_at
      FROM orders WHERE id = ${orderId} AND customer_email = ${email};
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
