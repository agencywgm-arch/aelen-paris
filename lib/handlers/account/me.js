const { getSessionEmail } = require("../../session.js");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const email = await getSessionEmail(req);
    if (!email) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }
    res.status(200).json({ email });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
};
