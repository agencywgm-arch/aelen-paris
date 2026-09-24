const { getSql } = require("../../db.js");
const { requireStaff } = require("../../staffSession.js");

module.exports = async (req, res) => {
  if (await requireStaff(req, res)) return;

  const sql = await getSql();

  if (req.method === "GET") {
    try {
      const { rows: entries } = await sql`
        SELECT id, email, created_at FROM waitlist_entries ORDER BY created_at DESC LIMIT 500;
      `;
      const { rows: settingRows } = await sql`SELECT value FROM site_settings WHERE key = 'waitlist_launch_at';`;
      res.status(200).json({
        entries: entries.map((e) => ({ id: e.id, email: e.email, createdAt: e.created_at })),
        count: entries.length,
        launchAt: settingRows[0] ? settingRows[0].value : null,
      });
    } catch (err) {
      res.status(500).json({ error: "server_error" });
    }
    return;
  }

  if (req.method === "PUT") {
    const launchAt = req.body && typeof req.body.launchAt === "string" ? req.body.launchAt.trim() : "";
    try {
      if (launchAt) {
        const parsed = new Date(launchAt);
        if (Number.isNaN(parsed.getTime())) {
          res.status(400).json({ error: "invalid_date" });
          return;
        }
        await sql`
          INSERT INTO site_settings (key, value) VALUES ('waitlist_launch_at', ${parsed.toISOString()})
          ON CONFLICT (key) DO UPDATE SET value = ${parsed.toISOString()};
        `;
      } else {
        await sql`DELETE FROM site_settings WHERE key = 'waitlist_launch_at';`;
      }
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "server_error" });
    }
    return;
  }

  res.status(405).json({ error: "method_not_allowed" });
};
