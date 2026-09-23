// Session du dashboard staff — entièrement séparée des sessions clientes
// (cookie et table distincts) pour ne jamais mélanger les deux espaces.

const crypto = require("crypto");

const COOKIE_NAME = "aelen_staff_session";
const SESSION_DAYS = 7;

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  });
  return out;
}

function setStaffSessionCookie(res, token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  );
}

function clearStaffSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
}

function getStaffSessionToken(req) {
  return parseCookies(req)[COOKIE_NAME] || null;
}

function isStaffPasswordConfigured() {
  return Boolean(process.env.STAFF_PASSWORD);
}

// Comparaison en temps constant pour éviter les attaques par timing sur
// le mot de passe staff.
function passwordMatches(candidate) {
  const expected = process.env.STAFF_PASSWORD || "";
  const a = Buffer.from(String(candidate || ""));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function createStaffSession() {
  const { getSql } = require("./db.js");
  const sql = await getSql();
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO staff_sessions (token, expires_at) VALUES (${token}, ${expiresAt.toISOString()});
  `;
  return token;
}

async function destroyStaffSession(token) {
  if (!token) return;
  const { isConfigured, getSql } = require("./db.js");
  if (!isConfigured()) return;
  const sql = await getSql();
  await sql`DELETE FROM staff_sessions WHERE token = ${token};`;
}

// Retourne true si la requête porte une session staff valide et non expirée.
async function isStaffAuthenticated(req) {
  const { isConfigured, getSql } = require("./db.js");
  const token = getStaffSessionToken(req);
  if (!token || !isConfigured()) return false;

  const sql = await getSql();
  const { rows } = await sql`
    SELECT token FROM staff_sessions WHERE token = ${token} AND expires_at > now();
  `;
  return rows.length > 0;
}

// Petit garde-fou à appeler en tête de chaque endpoint /api/staff/*.
// Renvoie null si tout est en ordre, sinon écrit directement la réponse
// d'erreur et retourne true (l'appelant doit alors `return`).
async function requireStaff(req, res) {
  const { isConfigured } = require("./db.js");
  if (!isConfigured()) {
    res.status(500).json({ error: "db_not_configured" });
    return true;
  }
  if (!isStaffPasswordConfigured()) {
    res.status(500).json({ error: "staff_not_configured" });
    return true;
  }
  const authed = await isStaffAuthenticated(req);
  if (!authed) {
    res.status(401).json({ error: "not_authenticated" });
    return true;
  }
  return null;
}

module.exports = {
  COOKIE_NAME,
  SESSION_DAYS,
  setStaffSessionCookie,
  clearStaffSessionCookie,
  getStaffSessionToken,
  isStaffPasswordConfigured,
  passwordMatches,
  createStaffSession,
  destroyStaffSession,
  isStaffAuthenticated,
  requireStaff,
};
