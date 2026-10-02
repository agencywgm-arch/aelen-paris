const { getSql } = require("../../db.js");
const { requireStaff } = require("../../staffSession.js");

// Historique complet des précommandes (liste d'attente avec panier joint),
// de la plus récente à la plus ancienne. Chaque validation est une ligne :
// un client qui précommande deux fois apparaît deux fois.
module.exports = async (req, res) => {
  if (await requireStaff(req, res)) return;

  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const sql = await getSql();
    const { rows } = await sql`
      SELECT id, email, phone, cart, total, created_at
      FROM preorders
      ORDER BY created_at DESC
      LIMIT 1000;
    `;
    res.status(200).json({
      preorders: rows.map((r) => ({
        id: r.id,
        email: r.email,
        phone: r.phone,
        cart: Array.isArray(r.cart) ? r.cart : [],
        total: r.total,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
};
