const { getSql } = require("../../db.js");
const { requireStaff } = require("../../staffSession.js");
const PRODUCTS = require("../../../assets/js/products-data.js");

// Crée une commande factice (sans paiement réel) pour que le staff puisse
// tester le suivi de commande, les e-mails et le flux de retour de bout
// en bout. L'identifiant de session Stripe est préfixé "test_" pour que
// le dashboard staff affiche un badge "Test" sur ces commandes.
module.exports = async (req, res) => {
  if (await requireStaff(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
  const size = product.sizes && product.sizes.length ? product.sizes[Math.floor(Math.random() * product.sizes.length)] : null;
  const unitPriceCents = Math.round(product.price * 100);
  const customerEmail = `demo+test${Date.now()}@aelenparis.fr`;
  const stripeSessionId = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const sql = await getSql();
    const { rows } = await sql`
      INSERT INTO orders (stripe_session_id, customer_email, amount_total, currency, status)
      VALUES (${stripeSessionId}, ${customerEmail}, ${unitPriceCents}, 'eur', 'paid')
      RETURNING id;
    `;
    const orderId = rows[0].id;
    await sql`
      INSERT INTO order_items (order_id, product_id, product_name, size, qty, unit_price)
      VALUES (${orderId}, ${product.id}, ${product.name}, ${size}, 1, ${unitPriceCents});
    `;
    res.status(200).json({ ok: true, orderId });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
};
