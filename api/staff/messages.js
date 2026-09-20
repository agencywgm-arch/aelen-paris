const { getSql } = require("../../lib/db.js");
const { requireStaff } = require("../../lib/staffSession.js");

module.exports = async (req, res) => {
  if (await requireStaff(req, res)) return;

  const sql = await getSql();

  if (req.method === "GET") {
    try {
      const { rows } = await sql`
        SELECT id, name, email, message, is_read, created_at
        FROM contact_messages
        ORDER BY created_at DESC
        LIMIT 300;
      `;
      res.status(200).json({
        messages: rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          message: r.message,
          isRead: r.is_read,
          createdAt: r.created_at,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "server_error" });
    }
    return;
  }

  if (req.method === "PATCH") {
    const id = parseInt(req.body && req.body.id, 10);
    if (!id) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    try {
      await sql`UPDATE contact_messages SET is_read = true WHERE id = ${id};`;
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "server_error" });
    }
    return;
  }

  res.status(405).json({ error: "method_not_allowed" });
};
