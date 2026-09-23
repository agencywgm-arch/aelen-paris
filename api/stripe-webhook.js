const Stripe = require("stripe");
const { isConfigured, getSql } = require("../lib/db.js");

// Stripe a besoin du corps brut (non parsé) pour vérifier la signature.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecretKey || !webhookSecret) {
    res.status(500).json({ error: "stripe_not_configured" });
    return;
  }
  if (!isConfigured()) {
    res.status(500).json({ error: "db_not_configured" });
    return;
  }

  const stripe = Stripe(stripeSecretKey);
  const rawBody = await readRawBody(req);
  const signature = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    res.status(400).json({ error: "invalid_signature" });
    return;
  }

  if (event.type !== "checkout.session.completed") {
    res.status(200).json({ received: true });
    return;
  }

  const session = event.data.object;
  const customerEmail = session.customer_details && session.customer_details.email;

  if (!customerEmail) {
    res.status(200).json({ received: true });
    return;
  }

  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ["data.price.product"],
      limit: 100,
    });

    const sql = await getSql();
    const { rows } = await sql`
      INSERT INTO orders (stripe_session_id, customer_email, amount_total, currency, status)
      VALUES (${session.id}, ${customerEmail}, ${session.amount_total}, ${session.currency}, ${session.payment_status})
      ON CONFLICT (stripe_session_id) DO NOTHING
      RETURNING id;
    `;

    if (rows.length > 0) {
      const orderId = rows[0].id;
      for (const item of lineItems.data) {
        const product = item.price.product;
        const metadata = (product && product.metadata) || {};
        await sql`
          INSERT INTO order_items (order_id, product_id, product_name, size, qty, unit_price)
          VALUES (
            ${orderId},
            ${metadata.productId || ""},
            ${product ? product.name : "Article"},
            ${metadata.size || ""},
            ${item.quantity},
            ${item.price.unit_amount}
          );
        `;
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
};
