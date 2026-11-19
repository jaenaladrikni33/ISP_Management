import React, { useState, useEffect, useMemo } from "react";
import { localApi } from "@/api/localClient";
import { getCached, setCached } from "@/lib/entityCache";
import { PageHeader, Loading, EmptyState, Badge } from "@/components/ui-bits";
import {
  formatCurrency,
  formatDate,
  currentPeriod,
  periodLabel,
} from "@/lib/billing";
import { exportExcel } from "@/lib/excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Wallet, Plus, Ban, Pencil, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useSort, SortableTh } from "@/components/ui-sort";
import TablePager, { usePagination } from "@/components/TablePager";

export default function CVPayouts() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    period: currentPeriod(),
    amount: "",
    description: "",
    notes: "",
  });
  const { sortKey, sortDir, toggleSort, sortFn } = useSort("period", "desc");
  const [periodFilter, setPeriodFilter] = useState(currentPeriod());

  const load = async () => {
    const cached = getCached("cvpayouts");
    if (cached) {
      setItems(cached);
      setLoading(false);
    } else setLoading(true);
    try {
      const data = await localApi.entities.CVPayout.list("-date", 500);
      setItems(data);
      setCached("cvpayouts", data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const periods = useMemo(
    () =>
      [...new Set(items.map((i) => i.period).filter(Boolean))].sort().reverse(),
    [items],
  );
  const filteredItems = useMemo(
    () =>
      periodFilter === "all"
        ? items
        : items.filter((i) => i.period === periodFilter),
    [items, periodFilter],
  );
  const sortedItems = useMemo(
    () =>
      sortFn(
        filteredItems,
        (it, k) =>
          ({
            date: it.date,
            period: it.period || "",
            amount: Number(it.amount || 0),
            description: it.description || "",
            status: it.status,
          })[k],
      ),
    [filteredItems, sortKey, sortDir],
  );

  const pager = usePagination(sortedItems);

  const openNew = () => {
    setEditing(null);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      period: currentPeriod(),
      amount: "",
      description: "",
      notes: "",
    });
    setOpen(true);
  };
  const openEdit = (it) => {
    setEditing(it);
    setForm({
      date: it.date,
      period: it.period || "",
      amount: it.amount,
      description: it.description || "",
      notes: it.notes || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.amount) {
      toast({ variant: "destructive", title: "Nominal wajib" });
      return;
    }
    const payload = { ...form, amount: Number(form.amount), status: "active" };
    if (editing) await localApi.entities.CVPayout.update(editing.id, payload);
    else await localApi.entities.CVPayout.create(payload);
    toast({ title: "Tersimpan" });
    setOpen(false);
    load();
  };

  const voidItem = async (it) => {
    if (!confirm("Batalkan transaksi ini (void)?")) return;
    await localApi.entities.CVPayout.update(it.id, { status: "void" });
    toast({ title: "Transaksi dibatalkan" });
    load();
  };

  const handleExport = () => {
    const data = filteredItems.map((i) => ({
      Tanggal: formatDate(i.date),
      Periode: periodLabel(i.period),
      Nominal: i.amount,
      Keterangan: i.description || "",
      Catatan: i.notes || "",
      Status: i.status === "active" ? "Aktif" : "Void",
    }));
    exportExcel("pembayaran-gaji-cv", data, "Pembayaran Gaji CV");
  };

  if (loading) return <Loading />;

  const active = filteredItems.filter((i) => i.status === "active");
  const total = active.reduce((s, i) => s + Number(i.amount || 0), 0);

  return (
    <div>
      <PageHeader
        title="Pembayaran / Gaji dari CV"
        subtitle="Input manual. Tidak dihitung dari Setoran CV pelanggan."
      >
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Export
          </Button>
          <Button onClick={openNew}>
            <Plus className="mr-1.5 h-4 w-4" /> Tambah
          </Button>
        </div>
      </PageHeader>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Periode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Periode</SelectItem>
            {periods.map((p) => (
              <SelectItem key={p} value={p}>
                {periodLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Total Pembayaran / Gaji CV</p>
          <p className="font-bold text-rose-600">{formatCurrency(total)}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Jumlah Transaksi Aktif</p>
          <p className="font-bold text-slate-900">{active.length}</p>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <EmptyState
          title="Belum ada pembayaran/gaji CV"
          description="Catat pembayaran atau gaji yang dikeluarkan dari dana CV."
          icon={Wallet}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <SortableTh
                    label="Tanggal"
                    field="date"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Periode"
                    field="period"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Nominal"
                    field="amount"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <SortableTh
                    label="Keterangan"
                    field="description"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Status"
                    field="status"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="px-4 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pager.pageItems.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{formatDate(it.date)}</td>
                    <td className="px-4 py-3">{periodLabel(it.period)}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(it.amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {it.description || "-"}
                      {it.notes ? ` · ${it.notes}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          it.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }
                      >
                        {it.status === "active" ? "Aktif" : "Void"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {it.status === "active" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(it)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600"
                              onClick={() => voidItem(it)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </>
                        )}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit" : "Tambah"} Pembayaran/Gaji CV
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tanggal</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Periode</Label>
                <Input
                  type="month"
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Nominal</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <Label>Keterangan</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Gaji mitra, pembayaran pusat, dll"
              />
            </div>
            <div>
              <Label>Catatan</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={save}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
