// Route dynamique "catch-all" pour /api/account/* — voir api/staff/[...action].js
// pour l'explication (limite de 12 fonctions sur le plan Hobby Vercel).
const handlers = {
  me: require("../../lib/handlers/account/me.js"),
  orders: require("../../lib/handlers/account/orders.js"),
};

module.exports = async (req, res) => {
  const segments = req.query.action;
  const name = Array.isArray(segments) ? segments[0] : segments;
  const handler = handlers[name];
  if (!handler) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  return handler(req, res);
};
