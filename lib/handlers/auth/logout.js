const { isConfigured, getSql } = require("../../db.js");
const { getSessionToken, clearSessionCookie } = require("../../session.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const token = getSessionToken(req);
  if (token && isConfigured()) {
    try {
      const sql = await getSql();
      await sql`DELETE FROM sessions WHERE token = ${token};`;
    } catch (err) {
      // on efface quand même le cookie côté client
    }
  }

  clearSessionCookie(res);
  res.status(200).json({ ok: true });
};
