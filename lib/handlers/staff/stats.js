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

    const { rows: totals } = await sql`
      SELECT
        COUNT(*) AS order_count,
        COALESCE(SUM(amount_total), 0) AS revenue,
        COALESCE(AVG(amount_total), 0) AS avg_order_value
      FROM orders;
    `;

    const { rows: topProducts } = await sql`
      SELECT product_id, product_name, SUM(qty) AS total_qty
      FROM order_items
      GROUP BY product_id, product_name
      ORDER BY total_qty DESC
      LIMIT 5;
    `;

    const { rows: recentCounts } = await sql`
      SELECT COUNT(*) AS count
      FROM orders
      WHERE created_at > now() - interval '30 days';
    `;

    const t = totals[0];
    res.status(200).json({
      orderCount: Number(t.order_count),
      revenue: Number(t.revenue),
      avgOrderValue: Math.round(Number(t.avg_order_value)),
      ordersLast30Days: Number(recentCounts[0].count),
      topProducts: topProducts.map((p) => ({
        productId: p.product_id,
        productName: p.product_name,
        totalQty: Number(p.total_qty),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
};
