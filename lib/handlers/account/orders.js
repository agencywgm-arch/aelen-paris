const { getSql } = require("../../db.js");
const { getSessionEmail } = require("../../session.js");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
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
      SELECT id, stripe_session_id, amount_total, currency, status, created_at
      FROM orders
      WHERE customer_email = ${email}
      ORDER BY created_at DESC;
    `;

    if (orders.length === 0) {
      res.status(200).json({ orders: [] });
      return;
    }

    const orderIds = orders.map((o) => o.id);
    const { rows: items } = await sql`
      SELECT order_id, product_id, product_name, size, qty, unit_price
      FROM order_items
      WHERE order_id = ANY(${orderIds}::int[]);
    `;

    const itemsByOrder = {};
    items.forEach((item) => {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    });

    const result = orders.map((o) => ({
      id: o.id,
      status: o.status,
      amountTotal: o.amount_total,
      currency: o.currency,
      createdAt: o.created_at,
      items: itemsByOrder[o.id] || [],
    }));

    res.status(200).json({ orders: result });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
};
