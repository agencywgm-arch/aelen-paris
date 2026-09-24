const { getSql } = require("../../db.js");
const { requireStaff } = require("../../staffSession.js");
const { sendMail } = require("../../mailer.js");

const STATUSES = ["requested", "received", "refunded", "rejected"];

const EMAIL_BY_STATUS = {
  requested: {
    subject: "Votre demande de retour a bien été enregistrée",
    html: (r) => `
      <p>Bonjour,</p>
      <p>Nous avons bien enregistré votre demande de retour pour la commande n°${r.order_id}.</p>
      <p>Nous vous recontacterons dès réception de l'article.</p>
      <p>L'équipe Ælen Paris</p>
    `,
  },
  received: {
    subject: "Votre retour a bien été reçu",
    html: (r) => `
      <p>Bonjour,</p>
      <p>Nous avons bien reçu l'article retourné pour la commande n°${r.order_id}. Votre remboursement est en cours de traitement.</p>
      <p>L'équipe Ælen Paris</p>
    `,
  },
  refunded: {
    subject: "Votre remboursement a été effectué",
    html: (r) => `
      <p>Bonjour,</p>
      <p>Votre remboursement de ${(r.refund_amount / 100).toFixed(2)} € pour la commande n°${r.order_id} a été effectué. Il apparaîtra sur votre relevé bancaire sous quelques jours.</p>
      <p>L'équipe Ælen Paris</p>
    `,
  },
  rejected: {
    subject: "Concernant votre demande de retour",
    html: (r) => `
      <p>Bonjour,</p>
      <p>Après examen, nous ne sommes malheureusement pas en mesure de traiter votre demande de retour pour la commande n°${r.order_id}.</p>
      <p>N'hésitez pas à nous contacter pour toute question : contact@aelenparis.fr</p>
      <p>L'équipe Ælen Paris</p>
    `,
  },
};

async function notifyCustomer(sql, ret) {
  const { rows } = await sql`SELECT customer_email FROM orders WHERE id = ${ret.order_id};`;
  const email = rows[0] && rows[0].customer_email;
  if (!email) return;
  const template = EMAIL_BY_STATUS[ret.status];
  if (!template) return;
  await sendMail({ to: email, subject: template.subject, html: template.html(ret) });
}

async function refundViaStripe(orderId, refundAmount) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) return { refunded: false, reason: "stripe_not_configured" };

  const { getSql: getSqlInner } = require("../../db.js");
  const sql = await getSqlInner();
  const { rows } = await sql`SELECT stripe_session_id, stripe_payment_intent FROM orders WHERE id = ${orderId};`;
  const order = rows[0];
  if (!order) return { refunded: false, reason: "order_not_found" };

  const Stripe = require("stripe");
  const stripe = Stripe(stripeSecretKey);

  try {
    let paymentIntentId = order.stripe_payment_intent;
    if (!paymentIntentId) {
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      paymentIntentId = session.payment_intent;
      if (paymentIntentId) {
        await sql`UPDATE orders SET stripe_payment_intent = ${paymentIntentId} WHERE id = ${orderId};`;
      }
    }
    if (!paymentIntentId) return { refunded: false, reason: "no_payment_intent" };

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: refundAmount || undefined,
    });
    return { refunded: true, stripeRefundId: refund.id };
  } catch (err) {
    return { refunded: false, reason: "stripe_error" };
  }
}

module.exports = async (req, res) => {
  if (await requireStaff(req, res)) return;

  const sql = await getSql();

  if (req.method === "GET") {
    try {
      const { rows } = await sql`
        SELECT r.id, r.order_id, r.status, r.reason, r.refund_amount, r.stripe_refund_id,
               r.created_at, r.updated_at, o.customer_email, o.amount_total
        FROM returns r
        JOIN orders o ON o.id = r.order_id
        ORDER BY r.created_at DESC
        LIMIT 300;
      `;
      res.status(200).json({
        returns: rows.map((r) => ({
          id: r.id,
          orderId: r.order_id,
          status: r.status,
          reason: r.reason,
          refundAmount: r.refund_amount,
          stripeRefundId: r.stripe_refund_id,
          customerEmail: r.customer_email,
          orderAmount: r.amount_total,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "server_error" });
    }
    return;
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const orderId = parseInt(body.orderId, 10);
    if (!orderId) {
      res.status(400).json({ error: "invalid_order_id" });
      return;
    }
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 2000) : null;

    try {
      const { rows: orderRows } = await sql`SELECT amount_total FROM orders WHERE id = ${orderId};`;
      if (orderRows.length === 0) {
        res.status(404).json({ error: "order_not_found" });
        return;
      }
      const refundAmount =
        body.refundAmount != null && body.refundAmount !== ""
          ? Math.round(Number(body.refundAmount) * 100)
          : orderRows[0].amount_total;

      const { rows } = await sql`
        INSERT INTO returns (order_id, status, reason, refund_amount)
        VALUES (${orderId}, 'requested', ${reason}, ${refundAmount})
        RETURNING id, order_id, status, reason, refund_amount, created_at, updated_at;
      `;
      const ret = rows[0];
      await notifyCustomer(sql, ret);
      res.status(200).json({ ok: true, returnId: ret.id });
    } catch (err) {
      res.status(500).json({ error: "server_error" });
    }
    return;
  }

  if (req.method === "PATCH") {
    const body = req.body || {};
    const returnId = parseInt(body.returnId, 10);
    const status = typeof body.status === "string" ? body.status.trim() : null;
    if (!returnId || !status || !STATUSES.includes(status)) {
      res.status(400).json({ error: "invalid_input" });
      return;
    }

    try {
      const { rows: existingRows } = await sql`SELECT * FROM returns WHERE id = ${returnId};`;
      if (existingRows.length === 0) {
        res.status(404).json({ error: "return_not_found" });
        return;
      }
      const existing = existingRows[0];

      let stripeRefundId = existing.stripe_refund_id;
      if (status === "refunded" && !stripeRefundId) {
        const result = await refundViaStripe(existing.order_id, existing.refund_amount);
        if (!result.refunded) {
          res.status(500).json({ error: "refund_failed", reason: result.reason });
          return;
        }
        stripeRefundId = result.stripeRefundId;
      }

      const { rows } = await sql`
        UPDATE returns SET status = ${status}, stripe_refund_id = ${stripeRefundId}, updated_at = now()
        WHERE id = ${returnId}
        RETURNING id, order_id, status, reason, refund_amount, stripe_refund_id, created_at, updated_at;
      `;
      const ret = rows[0];
      await notifyCustomer(sql, ret);
      res.status(200).json({ ok: true, return: ret });
    } catch (err) {
      res.status(500).json({ error: "server_error" });
    }
    return;
  }

  res.status(405).json({ error: "method_not_allowed" });
};
