const { getSql } = require("../../lib/db.js");
const { requireStaff } = require("../../lib/staffSession.js");
const { sendMail } = require("../../lib/mailer.js");

const ALLOWED_STATUSES = ["paid", "unpaid", "processing", "shipped", "delivered", "cancelled"];

module.exports = async (req, res) => {
  if (await requireStaff(req, res)) return;

  const sql = await getSql();

  if (req.method === "GET") {
    try {
      const { rows: orders } = await sql`
        SELECT id, stripe_session_id, customer_email, amount_total, currency, status,
               tracking_carrier, tracking_number, shipped_at, created_at
        FROM orders
        ORDER BY created_at DESC
        LIMIT 300;
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
        stripeSessionId: o.stripe_session_id,
        customerEmail: o.customer_email,
        status: o.status,
        amountTotal: o.amount_total,
        currency: o.currency,
        trackingCarrier: o.tracking_carrier,
        trackingNumber: o.tracking_number,
        shippedAt: o.shipped_at,
        createdAt: o.created_at,
        items: itemsByOrder[o.id] || [],
      }));

      res.status(200).json({ orders: result });
    } catch (err) {
      res.status(500).json({ error: "server_error" });
    }
    return;
  }

  if (req.method === "PATCH") {
    const body = req.body || {};
    const orderId = parseInt(body.orderId, 10);
    if (!orderId) {
      res.status(400).json({ error: "invalid_order_id" });
      return;
    }

    const status = typeof body.status === "string" ? body.status.trim() : null;
    if (status && !ALLOWED_STATUSES.includes(status)) {
      res.status(400).json({ error: "invalid_status" });
      return;
    }
    const trackingCarrier =
      typeof body.trackingCarrier === "string" ? body.trackingCarrier.trim().slice(0, 100) : null;
    const trackingNumber =
      typeof body.trackingNumber === "string" ? body.trackingNumber.trim().slice(0, 100) : null;

    try {
      const { rows: existingRows } = await sql`
        SELECT customer_email, tracking_number FROM orders WHERE id = ${orderId};
      `;
      if (existingRows.length === 0) {
        res.status(404).json({ error: "order_not_found" });
        return;
      }
      const previous = existingRows[0];
      const isNewTracking = trackingNumber && trackingNumber !== previous.tracking_number;

      const { rows } = await sql`
        UPDATE orders SET
          status = COALESCE(${status}, status),
          tracking_carrier = COALESCE(${trackingCarrier}, tracking_carrier),
          tracking_number = COALESCE(${trackingNumber}, tracking_number),
          shipped_at = CASE WHEN ${isNewTracking} THEN now() ELSE shipped_at END
        WHERE id = ${orderId}
        RETURNING id, customer_email, status, tracking_carrier, tracking_number, shipped_at;
      `;

      const updated = rows[0];

      if (isNewTracking) {
        await sendMail({
          to: updated.customer_email,
          subject: "Votre commande Ælen Paris est expédiée",
          html: `
            <p>Bonjour,</p>
            <p>Votre commande vient d'être expédiée${updated.tracking_carrier ? ` via ${updated.tracking_carrier}` : ""}.</p>
            <p>Numéro de suivi : <strong>${updated.tracking_number}</strong></p>
            <p>À très vite,<br>L'équipe Ælen Paris</p>
          `,
        });
      }

      res.status(200).json({
        ok: true,
        order: {
          id: updated.id,
          status: updated.status,
          trackingCarrier: updated.tracking_carrier,
          trackingNumber: updated.tracking_number,
          shippedAt: updated.shipped_at,
        },
      });
    } catch (err) {
      res.status(500).json({ error: "server_error" });
    }
    return;
  }

  res.status(405).json({ error: "method_not_allowed" });
};
