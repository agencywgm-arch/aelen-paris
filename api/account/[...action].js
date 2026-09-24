// Route dynamique "catch-all" pour /api/account/* — voir api/staff/[...action].js
// pour l'explication (limite de 12 fonctions sur le plan Hobby Vercel).
const { firstPathSegment } = require("../../lib/catchAllRoute.js");

const handlers = {
  me: require("../../lib/handlers/account/me.js"),
  orders: require("../../lib/handlers/account/orders.js"),
};

module.exports = async (req, res) => {
  const name = firstPathSegment(req, "/api/account/");
  const handler = handlers[name];
  if (!handler) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  return handler(req, res);
};
