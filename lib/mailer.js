// Envoi d'e-mails via Resend (API HTTP directe, pas de dépendance npm
// supplémentaire). Se dégrade proprement si RESEND_API_KEY n'est pas
// configurée : les appelants doivent gérer { sent: false }.

async function sendMail({ to, subject, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "resend_not_configured" };

  const from = process.env.CONTACT_FROM_EMAIL || "Ælen Paris <onboarding@resend.dev>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        reply_to: replyTo || undefined,
      }),
    });
    if (!response.ok) return { sent: false, reason: "resend_error" };
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: "resend_error" };
  }
}

module.exports = { sendMail };
