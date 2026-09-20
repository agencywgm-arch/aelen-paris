const { isConfigured, getSql } = require("../../db.js");
const { sendMail } = require("../../mailer.js");
const { randomToken, LINK_MINUTES } = require("../../session.js");

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

  const email = req.body && typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "invalid_email" });
    return;
  }

  try {
    const sql = await getSql();
    const token = randomToken();
    const expiresAt = new Date(Date.now() + LINK_MINUTES * 60 * 1000);

    await sql`
      INSERT INTO magic_link_tokens (token, email, expires_at)
      VALUES (${token}, ${email}, ${expiresAt.toISOString()});
    `;

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const verifyUrl = `${origin}/api/auth/verify?token=${token}`;

    const mailResult = await sendMail({
      to: email,
      subject: "Votre lien de connexion — Ælen Paris",
      html: `
        <p>Bonjour,</p>
        <p>Cliquez sur le lien ci-dessous pour vous connecter à votre compte Ælen Paris. Ce lien expire dans ${LINK_MINUTES} minutes.</p>
        <p><a href="${verifyUrl}">Me connecter</a></p>
        <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
      `,
    });

    if (!mailResult.sent) {
      res.status(500).json({ error: "email_not_configured" });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
};
