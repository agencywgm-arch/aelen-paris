const { isConfigured } = require("../../lib/db.js");
const {
  isStaffPasswordConfigured,
  passwordMatches,
  createStaffSession,
  setStaffSessionCookie,
} = require("../../lib/staffSession.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  if (!isConfigured()) {
    res.status(500).json({ error: "db_not_configured" });
    return;
  }
  if (!isStaffPasswordConfigured()) {
    res.status(500).json({ error: "staff_not_configured" });
    return;
  }

  const password = req.body && req.body.password;
  if (!password || !passwordMatches(password)) {
    res.status(401).json({ error: "invalid_password" });
    return;
  }

  try {
    const token = await createStaffSession();
    setStaffSessionCookie(res, token);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
};
