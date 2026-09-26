const { isConfigured, getSql } = require("../lib/db.js");
const { sendMail } = require("../lib/mailer.js");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Endpoint public : GET renvoie la date de lancement (pour le compte à
// rebours), POST inscrit un e-mail sur la liste d'attente.
module.exports = async (req, res) => {
  if (req.method === "GET") {
    if (!isConfigured()) {
      res.status(200).json({ launchAt: null });
      return;
    }
    try {
      const sql = await getSql();
      const { rows } = await sql`SELECT value FROM site_settings WHERE key = 'waitlist_launch_at';`;
      res.setHeader("Cache-Control", "public, max-age=30");
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
    try {
      const sql = await getSql();
      await sql`INSERT INTO waitlist_entries (email) VALUES (${email}) ON CONFLICT (email) DO NOTHING;`;
      await sendMail({
        to: email,
        subject: "Vous êtes sur la liste d'attente — Ælen Paris",
        html: `
          <p>Bonjour,</p>
          <p>Merci de votre intérêt pour Ælen Paris. Vous êtes bien inscrit·e sur notre liste d'attente :
          vous serez averti·e en priorité lors de notre prochain lancement.</p>
          <p>À très vite,<br>L'équipe Ælen Paris</p>
        `,
      });
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "server_error" });
    }
    return;
  }

  res.status(405).json({ error: "method_not_allowed" });
};
