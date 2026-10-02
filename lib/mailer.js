// Envoi d'e-mails via Resend (API HTTP directe, pas de dépendance npm
// supplémentaire). Se dégrade proprement si RESEND_API_KEY n'est pas
// configurée : les appelants doivent gérer { sent: false }.

async function sendMail({ to, subject, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[mailer] RESEND_API_KEY manquante — e-mail non envoyé :", subject);
    return { sent: false, reason: "resend_not_configured" };
  }

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
        // Les réponses des clients arrivent sur une vraie boîte (l'adresse
        // d'envoi @aelenparis.com n'a pas forcément de boîte de réception).
        reply_to: replyTo || process.env.CONTACT_REPLY_TO || undefined,
      }),
    });
    if (!response.ok) {
      // Visible dans les logs Vercel : typiquement un domaine d'envoi non
      // vérifié (l'expéditeur de test onboarding@resend.dev ne livre qu'au
      // propriétaire du compte Resend).
      const detail = await response.text().catch(() => "");
      console.error(`[mailer] Resend ${response.status} pour "${subject}" :`, detail.slice(0, 500));
      return { sent: false, reason: "resend_error" };
    }
    return { sent: true };
  } catch (err) {
    console.error("[mailer] Erreur réseau Resend :", err && err.message);
    return { sent: false, reason: "resend_error" };
  }
}

// Échappe le texte saisi par un visiteur avant de l'insérer dans un e-mail HTML.
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = { sendMail, escapeHtml };
