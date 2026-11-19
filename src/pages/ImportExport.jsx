import React, { useState, useEffect } from "react";
import { localApi } from "@/api/localClient";
import { PageHeader, Loading, Badge } from "@/components/ui-bits";
import { normalizePhone } from "@/lib/billing";
import { exportCSV, downloadCSVTemplate, parseCSV } from "@/lib/exporter";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const TEMPLATE_HEADERS = [
  "ID Pelanggan",
  "Nama",
  "Nomor HP",
  "Alamat",
  "Area",
  "Paket",
  "Harga",
  "Tanggal Pemasangan",
  "Status",
  "Catatan",
];

export default function ImportExport() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [preview, setPreview] = useState(null);
  const [dupAction, setDupAction] = useState("skip");
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [c, p] = await Promise.all([
      localApi.entities.Customer.list(),
      localApi.entities.Package.list(),
    ]);
    setCustomers(c);
    setPackages(p);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const rows = parseCSV(text);
      if (rows.length < 2) {
        toast({ variant: "destructive", title: "File kosong / tidak valid" });
        return;
      }
      const headers = rows[0].map((h) => h.trim().toLowerCase());
      const idx = (name) => headers.findIndex((h) => h.includes(name));
      const iId = idx("id pelanggan"),
        iName = idx("nama"),
        iPhone = idx("hp") >= 0 ? idx("hp") : idx("nomor"),
        iAddr = idx("alamat"),
        iArea = idx("area"),
        iPkg = idx("paket"),
        iPrice = idx("harga"),
        iDate = idx("pemasangan"),
        iStatus = idx("status"),
        iNotes = idx("catatan");
      const existingIds = new Set(
        customers.map((c) => c.customer_id).filter(Boolean),
      );
      const existingPhones = new Set(
        customers.map((c) => c.phone).filter(Boolean),
      );
      const parsed = rows.slice(1).map((r, n) => {
        const phone = normalizePhone(r[iPhone] || "");
        const dup =
          (r[iId] && existingIds.has(r[iId])) ||
          (phone && existingPhones.has(phone));
        const empty = !(r[iName] && r[iName].trim());
        return {
          row: n + 2,
          customer_id: r[iId] || "",
          name: r[iName] || "",
          phone,
          address: r[iAddr] || "",
          area: r[iArea] || "",
          package_name: r[iPkg] || "",
          monthly_price: Number(r[iPrice] || 0),
          install_date: r[iDate] || "",
          status: (r[iStatus] || "aktif").toLowerCase(),
          notes: r[iNotes] || "",
          valid: !empty,
          duplicate: dup,
        };
      });
      setPreview(parsed);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Gagal membaca file",
        description: err.message,
      });
    }
    e.target.value = "";
  };

  const doImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      let toCreate = [];
      let toUpdate = [];
      for (const r of preview) {
        if (!r.valid) continue;
        if (r.duplicate && dupAction === "skip") continue;
        const pkg = packages.find(
          (p) => p.name.toLowerCase() === (r.package_name || "").toLowerCase(),
        );
        const payload = {
          customer_id:
            r.customer_id ||
            `CUST-${String(customers.length + toCreate.length + 1).padStart(4, "0")}`,
          name: r.name,
          phone: r.phone,
          address: r.address,
          area: r.area,
          package_id: pkg?.id || "",
          package_name: r.package_name,
          monthly_price: r.monthly_price || pkg?.price || 0,
          install_date: r.install_date || new Date().toISOString().slice(0, 10),
          status: ["aktif", "tidak_aktif", "isolir"].includes(r.status)
            ? r.status
            : "aktif",
          uses_cv_deposit: false,
          cv_deposit_amount: 0,
          cv_status: "belum_setor",
          credit_balance: 0,
          notes: r.notes,
        };
        if (r.duplicate && dupAction === "update") {
          const ex = customers.find(
            (c) => c.customer_id === r.customer_id || c.phone === r.phone,
          );
          if (ex) toUpdate.push({ id: ex.id, ...payload });
        } else {
          toCreate.push(payload);
        }
      }
      if (toCreate.length) await localApi.entities.Customer.bulkCreate(toCreate);
      for (const u of toUpdate) await localApi.entities.Customer.update(u.id, u);
      toast({
        title: `Import selesai: ${toCreate.length} baru, ${toUpdate.length} diperbarui`,
      });
      setPreview(null);
      load();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Gagal import",
        description: e.message,
      });
    } finally {
      setImporting(false);
    }
  };

  const doExport = (filter) => {
    let list = customers;
    if (filter === "active") list = list.filter((c) => c.status === "aktif");
    else if (filter === "inactive")
      list = list.filter((c) => c.status !== "aktif");
    else if (filter?.startsWith("area:"))
      list = list.filter((c) => c.area === filter.slice(5));
    else if (filter?.startsWith("package:"))
      list = list.filter((c) => c.package_id === filter.slice(8));
    const rows = list.map((c) => ({
      "ID Pelanggan": c.customer_id || "",
      Nama: c.name,
      "Nomor HP": c.phone,
      Alamat: c.address,
      Area: c.area,
      Paket: c.package_name,
      Harga: c.monthly_price,
      "Tanggal Pemasangan": c.install_date,
      Status: c.status,
      Catatan: c.notes || "",
    }));
    exportCSV(`pelanggan-${filter || "all"}`, rows);
  };

  if (loading) return <Loading />;

  const areas = [...new Set(customers.map((c) => c.area).filter(Boolean))];

  return (
    <div>
      <PageHeader
        title="Import / Export"
        subtitle="Impor & ekspor data pelanggan"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Import */}
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="font-heading font-semibold text-slate-900">
            Import Pelanggan
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Format CSV. Untuk Excel, simpan sebagai CSV terlebih dahulu.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCSVTemplate("template-pelanggan", TEMPLATE_HEADERS)
              }
            >
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Download Template
              CSV
            </Button>
            <label>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={onFile}
              />
              <Button asChild>
                <span>
                  <Upload className="mr-1.5 h-4 w-4" /> Pilih File CSV
                </span>
              </Button>
            </label>
          </div>

          {preview && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-3 text-sm">
                <Badge className="bg-emerald-100 text-emerald-700">
                  {preview.filter((p) => p.valid && !p.duplicate).length} Valid
                </Badge>
                <Badge className="bg-amber-100 text-amber-700">
                  {preview.filter((p) => p.duplicate).length} Duplikat
                </Badge>
                <Badge className="bg-red-100 text-red-700">
                  {preview.filter((p) => !p.valid).length} Kosong
                </Badge>
              </div>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-100">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-left text-slate-500 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5">Baris</th>
                      <th>Nama</th>
                      <th>HP</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {preview.map((r) => (
                      <tr
                        key={r.row}
                        className={
                          !r.valid
                            ? "bg-red-50"
                            : r.duplicate
                              ? "bg-amber-50"
                              : ""
                        }
                      >
                        <td className="px-2 py-1.5">{r.row}</td>
                        <td>{r.name || "(kosong)"}</td>
                        <td>{r.phone}</td>
                        <td>
                          {!r.valid
                            ? "Data kosong"
                            : r.duplicate
                              ? "Duplikat"
                              : "OK"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-slate-600">Duplikat:</span>
                <Select value={dupAction} onValueChange={setDupAction}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Lewati</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="mt-3 w-full"
                onClick={doImport}
                disabled={importing}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />{" "}
                {importing ? "Mengimpor..." : "Konfirmasi & Import"}
              </Button>
            </div>
          )}
        </div>

        {/* Export */}
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="font-heading font-semibold text-slate-900">
            Export Pelanggan
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Export data pelanggan ke CSV (dapat dibuka di Excel).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => doExport("all")}>
              <Download className="mr-1.5 h-4 w-4" /> Semua Pelanggan
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => doExport("active")}
            >
              <Download className="mr-1.5 h-4 w-4" /> Pelanggan Aktif
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => doExport("inactive")}
            >
              <Download className="mr-1.5 h-4 w-4" /> Tidak Aktif
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select onValueChange={(v) => doExport(v)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Export by Area/Paket" />
              </SelectTrigger>
              <SelectContent>
                {areas.map((a) => (
                  <SelectItem key={a} value={`area:${a}`}>
                    Area: {a}
                  </SelectItem>
                ))}
                {packages.map((p) => (
                  <SelectItem key={p.id} value={`package:${p.id}`}>
                    Paket: {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-6 rounded-lg bg-slate-50 p-3">
            <h4 className="text-sm font-medium text-slate-700">
              Backup Lengkap
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Export semua data utama ke CSV.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <BackupBtn entity="Invoice" label="Tagihan" />
              <BackupBtn entity="Payment" label="Pembayaran" />
              <BackupBtn entity="CVDeposit" label="Setoran CV" />
              <BackupBtn entity="Expense" label="Pengeluaran" />
              <BackupBtn entity="Income" label="Pemasukan" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackupBtn({ entity, label }) {
  const { toast } = useToast();
  const run = async () => {
    const data = await localApi.entities[entity].list("-created_date", 2000);
    if (data.length === 0) {
      toast({ title: `${label}: tidak ada data` });
      return;
    }
    exportCSV(
      `backup-${label.toLowerCase()}`,
      data.map((d) => {
        const { id, created_date, updated_date, created_by_id, ...rest } = d;
        return rest;
      }),
    );
  };
  return (
    <Button variant="outline" size="sm" onClick={run}>
      <Download className="mr-1.5 h-4 w-4" /> {label}
    </Button>
  );
}
