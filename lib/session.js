// Cookie de session (lien magique). Le cookie ne contient qu'un jeton
// opaque aléatoire ; l'e-mail associé vit en base, jamais dans le cookie.

const crypto = require("crypto");

const COOKIE_NAME = "aelen_session";
const SESSION_DAYS = 30;
const LINK_MINUTES = 15;

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

function setSessionCookie(res, token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
}

function getSessionToken(req) {
  return parseCookies(req)[COOKIE_NAME] || null;
}

async function getSessionEmail(req) {
  const { isConfigured, getSql } = require("./db.js");
  const token = getSessionToken(req);
  if (!token || !isConfigured()) return null;

  const sql = await getSql();
  const { rows } = await sql`
    SELECT email FROM sessions WHERE token = ${token} AND expires_at > now();
  `;
  return rows[0] ? rows[0].email : null;
}

module.exports = {
  COOKIE_NAME,
  SESSION_DAYS,
  LINK_MINUTES,
  randomToken,
  setSessionCookie,
  clearSessionCookie,
  getSessionToken,
  getSessionEmail,
};
