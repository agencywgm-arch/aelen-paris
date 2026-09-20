const { isConfigured, getSql } = require("../../db.js");
const { randomToken, SESSION_DAYS, setSessionCookie } = require("../../session.js");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const origin = req.headers.origin || `https://${req.headers.host}`;
  const failRedirect = `${origin}/index.html?account=expired`;

  if (!isConfigured()) {
    res.writeHead(302, { Location: failRedirect });
    res.end();
    return;
  }

  const token = req.query && req.query.token;
  if (!token || typeof token !== "string") {
    res.writeHead(302, { Location: failRedirect });
    res.end();
    return;
  }

  try {
    const sql = await getSql();
    const { rows } = await sql`
      SELECT email, expires_at, used_at FROM magic_link_tokens WHERE token = ${token};
    `;
    const row = rows[0];

    if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
      res.writeHead(302, { Location: failRedirect });
      res.end();
      return;
    }

    await sql`UPDATE magic_link_tokens SET used_at = now() WHERE token = ${token};`;

    const sessionToken = randomToken();
    const sessionExpires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await sql`
      INSERT INTO sessions (token, email, expires_at)
      VALUES (${sessionToken}, ${row.email}, ${sessionExpires.toISOString()});
    `;

    setSessionCookie(res, sessionToken);
    res.writeHead(302, { Location: `${origin}/index.html?account=1` });
    res.end();
  } catch (err) {
    res.writeHead(302, { Location: failRedirect });
    res.end();
  }
};
