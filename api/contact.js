const { isConfigured, getSql } = require("../lib/db.js");
const { sendMail } = require("../lib/mailer.js");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";

  if (!name || !EMAIL_RE.test(email) || !message) {
    res.status(400).json({ error: "invalid_input" });
    return;
  }

  try {
    const sql = await getSql();
    await sql`
      INSERT INTO contact_messages (name, email, message)
      VALUES (${name}, ${email}, ${message});
    `;

    const notifyTo = process.env.CONTACT_NOTIFY_EMAIL;
    if (notifyTo) {
      await sendMail({
        to: notifyTo,
        subject: `Nouveau message de contact — ${name}`,
        html: `<p><strong>${name}</strong> (${email}) :</p><p>${message.replace(/\n/g, "<br>")}</p>`,
        replyTo: email,
      });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
};
