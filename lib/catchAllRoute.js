// Les Vercel Functions "génériques" (hors Next.js) ne peuplent pas
// req.query avec les segments d'une route dynamique catch-all
// ([...action].js) — contrairement à Next.js. On extrait donc le premier
// segment de chemin directement depuis req.url.
function firstPathSegment(req, prefix) {
  const pathname = req.url.split("?")[0];
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  return rest.split("/").filter(Boolean)[0] || null;
}

module.exports = { firstPathSegment };
