// Génération de facture PDF (pdfkit, rendu en mémoire — pas de fichier
// temporaire, adapté aux fonctions serverless).

function formatEuros(cents) {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

async function buildInvoicePdfBuffer(order, items) {
  const PDFDocument = require("pdfkit");
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.fontSize(20).text("Ælen Paris", { continued: false });
  doc.fontSize(9).fillColor("#a68a64").text("MAISON DE MODE PARISIENNE").moveDown(1.2);

  doc.fillColor("#1c1917").fontSize(14).text(`Facture — Commande n°${order.id}`);
  doc.fontSize(10).fillColor("#3a3532").text(`Date : ${formatDate(order.created_at)}`);
  doc.text(`Client : ${order.customer_email}`).moveDown(1);

  const tableTop = doc.y + 10;
  doc.fontSize(9).fillColor("#a68a64");
  doc.text("ARTICLE", 50, tableTop);
  doc.text("TAILLE", 300, tableTop);
  doc.text("QTÉ", 370, tableTop);
  doc.text("PRIX", 430, tableTop, { width: 100, align: "right" });
  doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor("#e0d6c4").stroke();

  let y = tableTop + 25;
  doc.fillColor("#1c1917").fontSize(10);
  items.forEach((item) => {
    doc.text(item.product_name, 50, y, { width: 240 });
    doc.text(item.size || "—", 300, y);
    doc.text(String(item.qty), 370, y);
    doc.text(formatEuros(item.unit_price * item.qty), 430, y, { width: 100, align: "right" });
    y += 22;
  });

  doc.moveTo(50, y + 5).lineTo(545, y + 5).strokeColor("#e0d6c4").stroke();
  doc.fontSize(11).fillColor("#1c1917").text("Total", 370, y + 15);
  doc.font("Helvetica-Bold").text(formatEuros(order.amount_total), 430, y + 15, { width: 100, align: "right" });
  doc.font("Helvetica");

  doc
    .fontSize(8)
    .fillColor("#a68a64")
    .text("Ælen Paris — contact@aelenparis.fr", 50, 780, { width: 495, align: "center" });

  doc.end();
  return done;
}

module.exports = { buildInvoicePdfBuffer };
