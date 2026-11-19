// Client-side CSV export and PDF export helpers
import jsPDF from "jspdf";

export function exportCSV(filename, rows) {
  if (!rows || rows.length === 0) {
    alert("Tidak ada data untuk diexport");
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function exportPDF(title, head, body, filename) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, 14, 22);
  const startY = 28;
  const pageW = doc.internal.pageSize.getWidth();
  const colW = Math.floor((pageW - 28) / head.length);
  // header
  doc.setFillColor(15, 23, 42);
  doc.rect(14, startY - 5, pageW - 28, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  head.forEach((h, i) => doc.text(String(h), 16 + i * colW, startY));
  doc.setTextColor(30, 30, 30);
  let y = startY + 6;
  body.forEach((row, ri) => {
    if (y > doc.internal.pageSize.getHeight() - 14) {
      doc.addPage();
      y = 20;
    }
    if (ri % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(14, y - 5, pageW - 28, 6, "F");
    }
    row.forEach((c, i) => doc.text(String(c ?? ""), 16 + i * colW, y));
    y += 6;
  });
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export function downloadCSVTemplate(filename, headers) {
  const csv = headers.join(",");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Simple CSV parser (handles quoted fields)
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (ch === "\r") {
        /* skip */
      } else cell += ch;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
