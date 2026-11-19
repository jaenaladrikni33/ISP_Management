// Excel import/export using browser APIs only (no external library).
// Export: SpreadsheetML 2003 XML (.xls) — opens cleanly in Excel.
// Import: .xlsx (zip via DecompressionStream), .xls (SpreadsheetML/HTML), .csv (auto delimiter koma/titik koma).
import { parseCSV } from "./exporter";

// Deteksi delimiter CSV (koma atau titik koma) dari baris pertama,
// lalu parse dengan dukungan field bertanda kutip.
export function parseCSVDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== "") || "";
  const semi = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  const delim = semi > comma ? ";" : ",";
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
      else if (ch === delim) {
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
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

// ---------------- EXPORT ----------------
export function exportExcel(filename, rows, sheetName = "Sheet1") {
  if (!rows || rows.length === 0) {
    alert("Tidak ada data untuk diexport");
    return;
  }
  const headers = Object.keys(rows[0]);
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  let xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  xml += `<Worksheet ss:Name="${esc(sheetName)}">\n<Table>\n`;
  xml += "<Row>";
  headers.forEach((h) => {
    xml += `<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`;
  });
  xml += "</Row>\n";
  rows.forEach((r) => {
    xml += "<Row>";
    headers.forEach((h) => {
      const v = r[h];
      const isNum = typeof v === "number" && isFinite(v);
      const out = isNum
        ? v
        : v instanceof Date
          ? v.toISOString().slice(0, 10)
          : v;
      xml += `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${esc(out)}</Data></Cell>`;
    });
    xml += "</Row>\n";
  });
  xml += "</Table>\n</Worksheet>\n</Workbook>";
  const blob = new Blob(["\uFEFF" + xml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  downloadBlob(blob, filename.endsWith(".xls") ? filename : `${filename}.xls`);
}

export function downloadExcelTemplate(filename, headers) {
  const sample = {};
  headers.forEach((h) => {
    sample[h] = "";
  });
  exportExcel(filename, [sample], "Template");
}

// ---------------- IMPORT ----------------
export async function parseExcelFile(file) {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const text = await file.text();
    return parseCSVDelimiter(text);
  }
  if (name.endsWith(".xlsx")) {
    const buf = await file.arrayBuffer();
    return await parseXLSX(buf);
  }
  // .xls — SpreadsheetML (XML) or HTML table
  const text = await file.text();
  return parseXLS(text);
}

async function parseXLSX(buffer) {
  const bytes = new Uint8Array(buffer);
  const targets = ["xl/sharedStrings.xml", "xl/worksheets/sheet1.xml"];
  const found = {};
  let off = 0;
  while (off < bytes.length - 30) {
    if (
      bytes[off] === 0x50 &&
      bytes[off + 1] === 0x4b &&
      bytes[off + 2] === 0x03 &&
      bytes[off + 3] === 0x04
    ) {
      const method = bytes[off + 8] | (bytes[off + 9] << 8);
      const compSize = readU32(bytes, off + 18);
      const fnLen = readU16(bytes, off + 26);
      const extraLen = readU16(bytes, off + 28);
      const fn = new TextDecoder().decode(
        bytes.subarray(off + 30, off + 30 + fnLen),
      );
      const dataStart = off + 30 + fnLen + extraLen;
      if (targets.includes(fn)) {
        const comp = bytes.subarray(dataStart, dataStart + compSize);
        const raw = method === 8 ? await inflateRaw(comp) : comp;
        found[fn] = new TextDecoder().decode(raw);
      }
      off = dataStart + compSize;
    } else {
      off++;
    }
  }
  const sst = [];
  if (found["xl/sharedStrings.xml"]) {
    const doc = new DOMParser().parseFromString(
      found["xl/sharedStrings.xml"],
      "text/xml",
    );
    doc.querySelectorAll("si").forEach((si) => {
      let s = "";
      si.querySelectorAll("t").forEach((t) => {
        s += t.textContent;
      });
      sst.push(s);
    });
  }
  const sheetXml = found["xl/worksheets/sheet1.xml"];
  if (!sheetXml) return [];
  const doc = new DOMParser().parseFromString(sheetXml, "text/xml");
  const rows = [];
  const sheetData = doc.querySelector("sheetData");
  if (!sheetData) return [];
  sheetData.querySelectorAll("row").forEach((rowEl) => {
    const cells = [];
    rowEl.querySelectorAll("c").forEach((c) => {
      const t = c.getAttribute("t");
      const ref = c.getAttribute("r") || "";
      const vEl = c.querySelector("v");
      let val = "";
      if (t === "s") {
        const idx = vEl ? parseInt(vEl.textContent, 10) : -1;
        val = sst[idx] ?? "";
      } else if (t === "inlineStr" || t === "str") {
        const is = c.querySelector("is > t") || c.querySelector("t");
        val = is ? is.textContent : "";
      } else if (vEl) {
        val = vEl.textContent;
      }
      const m = ref.match(/([A-Z]+)\d+/);
      let colIdx = 0;
      if (m) colIdx = colStrToIndex(m[1]);
      cells[colIdx] = val;
    });
    rows.push(cells);
  });
  return rows;
}

function parseXLS(text) {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<?xml") || trimmed.includes("<Workbook")) {
    const doc = new DOMParser().parseFromString(text, "text/xml");
    const rows = [];
    doc.querySelectorAll("Row").forEach((rowEl) => {
      const cells = [];
      let i = 0;
      rowEl.querySelectorAll("Cell").forEach((cell) => {
        const idxAttr = cell.getAttribute("ss:Index");
        if (idxAttr) i = parseInt(idxAttr, 10) - 1;
        const data = cell.querySelector("Data");
        cells[i] = data ? data.textContent : "";
        i++;
      });
      rows.push(cells);
    });
    return rows;
  }
  // HTML table
  const doc = new DOMParser().parseFromString(text, "text/html");
  const rows = [];
  doc.querySelectorAll("table tr").forEach((tr) => {
    const cells = [];
    tr.querySelectorAll("td,th").forEach((td) => {
      cells.push(td.textContent.trim());
    });
    rows.push(cells);
  });
  return rows;
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

function readU32(b, o) {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}
function readU16(b, o) {
  return (b[o] | (b[o + 1] << 8)) >>> 0;
}
function colStrToIndex(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n - 1;
}
async function inflateRaw(comp) {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([comp]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}
