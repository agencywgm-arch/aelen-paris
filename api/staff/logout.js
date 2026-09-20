const {
  getStaffSessionToken,
  destroyStaffSession,
  clearStaffSessionCookie,
} = require("../../lib/staffSession.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const token = getStaffSessionToken(req);
  try {
    await destroyStaffSession(token);
  } catch (err) {
    // On déconnecte quand même côté cookie même si la suppression en base échoue.
  }
  clearStaffSessionCookie(res);
  res.status(200).json({ ok: true });
};
