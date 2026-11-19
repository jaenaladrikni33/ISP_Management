import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { localApi } from "@/api/localClient";
import { getCached, setCached } from "@/lib/entityCache";
import { PageHeader, Loading, EmptyState, Badge } from "@/components/ui-bits";
import { formatCurrency, invoiceRemaining, currentPeriod } from "@/lib/billing";
import CustomerForm from "@/components/customers/CustomerForm";
import CustomerImport from "@/components/customers/CustomerImport";
import QuickPay from "@/components/customers/QuickPay";
import MassPayment from "@/components/customers/MassPayment";
import MassSetorCV from "@/components/customers/MassSetorCV";
import BroadcastDialog from "@/components/customers/BroadcastDialog";
import { exportExcel } from "@/lib/excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Search, Eye, Pencil, FileSpreadsheet, Upload, CreditCard, Send, Landmark, Trash2 } from "lucide-react";
import { useSort, SortableTh } from "@/components/ui-sort";
import TablePager, { usePagination } from "@/components/TablePager";

const STATUS_BADGE = {
  aktif: "bg-emerald-100 text-emerald-700",
  tidak_aktif: "bg-slate-100 text-slate-600",
  isolir: "bg-red-100 text-red-700",
};
const STATUS_LABEL = { aktif: "Aktif", tidak_aktif: "Tidak Aktif", isolir: "Isolir" };
const CV_LABEL = { belum_setor: "Belum Setor", sudah_setor: "Sudah Setor" };
const CV_BADGE = { belum_setor: "bg-amber-100 text-amber-700", sudah_setor: "bg-emerald-100 text-emerald-700" };

export default function Customers() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [packages, setPackages] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cvFilter, setCvFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [quickPay, setQuickPay] = useState(null); // {customer, mode}
  const [massPay, setMassPay] = useState(false);
  const [massSetor, setMassSetor] = useState(false);
  const [broadcast, setBroadcast] = useState(false);
  const { toast } = useToast();
  const { sortKey, sortDir, toggleSort, sortFn } = useSort("created_date", "desc");

  const load = async () => {
    const cached = getCached("customers");
    if (cached) { setItems(cached.c); setInvoices((cached.inv || []).filter((x) => x.status !== "void")); setPackages(cached.p); setLoading(false); }
    else setLoading(true);
    try {
      const [c, inv, p] = await Promise.all([
        localApi.entities.Customer.list("-created_date", 1000),
        localApi.entities.Invoice.list("-period", 3000),
        localApi.entities.Package.list(),
      ]);
      const invA = inv.filter((x) => x.status !== "void");
      setItems(c); setInvoices(invA); setPackages(p);
      setCached("customers", { c, inv: invA, p });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const areas = useMemo(() => [...new Set(items.map((i) => i.area).filter(Boolean))], [items]);

  // per-customer billing aggregates
  // Hanya tagihan periode berjalan yang BELUM LUNAS yang dihitung di kolom (tidak menumpuk semua periode).
  const billByCust = useMemo(() => {
    const curP = currentPeriod();
    const m = {};
    for (const i of invoices) {
      if (i.period !== curP) continue;
      const lunas = i.status === "lunas" || i.status === "dibayar_rapel";
      if (lunas) continue;
      if (!m[i.customer_id]) m[i.customer_id] = { tagihan: 0, bayar: 0, sisa: 0, unpaid: 0 };
      m[i.customer_id].tagihan += Number(i.amount || 0);
      m[i.customer_id].bayar += Number(i.total_paid || 0);
      m[i.customer_id].sisa += invoiceRemaining(i);
      m[i.customer_id].unpaid += 1;
    }
    return m;
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((c) => {
      if (statusFilter !== "all" && String(c.status || "").toLowerCase() !== statusFilter) return false;
      if (areaFilter !== "all" && c.area !== areaFilter) return false;
      if (cvFilter === "cv" && !c.uses_cv_deposit) return false;
      if (cvFilter === "noncv" && c.uses_cv_deposit) return false;
      if (cvFilter === "belum_setor" && !(c.uses_cv_deposit && c.cv_status !== "sudah_setor")) return false;
      if (!q) return true;
      return [c.customer_id, c.name, c.phone, c.address, c.area, c.package_name].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [items, search, statusFilter, areaFilter, cvFilter]);

  const ACCESSORS = {
    created_date: (c) => c.created_date,
    name: (c) => c.name, customer_id: (c) => c.customer_id, package_name: (c) => c.package_name,
    tagihan: (c) => billByCust[c.id]?.tagihan || 0, bayar: (c) => billByCust[c.id]?.bayar || 0,
    sisa: (c) => billByCust[c.id]?.sisa || 0, status: (c) => c.status,
  };
  const sortedFiltered = useMemo(() => sortFn(filtered, (c, k) => ACCESSORS[k](c)), [filtered, sortKey, sortDir, billByCust]);

  const { page, setPage, pageSize, setPageSize, pageItems, totalPages, total } = usePagination(sortedFiltered);

  const allVisibleIds = useMemo(() => pageItems.map((c) => c.id), [pageItems]);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));

  const toggleAll = () => {
    const ns = new Set(selected);
    if (allSelected) allVisibleIds.forEach((id) => ns.delete(id));
    else allVisibleIds.forEach((id) => ns.add(id));
    setSelected(ns);
  };
  const toggleOne = (id) => {
    const ns = new Set(selected);
    if (ns.has(id)) ns.delete(id); else ns.add(id);
    setSelected(ns);
  };
  const clearSel = () => setSelected(new Set());

  const selectedCustomers = useMemo(() => items.filter((c) => selected.has(c.id)), [items, selected]);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (c) => { setEditing(c); setFormOpen(true); };

  const deleteCustomer = async (c) => {
    if (!confirm(`Hapus pelanggan "${c.name}"? Semua tagihan, setoran CV, dan pembayaran terkait akan dibatalkan (void). Riwayat WhatsApp dihapus permanen.`)) return;
    try {
      const [invs, pays, cvs, logs] = await Promise.all([
        localApi.entities.Invoice.filter({ customer_id: c.id }),
        localApi.entities.Payment.filter({ customer_id: c.id }),
        localApi.entities.CVDeposit.filter({ customer_id: c.id }),
        localApi.entities.WhatsAppLog.filter({ customer_id: c.id }),
      ]);
      for (const p of pays) { if (p.status !== "void") await localApi.entities.Payment.update(p.id, { status: "void" }); }
      for (const i of invs) { if (i.status !== "void") await localApi.entities.Invoice.update(i.id, { status: "void" }); }
      for (const cv of cvs) { if (cv.status !== "void") await localApi.entities.CVDeposit.update(cv.id, { status: "void" }); }
      for (const w of logs) await localApi.entities.WhatsAppLog.delete(w.id);
      await localApi.entities.Customer.delete(c.id);
      toast({ title: "Pelanggan dihapus, transaksi dibatalkan" });
      load();
    } catch (e) { toast({ variant: "destructive", title: "Gagal menghapus", description: e.message }); }
  };

  const massDeleteCustomers = async () => {
    if (selectedCustomers.length === 0) return;
    if (!confirm(`Hapus ${selectedCustomers.length} pelanggan terpilih? Semua tagihan, setoran CV, dan pembayaran terkait akan dibatalkan (void). Riwayat WhatsApp dihapus permanen.`)) return;
    try {
      for (const c of selectedCustomers) {
        const [invs, pays, cvs, logs] = await Promise.all([
          localApi.entities.Invoice.filter({ customer_id: c.id }),
          localApi.entities.Payment.filter({ customer_id: c.id }),
          localApi.entities.CVDeposit.filter({ customer_id: c.id }),
          localApi.entities.WhatsAppLog.filter({ customer_id: c.id }),
        ]);
        for (const p of pays) { if (p.status !== "void") await localApi.entities.Payment.update(p.id, { status: "void" }); }
        for (const i of invs) { if (i.status !== "void") await localApi.entities.Invoice.update(i.id, { status: "void" }); }
        for (const cv of cvs) { if (cv.status !== "void") await localApi.entities.CVDeposit.update(cv.id, { status: "void" }); }
        for (const w of logs) await localApi.entities.WhatsAppLog.delete(w.id);
        await localApi.entities.Customer.delete(c.id);
      }
      toast({ title: `${selectedCustomers.length} pelanggan dihapus, transaksi dibatalkan` });
      setSelected(new Set());
      load();
    } catch (e) { toast({ variant: "destructive", title: "Gagal menghapus", description: e.message }); }
  };

  const handleExportExcel = () => {
    const data = filtered.map((c) => ({
      ID: c.customer_id || "", Nama: c.name || "", HP: c.phone || "", Alamat: c.address || "",
      Area: c.area || "", Paket: c.package_name || "", Harga: c.monthly_price || 0,
      Status: STATUS_LABEL[c.status] || c.status || "", "Tanggal Pasang": c.install_date || "",
      "Menggunakan CV": c.uses_cv_deposit ? "Ya" : "Tidak",
      "Nominal Setoran CV": c.cv_deposit_amount || 0, "Status CV": CV_LABEL[c.cv_status] || "-", Catatan: c.notes || "",
    }));
    exportExcel("pelanggan", data, "Pelanggan");
    toast({ title: "Export berhasil", description: `${data.length} pelanggan diexport ke Excel` });
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Pelanggan" subtitle={`${items.length} pelanggan terdaftar`}>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Tambah</Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="mr-1.5 h-4 w-4" /> Import</Button>
          <Button variant="outline" onClick={handleExportExcel}><FileSpreadsheet className="mr-1.5 h-4 w-4" /> Export</Button>
        </div>
      </PageHeader>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Cari ID, nama, HP, alamat, area, paket..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem><SelectItem value="aktif">Aktif</SelectItem><SelectItem value="tidak_aktif">Tidak Aktif</SelectItem><SelectItem value="isolir">Isolir</SelectItem>
          </SelectContent>
        </Select>
        <Select value={cvFilter} onValueChange={(v) => { setCvFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="CV" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua CV</SelectItem><SelectItem value="cv">Pelanggan CV</SelectItem><SelectItem value="noncv">Non-CV</SelectItem><SelectItem value="belum_setor">Belum Setor CV</SelectItem>
          </SelectContent>
        </Select>
        <Select value={areaFilter} onValueChange={(v) => { setAreaFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Area" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Area</SelectItem>{areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-white">
          <span className="text-sm font-medium">{selected.size} pelanggan dipilih</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setMassPay(true)}><CreditCard className="mr-1.5 h-3.5 w-3.5" /> Pembayaran Massal</Button>
            <Button size="sm" variant="secondary" onClick={() => setMassSetor(true)}><Landmark className="mr-1.5 h-3.5 w-3.5" /> Setor CV Massal</Button>
            <Button size="sm" variant="secondary" onClick={() => setBroadcast(true)}><Send className="mr-1.5 h-3.5 w-3.5" /> Broadcast WhatsApp</Button>
            <Button size="sm" variant="destructive" onClick={massDeleteCustomers}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus Massal</Button>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={clearSel}>Batal Pilihan</Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="Tidak ada pelanggan" description="Tambahkan pelanggan atau ubah filter." icon={Users} />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded" /></th>
                    <SortableTh label="ID" field="customer_id" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Nama" field="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Paket" field="package_name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Tagihan" field="tagihan" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableTh label="Dibayar" field="bayar" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableTh label="Sisa" field="sisa" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableTh label="Status" field="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-4 py-3 font-medium">Status CV</th>
                    <th className="px-4 py-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageItems.map((c) => {
                    const b = billByCust[c.id] || { tagihan: 0, bayar: 0, sisa: 0, unpaid: 0 };
                    return (
                      <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openEdit(c)}>
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} className="h-4 w-4 rounded" />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.customer_id || "-"}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                        <td className="px-4 py-3 text-slate-600">{c.package_name || "-"}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(b.tagihan)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(b.bayar)}</td>
                        <td className="px-4 py-3 text-right text-amber-600 font-medium">{formatCurrency(b.sisa)}</td>
                        <td className="px-4 py-3"><Badge className={STATUS_BADGE[c.status]}>{STATUS_LABEL[c.status]}</Badge></td>
                        <td className="px-4 py-3">{c.uses_cv_deposit ? <Badge className={CV_BADGE[c.cv_status] || CV_BADGE.belum_setor}>{CV_LABEL[c.cv_status] || "Belum Setor"}</Badge> : <span className="text-xs text-slate-400">-</span>}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col items-end gap-1">
                            <Button variant="outline" size="sm" className="h-7 px-2 text-emerald-700" disabled={b.unpaid === 0} onClick={() => setQuickPay({ customer: c, mode: "bayar" })}>Bayar</Button>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-amber-700" disabled={b.unpaid === 0} onClick={() => setQuickPay({ customer: c, mode: "cicil" })}>Cicil</Button>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-indigo-700" disabled={b.unpaid === 0} onClick={() => setQuickPay({ customer: c, mode: "rapel" })}>Rapel</Button>
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8"><Link to={`/pelanggan/${c.id}`} title="Detail / Hutang"><Eye className="h-4 w-4" /></Link></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => deleteCustomer(c)} title="Hapus pelanggan & semua data"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <TablePager page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} totalPages={totalPages} total={total} />
        </>
      )}

      <CustomerForm open={formOpen} onOpenChange={setFormOpen} editing={editing} packages={packages} onSaved={load} />
      <CustomerImport open={importOpen} onOpenChange={setImportOpen} packages={packages} onDone={load} />
      {quickPay && <QuickPay open={!!quickPay} onOpenChange={(o) => !o && setQuickPay(null)} customer={quickPay.customer} mode={quickPay.mode} onSaved={load} />}
      {massPay && <MassPayment open={massPay} onOpenChange={setMassPay} customers={selectedCustomers} onDone={load} />}
      {massSetor && <MassSetorCV open={massSetor} onOpenChange={setMassSetor} customers={selectedCustomers} onDone={load} />}
      {broadcast && <BroadcastDialog open={broadcast} onOpenChange={setBroadcast} recipients={selectedCustomers} onDone={load} />}
    </div>
  );
}