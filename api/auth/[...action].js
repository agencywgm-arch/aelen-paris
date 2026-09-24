// Route dynamique "catch-all" pour /api/auth/* — voir api/staff/[...action].js
// pour l'explication (limite de 12 fonctions sur le plan Hobby Vercel).
const { firstPathSegment } = require("../../lib/catchAllRoute.js");

const handlers = {
  "request-link": require("../../lib/handlers/auth/request-link.js"),
  verify: require("../../lib/handlers/auth/verify.js"),
  logout: require("../../lib/handlers/auth/logout.js"),
};

module.exports = async (req, res) => {
  const name = firstPathSegment(req, "/api/auth/");
  const handler = handlers[name];
  if (!handler) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  return handler(req, res);
};
