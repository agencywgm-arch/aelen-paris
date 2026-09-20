const { isConfigured } = require("../../lib/db.js");
const { isStaffPasswordConfigured, isStaffAuthenticated } = require("../../lib/staffSession.js");

// Endpoint léger utilisé par le dashboard au chargement pour savoir s'il
// doit afficher l'écran de connexion ou le tableau de bord directement.
module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  if (!isConfigured() || !isStaffPasswordConfigured()) {
    res.status(200).json({ authenticated: false, configured: false });
    return;
  }

  const authenticated = await isStaffAuthenticated(req);
  res.status(200).json({ authenticated, configured: true });
};
