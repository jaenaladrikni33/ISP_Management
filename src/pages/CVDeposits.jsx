import React, { useState, useEffect, useMemo } from "react";
import { localApi } from "@/api/localClient";
import { getCached, setCached } from "@/lib/entityCache";
import { PageHeader, Loading, EmptyState, Badge } from "@/components/ui-bits";
import { formatCurrency, periodLabel, formatDate, currentPeriod, invoiceDanaCV, cvSetorDone, CV_STATUS_LABELS, CV_STATUS_COLORS, STATUS_LABELS, STATUS_COLORS } from "@/lib/billing";
import { InfoIcon } from "@/components/InfoIcon";
import { itemsSetoran } from "@/lib/reportItems";
import SetoranStat from "@/components/cvdeposits/SetoranStat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Landmark, Search, CheckCircle2, RotateCcw, Pencil, Trash2, FileText } from "lucide-react";
import { exportSetoranPDF } from "@/lib/pdfSetoran";
import { useToast } from "@/components/ui/use-toast";
import { useSort, SortableTh } from "@/components/ui-sort";
import TablePager, { usePagination } from "@/components/TablePager";

export default function CVDeposits() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [payFilter, setPayFilter] = useState("all"); // status pembayaran pelanggan
  const [setorFilter, setSetorFilter] = useState("all"); // status Setoran CV (berdiri sendiri)
  const [periodFilter, setPeriodFilter] = useState(currentPeriod());
  const [selected, setSelected] = useState(new Set());
  const [setorOpen, setSetorOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [setorForm, setSetorForm] = useState({ deposit_date: new Date().toISOString().slice(0, 10), deposit_amount: "", notes: "" });
  const [editMode, setEditMode] = useState(false);
  const [massDate, setMassDate] = useState(new Date().toISOString().slice(0, 10));
  const [massOpen, setMassOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { sortKey, sortDir, toggleSort, sortFn } = useSort("period", "desc");

  const load = async () => {
    const cached = getCached("cvdeposits");
    if (cached) { setItems((cached.cv || []).filter((x) => x.status !== "void")); setInvoices((cached.inv || []).filter((x) => x.status !== "void")); setCustomers(cached.c); setLoading(false); }
    else setLoading(true);
    try {
      const [cv, inv, c] = await Promise.all([
        localApi.entities.CVDeposit.list("-period", 2000),
        localApi.entities.Invoice.list("-period", 3000),
        localApi.entities.Customer.list(),
      ]);
      const cvA = cv.filter((x) => x.status !== "void");
      const invA = inv.filter((x) => x.status !== "void");
      setItems(cvA); setInvoices(invA); setCustomers(c);
      setCached("cvdeposits", { cv: cvA, inv: invA, c });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const invById = useMemo(() => { const m = {}; invoices.forEach((i) => (m[i.id] = i)); return m; }, [invoices]);
  const custById = useMemo(() => { const m = {}; customers.forEach((c) => (m[c.id] = c)); return m; }, [customers]);

  // enrich rows with dana CV from actual payment
  const rows = useMemo(() => items.map((d) => {
    const inv = d.invoice_id ? invById[d.invoice_id] : invoices.find((i) => i.customer_id === d.customer_id && i.period === d.period);
    const totalPaid = Number(inv?.total_paid || 0);
    const danaCV = invoiceDanaCV(totalPaid, d.cv_deposit_amount);
    // Status & sisa setoran dibaca dari data Setoran CV itu sendiri (bukan dari pembayaran/lunas pelanggan)
    const disetor = cvSetorDone(d);
    const sisaSetor = Math.max(0, Number(d.cv_deposit_amount || 0) - disetor);
    const cust = custById[d.customer_id];
    const payStatus = inv?.status || "belum_bayar";
    // Setoran hanya boleh dilakukan bila tagihan pelanggan sudah lunas
    const lunas = payStatus === "lunas" || payStatus === "dibayar_rapel";
    return { ...d, inv, totalPaid, danaCV, disetor, sisaSetor, phone: cust?.phone || "", area: cust?.area || "", payStatus, lunas };
  }), [items, invById, invoices, custById]);

  const periods = useMemo(() => [...new Set(items.map((i) => i.period))].sort().reverse(), [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const base = rows.filter((c) => {
      if (periodFilter !== "all" && c.period !== periodFilter) return false;
      const lunas = c.lunas;
      if (payFilter === "belum_bayar" && lunas) return false;
      if (payFilter === "sudah_bayar" && !lunas) return false;
      if (setorFilter !== "all" && c.status !== setorFilter) return false;
      if (dateFrom && (!c.deposit_date || c.deposit_date < dateFrom)) return false;
      if (dateTo && (!c.deposit_date || c.deposit_date > dateTo)) return false;
      if (!q) return true;
      return [c.customer_name, c.customer_id, c.phone, c.area, c.period].some((v) => (v || "").toLowerCase().includes(q));
    });
    return sortFn(base, (c, k) => ({
      customer_name: c.customer_name, period: c.period, invoice_amount: c.invoice_amount,
      totalPaid: c.totalPaid, cv_deposit_amount: c.cv_deposit_amount, danaCV: c.danaCV,
      sisaSetor: c.sisaSetor, deposit_date: c.deposit_date || "",
    }[k]));
  }, [rows, search, payFilter, setorFilter, periodFilter, sortKey, sortDir]);

  const pager = usePagination(filtered);

  const setorCounts = useMemo(() => {
    const sudah = filtered.filter((r) => r.status === "sudah_setor").length;
    const belum = filtered.filter((r) => r.status !== "sudah_setor").length;
    return { sudah, belum };
  }, [filtered]);

  // Baris untuk jendela ⓘ (nominal setoran, sudah disetorkan, belum disetorkan)
  const infoRows = useMemo(() => filtered.map((r) => ({
    customer_name: r.customer_name, period: r.period, deposit_date: r.deposit_date,
    nominal: Number(r.cv_deposit_amount || 0), disetor: r.disetor, belum: r.sisaSetor,
  })), [filtered]);

  // Hanya baris dengan tagihan lunas yang bisa dipilih untuk disetorkan
  const selectableIds = filtered.filter((r) => r.lunas).map((r) => r.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const toggleAll = () => { const ns = new Set(); if (!allSelected) selectableIds.forEach((id) => ns.add(id)); setSelected(ns); };
  const toggleOne = (id) => { const ns = new Set(selected); ns.has(id) ? ns.delete(id) : ns.add(id); setSelected(ns); };

  const selectedRows = filtered.filter((r) => selected.has(r.id));
  const totalSetoranSelected = selectedRows.reduce((s, r) => s + Number(r.cv_deposit_amount || 0), 0);

  const totals = filtered.reduce((acc, c) => {
    acc.setoran += Number(c.cv_deposit_amount || 0);
    acc.danaCV += c.danaCV;
    acc.pembayaran += c.totalPaid;
    acc.disetor += c.disetor;
    acc.belum += c.sisaSetor;
    return acc;
  }, { setoran: 0, danaCV: 0, pembayaran: 0, disetor: 0, belum: 0 });

  const syncCustomerCvStatus = async (customerId) => {
    try {
      const deps = await localApi.entities.CVDeposit.filter({ customer_id: customerId });
      const hasBelum = deps.some((d) => d.status !== "sudah_setor");
      await localApi.entities.Customer.update(customerId, { cv_status: hasBelum ? "belum_setor" : "sudah_setor" });
    } catch {}
  };

  const openSetor = (c) => {
    if (!c.lunas) {
      toast({ title: "Belum bisa disetor", description: `Tagihan ${c.customer_name} (${periodLabel(c.period)}) belum lunas.`, variant: "destructive" });
      return;
    }
    setActive(c); setEditMode(false);
    setSetorForm({ deposit_date: new Date().toISOString().slice(0, 10), deposit_amount: String(c.cv_deposit_amount || ""), notes: "" });
    setSetorOpen(true);
  };

  const openEdit = (c) => {
    setActive(c); setEditMode(true);
    setSetorForm({
      customer_name: c.customer_name || "",
      period: c.period || currentPeriod(),
      cv_deposit_amount: String(c.cv_deposit_amount || ""),
      deposit_date: c.deposit_date || new Date().toISOString().slice(0, 10),
      deposit_amount: String(c.deposit_amount || ""),
      status: c.status || "belum_setor",
      notes: c.notes || "",
    });
    setSetorOpen(true);
  };

  const rollbackSetor = async (c) => {
    if (!confirm(`Rollback setoran ${c.customer_name} (${periodLabel(c.period)})? Status kembali ke belum setor.`)) return;
    await localApi.entities.CVDeposit.update(c.id, { status: "belum_setor", deposit_date: null, deposit_amount: 0, notes: "" });
    await syncCustomerCvStatus(c.customer_id);
    toast({ title: "Setoran di-rollback" });
    load();
  };

  const deleteCV = async (c) => {
    if (!confirm(`Hapus setoran CV ${c.customer_name} (${periodLabel(c.period)})? Data setoran ini akan dihapus permanen.`)) return;
    await localApi.entities.CVDeposit.delete(c.id);
    await syncCustomerCvStatus(c.customer_id);
    toast({ title: "Setoran CV dihapus" });
    load();
  };

  const saveSetor = async () => {
    if (editMode) {
      const amt = Number(setorForm.cv_deposit_amount || 0);
      const dep = Number(setorForm.deposit_amount || 0);
      const status = setorForm.status === "sudah_setor"
        ? "sudah_setor"
        : (amt > 0 && dep >= amt ? "sudah_setor" : (dep > 0 ? "setor_sebagian" : "belum_setor"));
      await localApi.entities.CVDeposit.update(active.id, {
        customer_name: setorForm.customer_name, period: setorForm.period,
        cv_deposit_amount: amt, deposit_date: setorForm.deposit_date || null,
        deposit_amount: dep, status, notes: setorForm.notes,
      });
      await syncCustomerCvStatus(active.customer_id);
      toast({ title: "Setoran CV diperbarui" });
    } else {
      if (!active.lunas) {
        toast({ title: "Belum bisa disetor", description: "Tagihan pelanggan belum lunas.", variant: "destructive" });
        setSetorOpen(false);
        return;
      }
      const amt = Number(setorForm.deposit_amount || 0);
      const status = amt >= active.cv_deposit_amount ? "sudah_setor" : (amt > 0 ? "setor_sebagian" : "belum_setor");
      await localApi.entities.CVDeposit.update(active.id, { status, deposit_date: setorForm.deposit_date, deposit_amount: amt, notes: setorForm.notes });
      if (status === "sudah_setor") await localApi.entities.Customer.update(active.customer_id, { cv_status: "sudah_setor", cv_deposit_date: setorForm.deposit_date });
      await syncCustomerCvStatus(active.customer_id);
      toast({ title: "Setoran CV ditandai" });
    }
    setSetorOpen(false);
    load();
  };

  const massSetor = async () => {
    const blocked = selectedRows.filter((r) => !r.lunas).length;
    const todo = selectedRows.filter((r) => r.lunas && r.status !== "sudah_setor");
    if (todo.length === 0) {
      toast({
        title: "Tidak ada setoran yang bisa diproses",
        description: blocked ? `${blocked} tagihan belum lunas sehingga belum bisa disetor.` : "Semua setoran terpilih sudah berstatus Disetorkan",
      });
      setMassOpen(false);
      return;
    }
    const totalTodo = todo.reduce((s, r) => s + Number(r.cv_deposit_amount || 0), 0);
    if (!confirm(`Tandai ${todo.length} Setoran CV sebagai DISETORKAN dengan total ${formatCurrency(totalTodo)}?${blocked ? ` ${blocked} tagihan belum lunas akan dilewati.` : ""}`)) return;
    // Hanya tagihan yang sudah lunas yang bisa disetorkan ke CV.
    for (const r of todo) {
      await localApi.entities.CVDeposit.update(r.id, { status: "sudah_setor", deposit_date: massDate, deposit_amount: Number(r.cv_deposit_amount || 0) });
    }
    // update customer cv_status for those fully settled
    for (const r of todo) {
      const stillBelum = items.filter((d) => d.customer_id === r.customer_id && d.id !== r.id && d.status !== "sudah_setor");
      if (stillBelum.length === 0) await localApi.entities.Customer.update(r.customer_id, { cv_status: "sudah_setor", cv_deposit_date: massDate });
    }
    toast({ title: "Penyetoran CV massal selesai" });
    setMassOpen(false);
    setSelected(new Set());
    load();
  };

  const rowsForPdf = (subset) => subset.map((r) => ({ customer_name: r.customer_name, period: r.period, invoice_amount: r.invoice_amount, totalPaid: r.totalPaid, cv_deposit_amount: r.cv_deposit_amount, deposit_date: r.deposit_date, statusLabel: CV_STATUS_LABELS[r.status] }));
  const periodText = periodFilter === "all" ? "Semua Periode" : periodLabel(periodFilter);
  const exportPdfBelum = () => exportSetoranPDF(rowsForPdf(filtered.filter((r) => !(r.payStatus === "lunas" || r.payStatus === "dibayar_rapel"))), { title: "Setoran CV - Belum Bayar", periodText });
  const exportPdfSudah = () => exportSetoranPDF(rowsForPdf(filtered.filter((r) => r.status === "sudah_setor")), { title: "Setoran CV - Sudah Disetorkan", periodText });

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Penyetoran ke CV" subtitle="Setoran CV per pelanggan (nominal). Setoran hanya bisa dilakukan setelah tagihan pelanggan lunas." />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SetoranStat label="Total Setoran CV" value={formatCurrency(totals.setoran)} sub={`${filtered.length} setoran`}
          info={<InfoIcon variant="plain" title="Total Setoran CV" value={formatCurrency(totals.setoran)} period={periodFilter === "all" ? "Semua periode tagihan" : periodLabel(periodFilter)} source="Data Setoran CV (nominal per pelanggan per periode tagihan)" formula="Jumlah nominal Setoran CV sesuai filter yang aktif" items={itemsSetoran(infoRows)} />} />
        <SetoranStat label="Sudah Disetorkan" value={formatCurrency(totals.disetor)} tone="text-emerald-600" sub={`${setorCounts.sudah} setoran berstatus Disetorkan`}
          info={<InfoIcon variant="plain" title="Sudah Disetorkan" value={formatCurrency(totals.disetor)} period={periodFilter === "all" ? "Semua periode tagihan" : periodLabel(periodFilter)} source="Status pada data Setoran CV (bukan status lunas pelanggan)" formula="Jumlah Setoran CV berstatus Disetorkan + bagian yang sudah disetor pada Setor Sebagian" items={itemsSetoran(infoRows.filter((r) => r.disetor > 0), "disetor")} />} />
        <SetoranStat label="Belum Disetorkan" value={formatCurrency(totals.belum)} tone="text-amber-600" sub={`${setorCounts.belum} setoran belum lunas disetor`}
          info={<InfoIcon variant="plain" title="Belum Disetorkan" value={formatCurrency(totals.belum)} period={periodFilter === "all" ? "Semua periode tagihan" : periodLabel(periodFilter)} source="Status pada data Setoran CV (bukan status lunas pelanggan)" formula={`Total Setoran ${formatCurrency(totals.setoran)} − Sudah Disetorkan ${formatCurrency(totals.disetor)} = ${formatCurrency(totals.belum)}`} items={itemsSetoran(infoRows.filter((r) => r.belum > 0), "belum")} />} />
        <SetoranStat label="Harus Disetorkan ke CV" value={formatCurrency(totals.danaCV)} tone="text-indigo-600" sub="Dari pembayaran pelanggan"
          info={<InfoIcon variant="plain" title="Harus Disetorkan ke CV" value={formatCurrency(totals.danaCV)} period={periodFilter === "all" ? "Semua periode tagihan" : periodLabel(periodFilter)} source="Pembayaran pelanggan yang sudah masuk pada tagihan terkait" formula="Per tagihan: pembayaran diterima, maksimal sebesar nominal Setoran CV. Hanya informasi — tidak menentukan status setoran." itemsTitle="Pelanggan sudah ditandai disetorkan" items={itemsSetoran(filtered.filter((r) => r.status === "sudah_setor"), "disetor")} />} />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, ID, HP, area, periode..." className="pl-9" />
        </div>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Periode" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Semua Periode</SelectItem>{periods.map((p) => <SelectItem key={p} value={p}>{periodLabel(p)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={payFilter} onValueChange={setPayFilter}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Status Pelanggan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status Pelanggan: Semua</SelectItem>
            <SelectItem value="sudah_bayar">Pelanggan Lunas</SelectItem>
            <SelectItem value="belum_bayar">Pelanggan Belum Lunas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={setorFilter} onValueChange={setSetorFilter}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Status Setoran CV" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status Setoran: Semua</SelectItem>
            <SelectItem value="belum_setor">Belum Disetorkan</SelectItem>
            <SelectItem value="setor_sebagian">Setor Sebagian</SelectItem>
            <SelectItem value="sudah_setor">Disetorkan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Tgl Setor:</span>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-40" />
          <span>s/d</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-40" />
          {(dateFrom || dateTo) && <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>Reset</Button>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportPdfBelum}><FileText className="mr-1.5 h-3.5 w-3.5" /> PDF Belum Bayar</Button>
          <Button variant="outline" size="sm" onClick={exportPdfSudah}><FileText className="mr-1.5 h-3.5 w-3.5" /> PDF Sudah Disetorkan</Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-white">
          <span className="text-sm font-medium">{selected.size} dipilih · Total Setoran {formatCurrency(totalSetoranSelected)}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Input type="date" value={massDate} onChange={(e) => setMassDate(e.target.value)} className="h-8 w-40 border-0 bg-white/10 text-white" />
            <Button size="sm" variant="secondary" onClick={() => setMassOpen(true)}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Setor ke CV</Button>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setSelected(new Set())}>Batal</Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="Tidak ada data setoran CV" description="Setoran CV dibuat otomatis saat generate tagihan untuk pelanggan yang menggunakan CV." icon={Landmark} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded" /></th>
                <SortableTh label="Nama" field="customer_name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Periode" field="period" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Tagihan" field="invoice_amount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <SortableTh label="Bayar" field="totalPaid" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <SortableTh label="Setoran CV" field="cv_deposit_amount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <SortableTh label="Dana CV" field="danaCV" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <SortableTh label="Sisa Setor" field="sisaSetor" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <th className="px-4 py-3 font-medium">Status Pelanggan</th>
                <th className="px-4 py-3 font-medium">Status Setoran CV</th>
                <SortableTh label="Tgl Setor" field="deposit_date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pager.pageItems.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} disabled={!c.lunas} title={!c.lunas ? "Tagihan belum lunas" : undefined} className="h-4 w-4 rounded disabled:opacity-40" /></td>
                    <td className="px-4 py-3 font-medium text-slate-900">{c.customer_name}</td>
                    <td className="px-4 py-3">{periodLabel(c.period)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(c.invoice_amount)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(c.totalPaid)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(c.cv_deposit_amount)}</td>
                    <td className="px-4 py-3 text-right text-indigo-600 font-medium">{formatCurrency(c.danaCV)}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(c.sisaSetor)}</td>
                    <td className="px-4 py-3"><Badge className={STATUS_COLORS[c.payStatus]}>{STATUS_LABELS[c.payStatus]}</Badge></td>
                    <td className="px-4 py-3"><Badge className={CV_STATUS_COLORS[c.status]}>{CV_STATUS_LABELS[c.status]}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">{c.deposit_date ? formatDate(c.deposit_date) : "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        {c.status !== "sudah_setor" && (c.lunas
                          ? <Button variant="outline" size="sm" onClick={() => openSetor(c)}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Setor</Button>
                          : <Button variant="outline" size="sm" disabled title="Tagihan pelanggan belum lunas"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Belum Lunas</Button>)}
                        <Button variant="outline" size="sm" onClick={() => openEdit(c)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                        {c.status === "sudah_setor" && <Button variant="outline" size="sm" className="text-rose-700" onClick={() => rollbackSetor(c)}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Rollback</Button>}
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-red-600" onClick={() => deleteCV(c)}><Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePager {...pager} />
        </div>
      )}

      <Dialog open={setorOpen} onOpenChange={setSetorOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editMode ? "Edit Setoran CV" : "Tandai Setor ke CV"}</DialogTitle></DialogHeader>
          {active && (
            <div className="space-y-2 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p><b>{active.customer_name}</b> — {periodLabel(active.period)}</p>
                <p className="text-xs text-slate-500 mt-1">Nominal Setoran CV: {formatCurrency(active.cv_deposit_amount)} · Dana CV terkumpul: {formatCurrency(active.danaCV)}</p>
              </div>
              {editMode ? (
                <>
                  <div><Label>Nama Pelanggan</Label><Input value={setorForm.customer_name} onChange={(e) => setSetorForm({ ...setorForm, customer_name: e.target.value })} /></div>
                  <div><Label>Periode</Label><Input type="month" value={setorForm.period} onChange={(e) => setSetorForm({ ...setorForm, period: e.target.value })} /></div>
                  <div><Label>Nominal Setoran CV</Label><Input type="number" value={setorForm.cv_deposit_amount} onChange={(e) => setSetorForm({ ...setorForm, cv_deposit_amount: e.target.value })} /></div>
                  <div><Label>Tanggal Setor</Label><Input type="date" value={setorForm.deposit_date || ""} onChange={(e) => setSetorForm({ ...setorForm, deposit_date: e.target.value })} /></div>
                  <div><Label>Nominal Sudah Disetor</Label><Input type="number" value={setorForm.deposit_amount} onChange={(e) => setSetorForm({ ...setorForm, deposit_amount: e.target.value })} /></div>
                  <div><Label>Status Setoran</Label>
                    <Select value={setorForm.status} onValueChange={(v) => setSetorForm({ ...setorForm, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="belum_setor">Belum Disetorkan</SelectItem><SelectItem value="setor_sebagian">Setor Sebagian</SelectItem><SelectItem value="sudah_setor">Disetorkan</SelectItem></SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div><Label>Tanggal Setor</Label><Input type="date" value={setorForm.deposit_date} onChange={(e) => setSetorForm({ ...setorForm, deposit_date: e.target.value })} /></div>
                  <div><Label>Nominal Setor</Label><Input type="number" value={setorForm.deposit_amount} onChange={(e) => setSetorForm({ ...setorForm, deposit_amount: e.target.value })} /></div>
                </>
              )}
              <div><Label>Catatan</Label><Textarea value={setorForm.notes} onChange={(e) => setSetorForm({ ...setorForm, notes: e.target.value })} rows={2} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setSetorOpen(false)}>Batal</Button><Button onClick={saveSetor}>{editMode ? "Simpan Perubahan" : "Simpan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={massOpen} onOpenChange={setMassOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Setor ke CV (Massal)</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <p>{selectedRows.length} tagihan dipilih dengan total nominal setoran {formatCurrency(totalSetoranSelected)}.</p>
            <p className="text-xs text-slate-500">Hanya tagihan pelanggan yang sudah lunas yang bisa disetorkan. Tanggal setoran: {formatDate(massDate)}.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setMassOpen(false)}>Batal</Button><Button onClick={massSetor}>Konfirmasi & Setor</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}