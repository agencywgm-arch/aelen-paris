const { isConfigured, getSql } = require("../lib/db.js");
const { sendMail, escapeHtml } = require("../lib/mailer.js");
const { priceCart, formatEuros } = require("../lib/cartPricing.js");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Endpoint public : GET renvoie la date de lancement (pour le compte à
// rebours), POST inscrit un e-mail sur la liste d'attente. Si le visiteur
// arrive depuis son panier (« Précommander »), le panier est joint à
// l'inscription : c'est sa précommande, sans paiement immédiat.
module.exports = async (req, res) => {
  if (req.method === "GET") {
    if (!isConfigured()) {
      res.status(200).json({ launchAt: null });
      return;
    }
    try {
      const sql = await getSql();
      const { rows } = await sql`SELECT value FROM site_settings WHERE key = 'waitlist_launch_at';`;
      // Servi depuis le cache du CDN Vercel (rapide partout), rafraîchi en arrière-plan :
      // un changement de date depuis l'espace staff est visible en moins d'une minute.
      res.setHeader("Cache-Control", "public, max-age=20, s-maxage=30, stale-while-revalidate=300");
      res.status(200).json({ launchAt: rows[0] ? rows[0].value : null });
    } catch (err) {
      res.status(200).json({ launchAt: null });
    }
    return;
  }

  if (req.method === "POST") {
    if (!isConfigured()) {
      res.status(500).json({ error: "db_not_configured" });
      return;
    }
    const email = req.body && typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: "invalid_email" });
      return;
    }
    // Le téléphone est demandé avec une précommande (pour recontacter le client
    // et retrouver son historique) ; facultatif pour une simple inscription.
    const phone = typeof req.body.phone === "string" ? req.body.phone.trim().slice(0, 30) : "";
    const phoneDigits = phone.replace(/\D/g, "");
    const phoneValid = /^[+\d\s().-]+$/.test(phone) && phoneDigits.length >= 6 && phoneDigits.length <= 15;
    const wantsPreorder = Array.isArray(req.body.items) && req.body.items.length > 0;
    if ((wantsPreorder || phone) && !phoneValid) {
      res.status(400).json({ error: "invalid_phone" });
      return;
    }
    try {
      const sql = await getSql();

      const hasCart = Array.isArray(req.body.items) && req.body.items.length > 0;
      let cart = null;
      if (hasCart) {
        cart = await priceCart(sql, req.body.items);
        if (cart.unavailable.length > 0) {
          res.status(409).json({ error: "unavailable", items: cart.unavailable });
          return;
        }
        if (cart.lines.length === 0) {
          res.status(400).json({ error: "no_valid_items" });
          return;
        }
      }

      if (cart) {
        // Dernier panier + téléphone sur la fiche d'inscription…
        await sql`
          INSERT INTO waitlist_entries (email, phone, cart, cart_total, cart_updated_at)
          VALUES (${email}, ${phone}, ${JSON.stringify(cart.lines)}::jsonb, ${cart.total}, now())
          ON CONFLICT (email) DO UPDATE
            SET phone = EXCLUDED.phone, cart = EXCLUDED.cart, cart_total = EXCLUDED.cart_total, cart_updated_at = now();
        `;
        // …et une ligne d'historique par précommande (jamais écrasée).
        await sql`
          INSERT INTO preorders (email, phone, cart, total)
          VALUES (${email}, ${phone}, ${JSON.stringify(cart.lines)}::jsonb, ${cart.total});
        `;
      } else if (phone) {
        await sql`
          INSERT INTO waitlist_entries (email, phone) VALUES (${email}, ${phone})
          ON CONFLICT (email) DO UPDATE SET phone = EXCLUDED.phone;
        `;
      } else {
        await sql`INSERT INTO waitlist_entries (email) VALUES (${email}) ON CONFLICT (email) DO NOTHING;`;
      }

      const itemsHtml = cart
        ? `<ul>${cart.lines
            .map((l) => `<li>${l.qty} × ${escapeHtml(l.productName)}${l.size ? ` — Taille ${escapeHtml(l.size)}` : ""} : ${formatEuros(l.unitPrice * l.qty)}</li>`)
            .join("")}</ul><p><strong>Total : ${formatEuros(cart.total)}</strong></p>`
        : "";

      const customerMail = sendMail({
        to: email,
        subject: cart ? "Votre précommande est enregistrée — Ælen Paris" : "Vous êtes sur la liste d'attente — Ælen Paris",
        html: cart
          ? `
          <p>Bonjour,</p>
          <p>Merci ! Votre précommande est bien enregistrée avec votre inscription à la liste d'attente :</p>
          ${itemsHtml}
          <p>Aucun paiement n'a été prélevé. Nous vous recontactons par e-mail ou au ${escapeHtml(phone)} pour finaliser votre commande.</p>
          <p>À très vite,<br>L'équipe Ælen Paris</p>
        `
          : `
          <p>Bonjour,</p>
          <p>Merci de votre intérêt pour Ælen Paris. Vous êtes bien inscrit·e sur notre liste d'attente :
          vous serez averti·e en priorité lors de notre prochain lancement.</p>
          <p>À très vite,<br>L'équipe Ælen Paris</p>
        `,
      });

      const notifyTo = process.env.CONTACT_NOTIFY_EMAIL;
      const staffMail =
        cart && notifyTo
          ? sendMail({
              to: notifyTo,
              subject: `Nouvelle précommande — ${formatEuros(cart.total)}`,
              html: `<p><strong>${escapeHtml(email)}</strong><br>Tél. : ${escapeHtml(phone)}</p><p>a précommandé :</p>${itemsHtml}<p>À retrouver dans l'espace staff, onglet Précommandes.</p>`,
              replyTo: email,
            })
          : null;

      const [customerResult] = await Promise.all([customerMail, staffMail]);
      res.status(200).json({
        ok: true,
        preorder: cart ? { count: cart.lines.reduce((n, l) => n + l.qty, 0), total: cart.total } : null,
        emailSent: Boolean(customerResult && customerResult.sent),
      });
    } catch (err) {
      console.error("[waitlist] Erreur :", err && err.message);
      res.status(500).json({ error: "server_error" });
    }
    return;
  }

  res.status(405).json({ error: "method_not_allowed" });
};
