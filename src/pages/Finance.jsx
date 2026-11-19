import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { localApi } from "@/api/localClient";
import { getCached, setCached } from "@/lib/entityCache";
import { PageHeader, Loading, EmptyState, Badge } from "@/components/ui-bits";
import FinanceStatCards from "@/components/finance/FinanceStatCards";
import TablePager, { usePagination } from "@/components/TablePager";
import {
  formatCurrency,
  formatDate,
  currentPeriod,
  periodLabel,
  buildNonCVRows,
  computeCVHeld,
} from "@/lib/billing";
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
import {
  Wallet,
  Plus,
  TrendingUp,
  TrendingDown,
  Ban,
  Pencil,
  Lock,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const DEFAULT_EXPENSE_CATS = [
  "Internet/Backbone",
  "Listrik",
  "Maintenance",
  "Peralatan",
  "Transportasi",
  "Gaji",
  "Operasional",
  "Lainnya",
];
// Manual hanya untuk pemasukan yang TIDAK punya sumber transaksi otomatis lain.
// Pendapatan Non-CV & Gaji/Pembayaran CV dihitung otomatis — tidak boleh diinput manual di sini.
const DEFAULT_INCOME_CATS = ["Pemasukan Lainnya"];

export default function Finance() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pemasukan"); // pemasukan | pengeluaran
  const [period, setPeriod] = useState(currentPeriod());
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cvDeposits, setCvDeposits] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: "",
    amount: "",
    description: "",
  });

  const load = async () => {
    const cached = getCached("finance");
    if (cached) {
      setExpenses(cached.e);
      setIncomes(cached.i);
      setPayments(cached.pay || []);
      setInvoices((cached.inv || []).filter((x) => x.status !== "void"));
      setCustomers(cached.c || []);
      setCvDeposits((cached.cv || []).filter((x) => x.status !== "void"));
      setPayouts(cached.po || []);
      setLoading(false);
    } else setLoading(true);
    try {
      const [e, i, pay, inv, c, cv, po] = await Promise.all([
        localApi.entities.Expense.list("-date", 1000),
        localApi.entities.Income.list("-date", 1000),
        localApi.entities.Payment.filter({ status: "active" }, "-date", 3000),
        localApi.entities.Invoice.list("-period", 3000),
        localApi.entities.Customer.list(),
        localApi.entities.CVDeposit.list("-period", 3000),
        localApi.entities.CVPayout.filter({ status: "active" }, "-date", 1000),
      ]);
      const invA = inv.filter((x) => x.status !== "void");
      const cvA = cv.filter((x) => x.status !== "void");
      setExpenses(e);
      setIncomes(i);
      setPayments(pay);
      setInvoices(invA);
      setCustomers(c);
      setCvDeposits(cvA);
      setPayouts(po);
      setCached("finance", { e, i, pay, inv: invA, c, cv: cvA, po });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const cats =
    tab === "pengeluaran" ? DEFAULT_EXPENSE_CATS : DEFAULT_INCOME_CATS;

  const openNew = () => {
    setEditing(null);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      category: cats[0],
      amount: "",
      description: "",
    });
    setOpen(true);
  };
  const openEdit = (item) => {
    setEditing(item);
    setForm({
      date: item.date,
      category: item.category,
      amount: item.amount,
      description: item.description || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.amount || !form.category) {
      toast({ variant: "destructive", title: "Kategori dan nominal wajib" });
      return;
    }
    const payload = { ...form, amount: Number(form.amount), status: "active" };
    if (tab === "pengeluaran") {
      if (editing) await localApi.entities.Expense.update(editing.id, payload);
      else await localApi.entities.Expense.create(payload);
    } else {
      if (editing) await localApi.entities.Income.update(editing.id, payload);
      else await localApi.entities.Income.create(payload);
    }
    toast({ title: "Tersimpan" });
    setOpen(false);
    load();
  };

  const voidItem = async (item) => {
    if (!confirm("Batalkan transaksi ini (void)?")) return;
    if (tab === "pengeluaran")
      await localApi.entities.Expense.update(item.id, { status: "void" });
    else await localApi.entities.Income.update(item.id, { status: "void" });
    toast({ title: "Transaksi dibatalkan" });
    load();
  };

  // ====== PEMASUKAN TERPADU (anti double counting) ======
  // Tiga sumber berbeda, tidak saling tumpang tindih:
  //  1. Pendapatan Non-CV  -> dihitung dari Pembayaran pelanggan (PEMBAYARAN_PELANGGAN) - Setoran CV
  //  2. Gaji/Pembayaran CV -> dari Menu Gaji CV (CVPayout)
  //  3. Pemasukan Lain     -> input manual (INPUT_KEUANGAN), hanya yg tidak punya sumber lain
  const nonCVRows = useMemo(
    () =>
      buildNonCVRows(payments, invoices, customers, cvDeposits)
        .filter((r) => (r.date || "").startsWith(period))
        .map((r) => ({
          id: `noncv-${r.payment_id}-${r.invoice_id || "x"}`,
          date: r.date,
          kategori: "Pendapatan Non-CV",
          keterangan: `${r.customer_name} · ${r.kategori}${r.period ? " · " + periodLabel(r.period) : ""}`,
          sumber: "Transaksi Pembayaran",
          nominal: r.non_cv,
          method: r.method || "-",
          jenis: "OTOMATIS",
          source_type: "PEMBAYARAN_PELANGGAN",
          source_id: r.payment_id,
          ref: "/pendapatan-noncv",
          _noncv: r,
        })),
    [payments, invoices, customers, cvDeposits, period],
  );

  const payoutRows = useMemo(
    () =>
      payouts
        .filter((p) => (p.date || "").startsWith(period))
        .map((p) => ({
          id: `gaji-${p.id}`,
          date: p.date,
          kategori: "Gaji/Pembayaran CV",
          keterangan:
            p.description ||
            (p.period ? periodLabel(p.period) : "Gaji/Pembayaran CV"),
          sumber: "Menu Gaji CV",
          nominal: Number(p.amount || 0),
          method: "-",
          jenis: "OTOMATIS",
          source_type: "GAJI_CV",
          source_id: p.id,
          ref: "/pembayaran-cv",
        })),
    [payouts, period],
  );

  const manualRows = useMemo(
    () =>
      incomes
        .filter(
          (i) => i.status === "active" && (i.date || "").startsWith(period),
        )
        .map((i) => ({
          id: `manual-${i.id}`,
          date: i.date,
          kategori: i.category || "Pemasukan Lainnya",
          keterangan: i.description || "-",
          sumber: "Input Keuangan",
          nominal: Number(i.amount || 0),
          method: "-",
          jenis: "MANUAL",
          source_type: "INPUT_KEUANGAN",
          source_id: i.id,
          raw: i,
        })),
    [incomes, period],
  );

  const pemasukanList = useMemo(
    () =>
      [...nonCVRows, ...payoutRows, ...manualRows].sort((a, b) =>
        (b.date || "").localeCompare(a.date || ""),
      ),
    [nonCVRows, payoutRows, manualRows],
  );

  // Totals for breakdown
  const nonCVTotal = useMemo(
    () => nonCVRows.reduce((s, r) => s + r.nominal, 0),
    [nonCVRows],
  );
  const nonCVBayar = useMemo(
    () => nonCVRows.reduce((s, r) => s + (r._noncv?.payment_amount || 0), 0),
    [nonCVRows],
  );
  const nonCVSetoran = useMemo(
    () => nonCVRows.reduce((s, r) => s + (r._noncv?.dana_cv || 0), 0),
    [nonCVRows],
  );
  const payoutTotal = useMemo(
    () => payoutRows.reduce((s, r) => s + r.nominal, 0),
    [payoutRows],
  );
  const manualTotal = useMemo(
    () => manualRows.reduce((s, r) => s + r.nominal, 0),
    [manualRows],
  );
  const totalPemasukan = nonCVTotal + payoutTotal + manualTotal;

  const activeExp = useMemo(
    () =>
      expenses.filter(
        (e) => e.status === "active" && (e.date || "").startsWith(period),
      ),
    [expenses, period],
  );
  const totalExp = useMemo(
    () => activeExp.reduce((s, e) => s + Number(e.amount || 0), 0),
    [activeExp],
  );
  const expByCat = useMemo(() => {
    const m = {};
    activeExp.forEach((e) => {
      const k = e.category || "Lainnya";
      m[k] = (m[k] || 0) + Number(e.amount || 0);
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [activeExp]);

  const saldo = totalPemasukan - totalExp;

  // Dana CV yang sudah masuk (tagihan lunas) tetapi belum disetorkan — ikut tercatat di saldo kas.
  const cvHeldRows = useMemo(
    () =>
      computeCVHeld(invoices, cvDeposits).rows.filter((r) =>
        (r.period || "").startsWith(period),
      ),
    [invoices, cvDeposits, period],
  );
  const cvHeld = useMemo(
    () => cvHeldRows.reduce((s, r) => s + r.held, 0),
    [cvHeldRows],
  );

  const pemasukanPager = usePagination(pemasukanList);
  const expPager = usePagination(activeExp);

  if (loading) return <Loading />;

  const JenisBadge = ({ jenis }) => (
    <Badge
      className={
        jenis === "OTOMATIS"
          ? "bg-sky-100 text-sky-700"
          : "bg-amber-100 text-amber-700"
      }
    >
      {jenis}
    </Badge>
  );

  return (
    <div>
      <PageHeader
        title="Keuangan"
        subtitle="Pemasukan terpadu dari transaksi sumber (Non-CV + Gaji CV otomatis + manual). Anti double counting."
      >
        <Button onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Tambah{" "}
          {tab === "pengeluaran" ? "Pengeluaran" : "Pemasukan"}
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Label>Periode</Label>
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Menampilkan transaksi periode{" "}
          <b className="text-slate-900">{periodLabel(period)}</b>
        </div>
      </div>

      <FinanceStatCards
        period={period}
        nonCVRows={nonCVRows}
        payoutRows={payoutRows}
        manualRows={manualRows}
        activeExp={activeExp}
        nonCV={{ total: nonCVTotal, bayar: nonCVBayar, cv: nonCVSetoran }}
        payoutTotal={payoutTotal}
        manualTotal={manualTotal}
        totalPemasukan={totalPemasukan}
        totalExp={totalExp}
        expByCat={expByCat}
        saldo={saldo}
        cvHeld={cvHeld}
        cvHeldRows={cvHeldRows}
      />

      <div className="mb-4 flex gap-1 rounded-lg bg-white p-1 shadow-sm border border-slate-100 w-fit">
        <button
          onClick={() => setTab("pemasukan")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${tab === "pemasukan" ? "bg-slate-900 text-white" : "text-slate-600"}`}
        >
          <TrendingUp className="h-4 w-4" /> Pemasukan
        </button>
        <button
          onClick={() => setTab("pengeluaran")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${tab === "pengeluaran" ? "bg-slate-900 text-white" : "text-slate-600"}`}
        >
          <TrendingDown className="h-4 w-4" /> Pengeluaran
        </button>
      </div>

      {tab === "pemasukan" ? (
        pemasukanList.length === 0 ? (
          <EmptyState
            title="Belum ada pemasukan"
            description={`Belum ada transaksi pemasukan pada periode ${periodLabel(period)}.`}
            icon={Wallet}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-medium">Tanggal</th>
                    <th className="px-3 py-3 font-medium">Kategori</th>
                    <th className="px-3 py-3 font-medium">Keterangan</th>
                    <th className="px-3 py-3 font-medium">Sumber</th>
                    <th className="px-3 py-3 text-right font-medium">
                      Nominal
                    </th>
                    <th className="px-3 py-3 font-medium">Metode</th>
                    <th className="px-3 py-3 font-medium">Jenis</th>
                    <th className="px-3 py-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pemasukanPager.pageItems.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 whitespace-nowrap text-slate-600">
                        {formatDate(r.date)}
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-900">
                        {r.kategori}
                      </td>
                      <td className="px-3 py-3 text-slate-600 max-w-[260px] truncate">
                        {r.keterangan}
                      </td>
                      <td className="px-3 py-3 text-slate-500 text-xs">
                        {r.sumber}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-emerald-600">
                        {formatCurrency(r.nominal)}
                      </td>
                      <td className="px-3 py-3 capitalize text-slate-500 text-xs">
                        {r.method}
                      </td>
                      <td className="px-3 py-3">
                        <JenisBadge jenis={r.jenis} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          {r.jenis === "MANUAL" ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEdit(r.raw)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600"
                                onClick={() => voidItem(r.raw)}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Link
                              to={r.ref || "#"}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title={`Otomatis dari ${r.sumber} — ubah di sumbernya`}
                            >
                              <Lock className="h-4 w-4" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-semibold">
                    <td className="px-3 py-3" colSpan={4}>
                      Total Pemasukan · {periodLabel(period)}
                    </td>
                    <td className="px-3 py-3 text-right text-emerald-700">
                      {formatCurrency(totalPemasukan)}
                    </td>
                    <td className="px-3 py-3" colSpan={2}>
                      Non-CV {formatCurrency(nonCVTotal)} · Gaji CV{" "}
                      {formatCurrency(payoutTotal)} · Lain{" "}
                      {formatCurrency(manualTotal)}
                    </td>
                    <td className="px-3 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <TablePager {...pemasukanPager} />
          </div>
        )
      ) : (
        <>
          {/* Rekap per kategori pengeluaran */}
          <div className="mb-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="font-heading text-sm font-semibold text-slate-900 mb-3">
              Rekap per Kategori — Pengeluaran · {periodLabel(period)}
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {expByCat.length === 0 ? (
                <p className="col-span-full text-xs text-slate-400">
                  Belum ada data periode ini.
                </p>
              ) : (
                expByCat.map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-50 p-3">
                    <p className="truncate text-xs text-slate-500">{k}</p>
                    <p className="font-bold text-rose-600">
                      {formatCurrency(v)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {activeExp.length === 0 ? (
            <EmptyState
              title="Belum ada pengeluaran"
              description={`Belum ada pengeluaran pada periode ${periodLabel(period)}.`}
              icon={Wallet}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Tanggal</th>
                      <th className="px-4 py-3 font-medium">Kategori</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Nominal
                      </th>
                      <th className="px-4 py-3 font-medium">Keterangan</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expPager.pageItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDate(item.date)}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {item.category}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.description || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="bg-emerald-100 text-emerald-700">
                            Aktif
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600"
                              onClick={() => voidItem(item)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-semibold">
                      <td className="px-4 py-3" colSpan={2}>
                        Total Pengeluaran · {periodLabel(period)}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-700">
                        {formatCurrency(totalExp)}
                      </td>
                      <td className="px-4 py-3" colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <TablePager {...expPager} />
            </div>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit" : "Tambah"}{" "}
              {tab === "pengeluaran"
                ? "Pengeluaran"
                : "Pemasukan Lain (Manual)"}
            </DialogTitle>
          </DialogHeader>
          {tab === "pemasukan" && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Pemasukan manual hanya untuk pemasukan yang <b>tidak berasal</b>{" "}
              dari Pendapatan Non-CV atau Gaji CV (keduanya otomatis).
            </p>
          )}
          <div className="space-y-3">
            <div>
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Kategori</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {cats.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
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
