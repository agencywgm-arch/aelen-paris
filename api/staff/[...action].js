// Route dynamique "catch-all" : regroupe tous les endpoints /api/staff/*
// dans une seule Vercel Function pour rester sous la limite de 12
// fonctions du plan Hobby. Chaque sous-route garde exactement le même
// chemin public (/api/staff/orders, /api/staff/login, ...), seule
// l'organisation des fichiers source change.
const { firstPathSegment } = require("../../lib/catchAllRoute.js");

const handlers = {
  login: require("../../lib/handlers/staff/login.js"),
  logout: require("../../lib/handlers/staff/logout.js"),
  me: require("../../lib/handlers/staff/me.js"),
  orders: require("../../lib/handlers/staff/orders.js"),
  customers: require("../../lib/handlers/staff/customers.js"),
  messages: require("../../lib/handlers/staff/messages.js"),
  stats: require("../../lib/handlers/staff/stats.js"),
  products: require("../../lib/handlers/staff/products.js"),
  returns: require("../../lib/handlers/staff/returns.js"),
  invoice: require("../../lib/handlers/staff/invoice.js"),
  waitlist: require("../../lib/handlers/staff/waitlist.js"),
};

module.exports = async (req, res) => {
  const name = firstPathSegment(req, "/api/staff/");
  const handler = handlers[name];
  if (!handler) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  return handler(req, res);
};
