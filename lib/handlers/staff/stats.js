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

    // Chiffre d'affaires : commandes réellement encaissées (hors commandes de
    // test, annulées, non payées). Le nombre de commandes, lui, compte tout ce
    // qui apparaît dans la liste du staff.
    const { rows: totals } = await sql`
      SELECT
        COUNT(*) AS order_count,
        COUNT(*) FILTER (
          WHERE stripe_session_id NOT LIKE 'test\\_%' AND status NOT IN ('cancelled', 'unpaid', 'preorder')
        ) AS paid_count,
        COALESCE(SUM(amount_total) FILTER (
          WHERE stripe_session_id NOT LIKE 'test\\_%' AND status NOT IN ('cancelled', 'unpaid', 'preorder')
        ), 0) AS revenue,
        COUNT(*) FILTER (WHERE status IN ('paid', 'processing')) AS to_ship,
        COUNT(*) FILTER (WHERE created_at > now() - interval '30 days') AS last_30
      FROM orders;
    `;

    const { rows: topProducts } = await sql`
      SELECT product_id, product_name, SUM(qty) AS total_qty
      FROM order_items
      GROUP BY product_id, product_name
      ORDER BY total_qty DESC
      LIMIT 5;
    `;

    const { rows: preorders } = await sql`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(total), 0) AS total,
        COUNT(*) FILTER (WHERE created_at > now() - interval '30 days') AS last_30
      FROM preorders;
    `;
    const { rows: unread } = await sql`SELECT COUNT(*) AS count FROM contact_messages WHERE is_read = false;`;
    const { rows: openReturns } = await sql`SELECT COUNT(*) AS count FROM returns WHERE status IN ('requested', 'received');`;

    const t = totals[0];
    const paidCount = Number(t.paid_count);
    const revenue = Number(t.revenue);
    res.status(200).json({
      // Toutes les commandes affichées dans l'onglet Commandes : payées + précommandes.
      orderCount: Number(t.order_count) + Number(preorders[0].count),
      paidCount,
      revenue,
      avgOrderValue: paidCount ? Math.round(revenue / paidCount) : 0,
      ordersLast30Days: Number(t.last_30) + Number(preorders[0].last_30),
      preorderCount: Number(preorders[0].count),
      preorderTotal: Number(preorders[0].total),
      toShip: Number(t.to_ship),
      unreadMessages: Number(unread[0].count),
      openReturns: Number(openReturns[0].count),
      topProducts: topProducts.map((p) => ({
        productId: p.product_id,
        productName: p.product_name,
        totalQty: Number(p.total_qty),
      })),
    });
  } catch (err) {
    console.error("[staff/stats]", err && err.message);
    res.status(500).json({ error: "server_error" });
  }
};
