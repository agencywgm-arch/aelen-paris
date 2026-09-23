const { getSql } = require("../../db.js");
const { requireStaff } = require("../../staffSession.js");

module.exports = async (req, res) => {
  if (await requireStaff(req, res)) return;

  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const sql = await getSql();
    const { rows } = await sql`
      SELECT
        customer_email AS email,
        COUNT(*) AS order_count,
        SUM(amount_total) AS total_spent,
        MAX(created_at) AS last_order_at,
        MIN(created_at) AS first_order_at
      FROM orders
      GROUP BY customer_email
      ORDER BY last_order_at DESC;
    `;

    const customers = rows.map((r) => ({
      email: r.email,
      orderCount: Number(r.order_count),
      totalSpent: Number(r.total_spent),
      lastOrderAt: r.last_order_at,
      firstOrderAt: r.first_order_at,
    }));

    res.status(200).json({ customers });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
};
