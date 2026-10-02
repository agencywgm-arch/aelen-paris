const crypto = require("crypto");
const PRODUCTS = require("../assets/js/products-data.js");
const { isConfigured, getSql } = require("../lib/db.js");
const { sendMail, escapeHtml } = require("../lib/mailer.js");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatEuros(cents) {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

// Fonction serverless Vercel : enregistre une précommande SANS paiement.
// Le client laisse ses coordonnées (nom, e-mail, téléphone), la commande
// apparaît dans le dashboard staff avec le statut « preorder », le client
// reçoit un e-mail de confirmation et l'équipe est notifiée. Le règlement
// est demandé plus tard (Stripe reste branchable via create-checkout-session).
// Comme pour Stripe, les prix et le stock sont relus côté serveur : jamais
// ceux envoyés par le navigateur.
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  if (!isConfigured()) {
    res.status(500).json({ error: "db_not_configured" });
    return;
  }

  const body = req.body || {};

  // Pot de miel anti-robots : champ invisible pour un humain.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    res.status(200).json({ ok: true });
    return;
  }

  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 120) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 30) : "";
  const phoneDigits = phone.replace(/\D/g, "");

  if (name.length < 2) {
    res.status(400).json({ error: "invalid_name" });
    return;
  }
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "invalid_email" });
    return;
  }
  if (!/^[+\d\s().-]+$/.test(phone) || phoneDigits.length < 6 || phoneDigits.length > 15) {
    res.status(400).json({ error: "invalid_phone" });
    return;
  }

  const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  if (items.length === 0) {
    res.status(400).json({ error: "empty_cart" });
    return;
  }

  try {
    const sql = await getSql();

    const [{ rows: priceRows }, { rows: stockRows }] = await Promise.all([
      sql`SELECT product_id, price FROM product_overrides;`,
      sql`SELECT product_id, size, quantity FROM product_stock;`,
    ]);
    const priceOverrides = {};
    priceRows.forEach((r) => {
      priceOverrides[r.product_id] = r.price === null ? null : Number(r.price);
    });
    const stockByKey = {}; // "productId|size" -> quantité restante, absent = non suivi (illimité)
    stockRows.forEach((r) => {
      stockByKey[`${r.product_id}|${r.size}`] = r.quantity;
    });

    // Regroupe les doublons (même produit + même taille) avant de contrôler le stock.
    const merged = new Map();
    for (const entry of items) {
      if (!entry || typeof entry.id !== "string") continue;
      const size = typeof entry.size === "string" ? entry.size.slice(0, 10) : "";
      const qty = Math.max(1, Math.min(20, parseInt(entry.qty, 10) || 1));
      const key = `${entry.id}|${size}`;
      merged.set(key, { id: entry.id, size, qty: Math.min(20, (merged.get(key)?.qty || 0) + qty) });
    }

    const lines = [];
    const unavailable = [];
    for (const { id, size, qty } of merged.values()) {
      const product = PRODUCTS.find((p) => p.id === id);
      if (!product || typeof product.price !== "number") {
        unavailable.push({ id, size, reason: "unknown_product" });
        continue;
      }
      if (product.sizes && product.sizes.length && !product.sizes.includes(size)) {
        unavailable.push({ id, size, name: product.name, reason: "invalid_size" });
        continue;
      }
      const tracked = stockByKey[`${id}|${size}`];
      if (tracked !== undefined && tracked < qty) {
        unavailable.push({ id, size, name: product.name, reason: "out_of_stock", remaining: Math.max(0, tracked) });
        continue;
      }
      const unitPrice = priceOverrides[id] != null ? priceOverrides[id] : product.price;
      lines.push({ product, size, qty, unitCents: Math.round(unitPrice * 100) });
    }

    if (unavailable.length > 0) {
      res.status(409).json({ error: "unavailable", items: unavailable });
      return;
    }
    if (lines.length === 0) {
      res.status(400).json({ error: "no_valid_items" });
      return;
    }

    const total = lines.reduce((sum, l) => sum + l.unitCents * l.qty, 0);
    const reference = `preorder_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const { rows } = await sql`
      INSERT INTO orders (stripe_session_id, customer_email, customer_name, customer_phone, amount_total, currency, status)
      VALUES (${reference}, ${email}, ${name}, ${phone}, ${total}, 'eur', 'preorder')
      RETURNING id;
    `;
    const orderId = rows[0].id;

    for (const l of lines) {
      await sql`
        INSERT INTO order_items (order_id, product_id, product_name, size, qty, unit_price)
        VALUES (${orderId}, ${l.product.id}, ${l.product.name}, ${l.size}, ${l.qty}, ${l.unitCents});
      `;
      // Réserve la pièce : décrémente le stock si cette taille est suivie
      // (sans ligne dans product_stock, le stock est illimité).
      await sql`
        UPDATE product_stock SET quantity = GREATEST(quantity - ${l.qty}, 0), updated_at = now()
        WHERE product_id = ${l.product.id} AND size = ${l.size};
      `;
    }

    const itemsHtml = lines
      .map((l) => `<li>${l.qty} × ${escapeHtml(l.product.name)}${l.size ? ` — Taille ${escapeHtml(l.size)}` : ""} : ${formatEuros(l.unitCents * l.qty)}</li>`)
      .join("");

    const customerMail = sendMail({
      to: email,
      subject: `Votre précommande n°${orderId} — Ælen Paris`,
      html: `
        <p>Bonjour ${escapeHtml(name)},</p>
        <p>Merci ! Votre précommande <strong>n°${orderId}</strong> est bien enregistrée :</p>
        <ul>${itemsHtml}</ul>
        <p><strong>Total : ${formatEuros(total)}</strong></p>
        <p>Aucun paiement n'a été prélevé. Votre pièce vous est réservée : notre équipe vous recontacte
        très vite par e-mail ou au ${escapeHtml(phone)} pour finaliser le règlement et la livraison.</p>
        <p>À très vite,<br>L'équipe Ælen Paris</p>
      `,
    });

    const notifyTo = process.env.CONTACT_NOTIFY_EMAIL;
    const staffMail = notifyTo
      ? sendMail({
          to: notifyTo,
          subject: `Nouvelle précommande n°${orderId} — ${formatEuros(total)}`,
          html: `
            <p><strong>Nouvelle précommande n°${orderId}</strong></p>
            <p>${escapeHtml(name)}<br>${escapeHtml(email)}<br>${escapeHtml(phone)}</p>
            <ul>${itemsHtml}</ul>
            <p><strong>Total : ${formatEuros(total)}</strong></p>
            <p>À retrouver dans l'espace staff, onglet Commandes.</p>
          `,
          replyTo: email,
        })
      : Promise.resolve({ sent: false });

    const [customerResult] = await Promise.all([customerMail, staffMail]);
    if (customerResult.sent) {
      await sql`UPDATE orders SET confirmation_sent_at = now() WHERE id = ${orderId};`;
    }

    res.status(200).json({ ok: true, orderId, total, emailSent: Boolean(customerResult.sent) });
  } catch (err) {
    console.error("[preorder] Erreur :", err && err.message);
    res.status(500).json({ error: "server_error" });
  }
};
