import { jsPDF } from "jspdf";
import { formatCurrency, formatDate, periodLabel } from "@/lib/billing";

// Export daftar Setoran CV ke PDF (landscape A4).
export function exportSetoranPDF(rows, { title, periodText }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  const M = 10;
  const colW = [10, 55, 25, 30, 30, 32, 28, 30];
  const headers = [
    "No",
    "Nama Pelanggan",
    "Periode",
    "Tagihan",
    "Bayar",
    "Setoran CV",
    "Tgl Setor",
    "Status",
  ];
  const align = [
    "left",
    "left",
    "left",
    "right",
    "right",
    "right",
    "left",
    "left",
  ];
  const totalW = colW.reduce((a, b) => a + b, 0);

  let y = 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, M, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Periode: ${periodText}`, M, y);
  y += 5;
  doc.text(
    `Total: ${rows.length} setoran · Dibuat ${formatDate(new Date().toISOString().slice(0, 10))}`,
    M,
    y,
  );
  y += 6;

  // header
  doc.setFillColor(220, 230, 245);
  doc.rect(M, y - 4, totalW, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  let x = M;
  colW.forEach((w, i) => {
    doc.text(headers[i], x + (align[i] === "right" ? w - 1 : 1), y, {
      align: align[i],
    });
    x += w;
  });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  rows.forEach((r, idx) => {
    if (y > pageH - 14) {
      doc.addPage();
      y = 14;
    }
    const vals = [
      String(idx + 1),
      String(r.customer_name || "-").slice(0, 40),
      periodLabel(r.period),
      formatCurrency(r.invoice_amount),
      formatCurrency(r.totalPaid),
      formatCurrency(r.cv_deposit_amount),
      r.deposit_date ? formatDate(r.deposit_date) : "-",
      r.statusLabel || "-",
    ];
    let x = M;
    colW.forEach((w, i) => {
      doc.text(vals[i], x + (align[i] === "right" ? w - 1 : 1), y, {
        align: align[i],
      });
      x += w;
    });
    y += 5;
  });

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const totalTagihan = rows.reduce(
    (s, r) => s + Number(r.invoice_amount || 0),
    0,
  );
  const totalBayar = rows.reduce((s, r) => s + Number(r.totalPaid || 0), 0);
  const totalSetoran = rows.reduce(
    (s, r) => s + Number(r.cv_deposit_amount || 0),
    0,
  );
  doc.text(
    `Total Tagihan: ${formatCurrency(totalTagihan)}   Total Bayar: ${formatCurrency(totalBayar)}   Total Setoran CV: ${formatCurrency(totalSetoran)}`,
    M,
    y,
  );

  const fname = `setoran-cv-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
  doc.save(fname);
}
