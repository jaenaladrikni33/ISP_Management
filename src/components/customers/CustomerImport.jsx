import React, { useState } from "react";
import { localApi } from "@/api/localClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parseExcelFile, downloadExcelTemplate } from "@/lib/excel";
import { normalizePhone } from "@/lib/billing";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";

const FIELD_MAP = {
  name: ["nama", "name", "nama pelanggan", "nama customer", "nama lengkap"],
  phone: [
    "hp",
    "no hp",
    "no. hp",
    "telepon",
    "no telp",
    "no. telp",
    "nomor hp",
    "phone",
    "wa",
    "whatsapp",
    "nomor wa",
    "no whatsapp",
    "no. whatsapp",
  ],
  customer_id: [
    "id",
    "customer id",
    "id pelanggan",
    "kode",
    "kode pelanggan",
    "id pelanggan",
  ],
  address: ["alamat", "address"],
  area: ["area", "daerah", "wilayah", "zonasi"],
  package_name: ["paket", "nama paket", "package", "package name"],
  monthly_price: [
    "harga",
    "harga tagihan",
    "harga bulanan",
    "tarif",
    "price",
    "monthly price",
    "harga / bulan",
  ],
  status: ["status", "status pelanggan"],
  install_date: [
    "tanggal pasang",
    "install date",
    "pasang",
    "tgl pasang",
    "tanggal pemasangan",
  ],
  uses_cv_deposit: ["menggunakan cv", "cv", "pakai cv", "gunakan cv"],
  cv_deposit_amount: [
    "nominal setoran cv",
    "setoran cv",
    "nominal cv",
    "nilai setoran cv",
  ],
  notes: ["catatan", "notes", "keterangan"],
};

function mapHeader(h) {
  const key = String(h || "")
    .trim()
    .toLowerCase();
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    if (aliases.includes(key)) return field;
  }
  return null;
}

const TEMPLATE_HEADERS = [
  "ID",
  "Nama",
  "HP",
  "Alamat",
  "Area",
  "Paket",
  "Harga",
  "Status",
  "Tanggal Pasang",
  "Menggunakan CV",
  "Nominal Setoran CV",
  "Catatan",
];

const parseBool = (v) => {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  return ["ya", "yes", "y", "true", "1", "betul"].includes(s);
};

// Samakan status dari file ("Aktif", "AKTIF", "Non Aktif", ...) dengan nilai yang dipakai aplikasi.
const parseStatus = (v) => {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  if (!s) return "aktif";
  if (s.includes("isolir") || s.includes("suspend")) return "isolir";
  if (
    s.startsWith("tidak") ||
    s.includes("non") ||
    s.includes("inaktif") ||
    s.includes("inactive")
  )
    return "tidak_aktif";
  return "aktif";
};

export default function CustomerImport({
  open,
  onOpenChange,
  packages,
  onDone,
}) {
  const [rows, setRows] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => {
    setRows(null);
    setHeaders([]);
    setMapping({});
    setResult(null);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseExcelFile(file);
      if (!parsed.length) {
        alert("File kosong atau tidak terbaca");
        return;
      }
      const hdrs = parsed[0].map((h) => String(h ?? "").trim());
      const dataRows = parsed
        .slice(1)
        .filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
      const map = {};
      hdrs.forEach((h, i) => {
        const f = mapHeader(h);
        if (f && !(f in map)) map[f] = i;
      });
      setHeaders(hdrs);
      setMapping(map);
      setRows(dataRows);
      setResult(null);
    } catch (err) {
      alert("Gagal membaca file: " + (err?.message || err));
    }
    e.target.value = "";
  };

  const buildRecords = () => {
    if (!rows) return [];
    return rows.map((r) => {
      const rec = {};
      Object.entries(mapping).forEach(([field, idx]) => {
        let val = r[idx] ?? "";
        if (field === "monthly_price")
          val = Number(String(val).replace(/[^0-9.-]/g, "")) || 0;
        if (field === "cv_deposit_amount")
          val = Number(String(val).replace(/[^0-9.-]/g, "")) || 0;
        if (field === "phone") val = normalizePhone(val);
        if (field === "uses_cv_deposit") val = parseBool(val);
        if (field === "status") val = parseStatus(val);
        rec[field] = val;
      });
      if (rec.package_name) {
        const pkg = packages.find(
          (p) =>
            p.name.toLowerCase() === String(rec.package_name).toLowerCase(),
        );
        if (pkg) {
          rec.package_id = pkg.id;
          if (!rec.monthly_price) rec.monthly_price = pkg.price;
        }
      }
      if (!rec.status) rec.status = "aktif";
      if (rec.uses_cv_deposit && !rec.cv_status) rec.cv_status = "belum_setor";
      return rec;
    });
  };

  const doImport = async () => {
    const records = buildRecords();
    if (!records.length) {
      alert("Tidak ada data valid (kolom Nama wajib diisi)");
      return;
    }
    setBusy(true);
    let created = 0,
      updated = 0,
      skipped = 0;
    const rejected = [];
    try {
      const existing = await localApi.entities.Customer.list(
        "-created_date",
        2000,
      );
      const dbByPhone = new Map();
      const dbById = new Map();
      existing.forEach((c) => {
        if (c.phone) dbByPhone.set(c.phone, c);
        if (c.customer_id) dbById.set(c.customer_id, c);
      });
      // cek duplikat antarbaris file
      const filePhone = new Set();
      const fileId = new Set();
      const valid = [];
      for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        const reason = [];
        if (!rec.name) reason.push("Nama kosong");
        if (!rec.phone) reason.push("No. WhatsApp kosong");
        if (rec.phone && dbByPhone.has(rec.phone)) {
          const ex = dbByPhone.get(rec.phone);
          reason.push(`No. WhatsApp sudah dipakai (${ex.name})`);
        }
        if (rec.customer_id && dbById.has(rec.customer_id)) {
          const ex = dbById.get(rec.customer_id);
          reason.push(`ID sudah dipakai (${ex.name})`);
        }
        if (rec.phone && filePhone.has(rec.phone))
          reason.push("Duplikat di file (No. WhatsApp)");
        if (rec.customer_id && fileId.has(rec.customer_id))
          reason.push("Duplikat di file (ID)");
        if (reason.length) {
          rejected.push({
            row: i + 2,
            name: rec.name || "-",
            id: rec.customer_id || "-",
            phone: rec.phone || "-",
            reason: reason.join(", "),
          });
          skipped++;
          continue;
        }
        if (rec.phone) filePhone.add(rec.phone);
        if (rec.customer_id) fileId.add(rec.customer_id);
        valid.push(rec);
      }
      for (const rec of valid) {
        try {
          await localApi.entities.Customer.create(rec);
          created++;
        } catch (e) {
          rejected.push({
            row: "-",
            name: rec.name || "-",
            id: rec.customer_id || "-",
            phone: rec.phone || "-",
            reason: e.message || "Gagal menyimpan",
          });
          skipped++;
        }
      }
      setResult({ created, updated, skipped, total: records.length, rejected });
      onDone?.();
    } finally {
      setBusy(false);
    }
  };

  const preview = rows ? buildRecords().slice(0, 5) : [];
  const unmapped = headers.filter(
    (h, i) => !Object.values(mapping).includes(i),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" /> Import
            Massal Pelanggan
          </DialogTitle>
        </DialogHeader>

        {!rows && !result && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Upload file Excel (.xlsx, .xls) atau CSV. CSV dengan delimiter{" "}
              <b>koma</b> maupun <b>titik koma</b> terdeteksi otomatis. Duplikat
              ID / No. WhatsApp (di database maupun antarbaris file) akan
              ditolak.
            </p>
            <div className="rounded-lg border-2 border-dashed border-slate-200 p-6 text-center">
              <Upload className="mx-auto h-8 w-8 text-slate-400" />
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="mt-3 block w-full text-sm text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <span>Butuh format acuan?</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadExcelTemplate("template-pelanggan", TEMPLATE_HEADERS)
                }
              >
                Download Template
              </Button>
            </div>
          </div>
        )}

        {rows && !result && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(mapping).map(([f, i]) => (
                <span
                  key={f}
                  className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700"
                >
                  {headers[i]} → {f}
                </span>
              ))}
              {unmapped.length > 0 && (
                <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-700">
                  {unmapped.length} kolom tak dikenali (diabaikan)
                </span>
              )}
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border border-slate-100">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Nama</th>
                    <th className="px-3 py-2 font-medium">HP</th>
                    <th className="px-3 py-2 font-medium">Area</th>
                    <th className="px-3 py-2 font-medium">Paket</th>
                    <th className="px-3 py-2 font-medium">CV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {r.name}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {r.phone || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {r.area || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {r.package_name || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {r.uses_cv_deposit
                          ? `Rp${r.cv_deposit_amount || 0}`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              Menampilkan {preview.length} dari {rows.length} baris. Total{" "}
              {rows.length} baris siap diperiksa.
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Import selesai</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-2xl font-bold text-emerald-600">
                  {result.created}
                </p>
                <p className="text-xs text-slate-500">Dibuat</p>
              </div>
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-2xl font-bold text-sky-600">
                  {result.updated}
                </p>
                <p className="text-xs text-slate-500">Diperbarui</p>
              </div>
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-2xl font-bold text-amber-600">
                  {result.skipped}
                </p>
                <p className="text-xs text-slate-500">Ditolak</p>
              </div>
            </div>
            {result.rejected?.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-lg border border-amber-200">
                <table className="w-full text-xs">
                  <thead className="bg-amber-50 text-left text-amber-700">
                    <tr>
                      <th className="px-3 py-2">Baris</th>
                      <th className="px-3 py-2">Nama</th>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">HP</th>
                      <th className="px-3 py-2">Alasan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {result.rejected.map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{r.row}</td>
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2">{r.id}</td>
                        <td className="px-3 py-2">{r.phone}</td>
                        <td className="px-3 py-2 text-amber-700">{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>Selesai</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Batal
              </Button>
              {rows && (
                <Button onClick={doImport} disabled={busy}>
                  {busy
                    ? "Memproses..."
                    : `Periksa & Import ${rows.length} pelanggan`}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
