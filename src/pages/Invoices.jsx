import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { localApi } from "@/api/localClient";
import { getCached, setCached } from "@/lib/entityCache";
import {
  PageHeader,
  StatCard,
  Loading,
  EmptyState,
  Badge,
} from "@/components/ui-bits";
import {
  formatCurrency,
  periodLabel,
  formatDate,
  currentPeriod,
  STATUS_LABELS,
  STATUS_COLORS,
  nextPaymentNumber,
  invoiceRemaining,
  recomputeInvoices,
  removeUnsettledCVDeposits,
} from "@/lib/billing";
import { applyPendingRapel, voidRapel, deleteRapel } from "@/lib/rapel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Search,
  Sparkles,
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Ban,
  CheckCheck,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useSort, SortableTh } from "@/components/ui-sort";
import TablePager, { usePagination } from "@/components/TablePager";
import PaymentForm from "@/components/payments/PaymentForm";
import QuickPay from "@/components/customers/QuickPay";
import InvoiceEditDialog from "@/components/billing/InvoiceEditDialog";
import ManualInvoiceDialog from "@/components/billing/ManualInvoiceDialog";
import RapelPanel from "@/components/rapel/RapelPanel";

const TYPE_LABEL = {
  tagihan: "Tagihan",
  cicilan: "Cicilan",
  rapel: "Rapel",
  pelunasan: "Pelunasan",
  lainnya: "Lainnya",
};

export default function Invoices() {
  const { toast } = useToast();
  const [tab, setTab] = useState("tagihan");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("belum_bayar");
  const [periodFilter, setPeriodFilter] = useState(currentPeriod());
  const [typeFilter, setTypeFilter] = useState("all");
  const [custTypeFilter, setCustTypeFilter] = useState("all"); // semua / CV / Non-CV
  const [payMonth, setPayMonth] = useState(currentPeriod());
  const [genPeriod, setGenPeriod] = useState(currentPeriod());
  const [replaceExisting, setReplaceExisting] = useState(false); // hapus tagihan periode ini dulu sebelum generate
  const [selected, setSelected] = useState(new Set());
  const [quickPay, setQuickPay] = useState(null);
  const [payForm, setPayForm] = useState(false);
  const [editingPay, setEditingPay] = useState(null);
  const [invoiceEdit, setInvoiceEdit] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const { sortKey, sortDir, toggleSort, sortFn } = useSort("period", "desc");
  const {
    sortKey: paySortKey,
    sortDir: paySortDir,
    toggleSort: togglePaySort,
    sortFn: paySortFn,
  } = useSort("period", "desc");
  const payPeriod = (p) => p.rapel_period || p.allocations?.[0]?.period || "";

  const load = async () => {
    const cached = getCached("invoices");
    if (cached) {
      setInvoices((cached.inv || []).filter((i) => i.status !== "void"));
      setPayments(cached.pay);
      setCustomers(cached.c);
      setLoading(false);
    } else setLoading(true);
    try {
      const [inv, pay, c] = await Promise.all([
        localApi.entities.Invoice.list("-period", 1000),
        localApi.entities.Payment.list("-date", 1000),
        localApi.entities.Customer.list(),
      ]);
      const invA = inv.filter((i) => i.status !== "void");
      setInvoices(invA);
      setPayments(pay);
      setCustomers(c);
      setCached("invoices", { inv: invA, pay, c });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const periods = useMemo(
    () => [...new Set(invoices.map((i) => i.period))].sort().reverse(),
    [invoices],
  );
  const payMonths = useMemo(
    () =>
      [
        ...new Set(
          payments
            .filter((p) => p.status === "active" && p.date)
            .map((p) => String(p.date).slice(0, 7)),
        ),
      ]
        .sort()
        .reverse(),
    [payments],
  );
  const custById = useMemo(() => {
    const m = {};
    customers.forEach((c) => (m[c.id] = c));
    return m;
  }, [customers]);
  const customerType = (customerId) =>
    custById[customerId]?.uses_cv_deposit ? "cv" : "noncv";
  // Nominal tiap tagihan yang dibayar lewat Rapel (untuk tampilan "via Rapel")
  const rapelByInvoice = useMemo(() => {
    const m = {};
    payments
      .filter(
        (p) =>
          p.status === "active" &&
          p.payment_type === "rapel" &&
          p.rapel_status === "teraplikasi",
      )
      .forEach((p) =>
        (p.allocations || []).forEach((a) => {
          if (a.invoice_id)
            m[a.invoice_id] = (m[a.invoice_id] || 0) + Number(a.amount || 0);
        }),
      );
    return m;
  }, [payments]);

  const summary = useMemo(() => {
    const curP = currentPeriod();
    const scoped =
      periodFilter === "all"
        ? invoices
        : invoices.filter((i) => i.period === periodFilter);
    const lunas = scoped.filter(
      (i) => i.status === "lunas" || i.status === "dibayar_rapel",
    );
    const belum = scoped.filter(
      (i) => i.status !== "lunas" && i.status !== "dibayar_rapel",
    );
    // Akumulasi real-time: saat periode berjalan, sisa tagihan bulan lalu yang belum lunas ikut terhitung ke periode berjalan.
    let arrearsCount = 0,
      arrearsNominal = 0;
    if (periodFilter === curP) {
      const arrears = invoices.filter(
        (i) =>
          i.period < curP &&
          i.status !== "lunas" &&
          i.status !== "dibayar_rapel",
      );
      arrearsCount = arrears.length;
      arrearsNominal = arrears.reduce((s, i) => s + invoiceRemaining(i), 0);
    }
    return {
      lunasCount: lunas.length,
      lunasNominal: lunas.reduce((s, i) => s + Number(i.amount || 0), 0),
      belumCount: belum.length + arrearsCount,
      belumNominal:
        belum.reduce((s, i) => s + invoiceRemaining(i), 0) + arrearsNominal,
      periodTotal: scoped.reduce((s, i) => s + Number(i.amount || 0), 0),
      periodPaid: scoped.reduce((s, i) => s + Number(i.total_paid || 0), 0),
      arrearsCount,
      arrearsNominal,
    };
  }, [invoices, periodFilter]);

  // Tunggakan bulan lalu per pelanggan (sisa tagihan periode sebelumnya yang belum lunas).
  const arrearsByCust = useMemo(() => {
    const curP = currentPeriod();
    const m = {};
    for (const i of invoices) {
      if (i.period >= curP) continue;
      if (i.status === "lunas" || i.status === "dibayar_rapel") continue;
      m[i.customer_id] = (m[i.customer_id] || 0) + invoiceRemaining(i);
    }
    return m;
  }, [invoices]);

  const filteredInv = useMemo(() => {
    const q = search.toLowerCase();
    const base = invoices.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (periodFilter !== "all" && i.period !== periodFilter) return false;
      if (
        custTypeFilter !== "all" &&
        customerType(i.customer_id) !== custTypeFilter
      )
        return false;
      if (!q) return true;
      return [i.invoice_number, i.customer_name, i.customer_id].some((v) =>
        (v || "").toLowerCase().includes(q),
      );
    });
    return sortFn(
      base,
      (i, k) =>
        ({
          invoice_number: i.invoice_number,
          customer_name: i.customer_name,
          period: i.period,
          amount: i.amount,
          sisa: invoiceRemaining(i),
          status: i.status,
        })[k],
    );
  }, [
    invoices,
    search,
    statusFilter,
    periodFilter,
    custTypeFilter,
    custById,
    sortKey,
    sortDir,
  ]);

  const filteredPay = useMemo(() => {
    const q = search.toLowerCase();
    const base = payments.filter((p) => {
      if (p.status !== "active") return false;
      if (payMonth !== "all" && String(p.date || "").slice(0, 7) !== payMonth)
        return false;
      if (typeFilter !== "all" && p.payment_type !== typeFilter) return false;
      if (
        custTypeFilter !== "all" &&
        customerType(p.customer_id) !== custTypeFilter
      )
        return false;
      if (!q) return true;
      return [p.transaction_number, p.customer_name].some((v) =>
        (v || "").toLowerCase().includes(q),
      );
    });
    return paySortFn(
      base,
      (p, k) =>
        ({
          transaction_number: p.transaction_number,
          customer_name: p.customer_name,
          date: p.date,
          amount: Number(p.amount || 0),
          period: payPeriod(p),
          method: p.method,
          payment_type: p.payment_type,
          status: p.status,
        })[k],
    );
  }, [
    payments,
    search,
    typeFilter,
    payMonth,
    custTypeFilter,
    custById,
    paySortKey,
    paySortDir,
  ]);

  const invPager = usePagination(filteredInv);
  const payPager = usePagination(filteredPay);

  const toggleInv = (id) => {
    const ns = new Set(selected);
    if (ns.has(id)) ns.delete(id);
    else ns.add(id);
    setSelected(ns);
  };
  const clearSel = () => setSelected(new Set());
  const selectedInvoices = useMemo(
    () => invoices.filter((i) => selected.has(i.id)),
    [invoices, selected],
  );

  const massPelunasan = async () => {
    const payable = selectedInvoices.filter((i) => invoiceRemaining(i) > 0);
    if (payable.length === 0) {
      toast({ variant: "destructive", title: "Tidak ada tagihan dengan sisa" });
      return;
    }
    const total = payable.reduce((s, i) => s + invoiceRemaining(i), 0);
    if (
      !confirm(
        `Pelunasan massal: ${payable.length} tagihan, total ${formatCurrency(total)}?`,
      )
    )
      return;
    setGenerating(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      for (const inv of payable) {
        const sisa = invoiceRemaining(inv);
        const txNum = await nextPaymentNumber();
        await localApi.entities.Payment.create({
          transaction_number: txNum,
          customer_id: inv.customer_id,
          customer_name: inv.customer_name,
          date: today,
          amount: sisa,
          method: "cash",
          payment_type: "pelunasan",
          allocations: [
            { invoice_id: inv.id, period: inv.period, amount: sisa },
          ],
          status: "active",
        });
      }
      await recomputeInvoices(payable.map((i) => i.id));
      toast({ title: `${payable.length} tagihan dilunasi` });
      setSelected(new Set());
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Gagal", description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const generate = async () => {
    const label = periodLabel(genPeriod);
    const msg = replaceExisting
      ? `Hapus dulu semua tagihan periode ${label} yang belum dibayar, lalu generate ulang untuk seluruh pelanggan aktif?`
      : `Generate tagihan periode ${label}? Pelanggan yang sudah punya tagihan periode ini (termasuk yang sudah lunas) akan dilewati agar tidak ganda.`;
    if (!confirm(msg)) return;
    setGenerating(true);
    try {
      if (replaceExisting) {
        const old = (
          await localApi.entities.Invoice.filter(
            { period: genPeriod },
            "-created_date",
            3000,
          )
        ).filter((i) => i.status !== "void");
        const sudahBayar = old.filter(
          (i) =>
            Number(i.total_paid || 0) > 0 ||
            i.status === "lunas" ||
            i.status === "dibayar_rapel",
        );
        if (sudahBayar.length > 0) {
          toast({
            variant: "destructive",
            title: "Tidak bisa menimpa",
            description: `${sudahBayar.length} tagihan periode ini sudah memiliki pembayaran. Rollback dulu tagihan tersebut.`,
          });
          setGenerating(false);
          return;
        }
        for (const inv of old) {
          try {
            await removeUnsettledCVDeposits(inv.id);
          } catch {}
          await localApi.entities.Invoice.delete(inv.id);
        }
      }
      const existing = (
        await localApi.entities.Invoice.filter({ period: genPeriod })
      ).filter((i) => i.status !== "void");
      const existingIds = new Set(existing.map((e) => e.customer_id));
      const alreadyCount = existing.length;
      // Setoran CV yang sudah ada untuk periode ini tidak boleh dibuat ganda
      const existingCV = await localApi.entities.CVDeposit.filter(
        { period: genPeriod },
        "-created_date",
        3000,
      );
      const cvByCust = {};
      existingCV.forEach((d) => {
        cvByCust[d.customer_id] = d;
      });
      const active = customers.filter(
        (c) =>
          String(c.status || "").toLowerCase() === "aktif" &&
          !existingIds.has(c.id) &&
          Number(c.monthly_price || 0) > 0,
      );
      if (active.length === 0) {
        toast({
          title: `Tidak ada tagihan baru dibuat`,
          description: `${alreadyCount} pelanggan sudah memiliki tagihan periode ${periodLabel(genPeriod)}.`,
        });
        setGenerating(false);
        return;
      }
      const [y, m] = genPeriod.split("-").map(Number);
      const dueDate = new Date(y, m, 10).toISOString().slice(0, 10);
      let counter = existing.length;
      const invoicePayloads = [];
      const cvPayloads = [];
      for (const c of active) {
        counter++;
        const invNum = `INV-${genPeriod.replace("-", "")}-${String(counter).padStart(4, "0")}`;
        invoicePayloads.push({
          invoice_number: invNum,
          customer_id: c.id,
          customer_name: c.name,
          customer_phone: c.phone,
          period: genPeriod,
          package_name: c.package_name,
          amount: Number(c.monthly_price),
          due_date: dueDate,
          total_paid: 0,
          remaining: Number(c.monthly_price),
          status: "belum_bayar",
          is_rapel: false,
        });
        if (c.uses_cv_deposit && c.cv_deposit_amount > 0 && !cvByCust[c.id]) {
          cvPayloads.push({
            customer_id: c.id,
            customer_name: c.name,
            period: genPeriod,
            invoice_amount: Number(c.monthly_price),
            cv_deposit_amount: Number(c.cv_deposit_amount),
            status: "belum_setor",
            deposit_amount: 0,
          });
        }
      }
      if (invoicePayloads.length) {
        const created =
          await localApi.entities.Invoice.bulkCreate(invoicePayloads);
        const fresh = await localApi.entities.Invoice.filter(
          { period: genPeriod },
          "-created_date",
          3000,
        );
        const invByCust = {};
        (Array.isArray(created) ? created : []).forEach((i) => {
          if (i?.id) invByCust[i.customer_id] = i;
        });
        fresh.forEach((i) => {
          invByCust[i.customer_id] = i;
        });
        if (cvPayloads.length) {
          cvPayloads.forEach((cv) => {
            const inv = invByCust[cv.customer_id];
            if (inv) cv.invoice_id = inv.id;
          });
          await localApi.entities.CVDeposit.bulkCreate(cvPayloads);
        }
        // Setoran CV lama yang belum tertaut ke tagihan cukup ditautkan (bukan dibuat ulang)
        for (const c of active) {
          const d = cvByCust[c.id];
          const inv = invByCust[c.id];
          if (d && inv && !d.invoice_id)
            await localApi.entities.CVDeposit.update(d.id, {
              invoice_id: inv.id,
            });
        }
        // Rapel: cocokkan Customer ID + Periode, lalu hubungkan ke tagihan baru (tanpa pembayaran baru)
        let rapel = null;
        try {
          rapel = await applyPendingRapel({
            period: genPeriod,
            knownInvoices: Object.values(invByCust),
          });
        } catch (err) {
          toast({
            variant: "destructive",
            title: "Rapel belum bisa diterapkan",
            description: err.message,
          });
        }
        toast({
          title: `${invoicePayloads.length} tagihan dibuat`,
          description: rapel?.applied
            ? `Rapel otomatis diterapkan ke ${rapel.applied} tagihan (${formatCurrency(rapel.used)})`
            : undefined,
        });
      } else {
        toast({ title: `${invoicePayloads.length} tagihan dibuat` });
      }
      load();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Gagal generate",
        description: e.message,
      });
    } finally {
      setGenerating(false);
    }
  };

  const ngutang = async (inv) => {
    if (!confirm(`Tandai tagihan ${inv.invoice_number} sebagai menunggak?`))
      return;
    await localApi.entities.Invoice.update(inv.id, { status: "menunggak" });
    toast({ title: "Tagihan ditandai menunggak" });
    load();
  };

  const deleteInvoice = async (inv) => {
    if (
      !confirm(
        `Hapus tagihan ${inv.invoice_number}? Setoran CV yang belum disetorkan ikut dihapus; yang sudah disetorkan tetap disimpan sebagai histori.`,
      )
    )
      return;
    try {
      await removeUnsettledCVDeposits(inv.id);
    } catch {}
    await localApi.entities.Invoice.delete(inv.id);
    toast({ title: "Tagihan dihapus" });
    load();
  };

  const deletePayment = async (p) => {
    if (
      !confirm(
        `Hapus transaksi ${p.transaction_number}? Tagihan terkait akan dihitung ulang.`,
      )
    )
      return;
    if (p.payment_type === "rapel") await deleteRapel(p);
    else {
      await localApi.entities.Payment.delete(p.id);
      await recomputeInvoices(
        (p.allocations || []).map((a) => a.invoice_id),
        [{ ...p, status: "void" }],
      );
    }
    toast({ title: "Transaksi dihapus" });
    load();
  };

  const voidPayment = async (p) => {
    if (!confirm(`Batalkan (void) transaksi ${p.transaction_number}?`)) return;
    if (p.payment_type === "rapel") await voidRapel(p);
    else {
      await localApi.entities.Payment.update(p.id, { status: "void" });
      await recomputeInvoices(
        (p.allocations || []).map((a) => a.invoice_id),
        [{ ...p, status: "void" }],
      );
    }
    toast({ title: "Transaksi dibatalkan (void)" });
    load();
  };

  // Rollback: kembalikan tagihan lunas/rapel ke belum bayar dengan mem-void semua pembayaran terkait.
  const rollbackInvoice = async (inv) => {
    if (
      !confirm(
        `Rollback tagihan ${inv.invoice_number}? Semua pembayaran terkait akan di-void dan status kembali belum bayar.`,
      )
    )
      return;
    try {
      const pays = await localApi.entities.Payment.filter({ status: "active" });
      const related = pays.filter((p) =>
        (p.allocations || []).some((a) => a.invoice_id === inv.id),
      );
      for (const p of related)
        await localApi.entities.Payment.update(p.id, { status: "void" });
      await recomputeInvoices(
        [inv.id],
        related.map((p) => ({ ...p, status: "void" })),
      );
      toast({
        title: "Rollback berhasil",
        description: `${related.length} pembayaran di-void.`,
      });
      load();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Gagal rollback",
        description: e.message,
      });
    }
  };

  const massDelete = async () => {
    if (selectedInvoices.length === 0) return;
    if (
      !confirm(
        `Hapus ${selectedInvoices.length} tagihan terpilih? Setoran CV yang belum disetorkan ikut dihapus; yang sudah disetorkan tetap disimpan sebagai histori.`,
      )
    )
      return;
    setGenerating(true);
    try {
      for (const inv of selectedInvoices) {
        try {
          await removeUnsettledCVDeposits(inv.id);
        } catch {}
        await localApi.entities.Invoice.delete(inv.id);
      }
      toast({ title: `${selectedInvoices.length} tagihan dihapus` });
      setSelected(new Set());
      load();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Gagal hapus",
        description: e.message,
      });
    } finally {
      setGenerating(false);
    }
  };

  const startPay = (inv, mode) =>
    setQuickPay({ customer: custById[inv.customer_id], invoice: inv, mode });

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Tagihan & Pembayaran"
        subtitle={`${invoices.length} tagihan · ${payments.filter((p) => p.status === "active").length} pembayaran aktif`}
      >
        {tab === "tagihan" ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Input
                type="month"
                value={genPeriod}
                onChange={(e) => setGenPeriod(e.target.value)}
                className="w-40"
              />
              <span className="hidden text-xs font-medium text-slate-500 sm:inline">
                {periodLabel(genPeriod)}
              </span>
            </div>
            <label className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              Hapus tagihan dulu
            </label>
            <Button onClick={generate} disabled={generating}>
              <Sparkles className="mr-1.5 h-4 w-4" />{" "}
              {generating ? "Memproses..." : "Generate Bulanan"}
            </Button>
            <Button variant="outline" onClick={() => setManualOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Tagihan Manual
            </Button>
          </div>
        ) : tab === "pembayaran" ? (
          <Button
            onClick={() => {
              setEditingPay(null);
              setPayForm(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Input Pembayaran
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Tagihan Lunas"
          value={summary.lunasCount}
          icon={CheckCheck}
          tone="emerald"
          sub={`${formatCurrency(summary.lunasNominal)} nominal`}
        />
        <StatCard
          label="Belum Lunas"
          value={summary.belumCount}
          icon={FileText}
          tone="amber"
          sub={`${formatCurrency(summary.belumNominal)} nominal${summary.arrearsCount > 0 ? ` · termasuk ${summary.arrearsCount} tunggakan lalu` : ""}`}
        />
        <StatCard
          label="Total Tagihan"
          value={formatCurrency(summary.periodTotal)}
          icon={FileText}
          tone="sky"
          sub={
            periodFilter === "all" ? "Semua Periode" : periodLabel(periodFilter)
          }
        />
        <StatCard
          label="Total Terbayar"
          value={formatCurrency(summary.periodPaid)}
          icon={CreditCard}
          tone="indigo"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="tagihan" className="gap-1.5">
            <FileText className="h-4 w-4" /> Tagihan
          </TabsTrigger>
          <TabsTrigger value="pembayaran" className="gap-1.5">
            <CreditCard className="h-4 w-4" /> Pembayaran
          </TabsTrigger>
          <TabsTrigger value="rapel" className="gap-1.5">
            <RotateCcw className="h-4 w-4" /> Rapel
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "tagihan" && (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nomor tagihan, nama pelanggan..."
                className="pl-9"
              />
            </div>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-full sm:w-44">
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={custTypeFilter} onValueChange={setCustTypeFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Tipe Pelanggan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Pelanggan</SelectItem>
                <SelectItem value="cv">Pelanggan CV</SelectItem>
                <SelectItem value="noncv">Pelanggan Non-CV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-white">
              <span className="text-sm font-medium">
                {selected.size} tagihan dipilih
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={massPelunasan}
                  disabled={generating}
                >
                  <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Pelunasan Massal
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={massDelete}
                  disabled={generating}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus Massal
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  onClick={clearSel}
                >
                  Batal Pilihan
                </Button>
              </div>
            </div>
          )}

          {filteredInv.length === 0 ? (
            <EmptyState
              title="Tidak ada tagihan"
              description="Generate tagihan bulanan untuk membuat tagihan otomatis."
              icon={FileText}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-3"></th>
                      <SortableTh
                        label="No. Tagihan"
                        field="invoice_number"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={toggleSort}
                      />
                      <SortableTh
                        label="Pelanggan"
                        field="customer_name"
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
                        label="Tagihan"
                        field="amount"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={toggleSort}
                        align="right"
                      />
                      <th className="px-4 py-3 text-right font-medium">
                        Dibayar
                      </th>
                      <SortableTh
                        label="Sisa"
                        field="sisa"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={toggleSort}
                        align="right"
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
                    {invPager.pageItems.map((i) => {
                      const sisa = invoiceRemaining(i);
                      const lunas =
                        i.status === "lunas" || i.status === "dibayar_rapel";
                      const arrears =
                        periodFilter === currentPeriod()
                          ? arrearsByCust[i.customer_id] || 0
                          : 0;
                      return (
                        <tr key={i.id} className="hover:bg-slate-50">
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selected.has(i.id)}
                              onChange={() => toggleInv(i.id)}
                              className="h-4 w-4 rounded"
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {i.invoice_number}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              to={`/pelanggan/${i.customer_id}`}
                              className="font-medium text-slate-900 hover:text-sky-600"
                            >
                              {i.customer_name}
                            </Link>
                          </td>
                          <td className="px-4 py-3">{periodLabel(i.period)}</td>
                          <td className="px-4 py-3 text-right">
                            {formatCurrency(i.amount)}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-600">
                            {formatCurrency(i.total_paid || 0)}
                            {rapelByInvoice[i.id] > 0 && (
                              <span className="block text-[10px] font-medium text-blue-600">
                                via Rapel {formatCurrency(rapelByInvoice[i.id])}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-amber-600 font-medium">
                            {formatCurrency(sisa + arrears)}
                            {arrears > 0 && (
                              <span className="block text-[10px] font-medium text-rose-600">
                                termasuk tunggakan bulan lalu{" "}
                                {formatCurrency(arrears)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={STATUS_COLORS[i.status]}>
                              {STATUS_LABELS[i.status]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-emerald-700"
                                disabled={lunas}
                                onClick={() => startPay(i, "bayar")}
                              >
                                Bayar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-amber-700"
                                disabled={lunas}
                                onClick={() => startPay(i, "cicil")}
                              >
                                Cicil
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-indigo-700"
                                disabled={lunas}
                                onClick={() => startPay(i, "rapel")}
                              >
                                Rapel
                              </Button>
                              {lunas && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-rose-700"
                                  onClick={() => rollbackInvoice(i)}
                                  title="Kembalikan ke belum bayar"
                                >
                                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                  Rollback
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-slate-600"
                                disabled={lunas}
                                onClick={() => ngutang(i)}
                              >
                                Ngutang
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setInvoiceEdit(i)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600"
                                onClick={() => deleteInvoice(i)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <TablePager {...invPager} />
            </div>
          )}
        </>
      )}

      {tab === "pembayaran" && (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nomor transaksi, nama pelanggan..."
                className="pl-9"
              />
            </div>
            <Select value={payMonth} onValueChange={setPayMonth}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Bulan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Bulan</SelectItem>
                {payMonths.map((m) => (
                  <SelectItem key={m} value={m}>
                    {periodLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Jenis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis</SelectItem>
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={custTypeFilter} onValueChange={setCustTypeFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Tipe Pelanggan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Pelanggan</SelectItem>
                <SelectItem value="cv">Pelanggan CV</SelectItem>
                <SelectItem value="noncv">Pelanggan Non-CV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredPay.length === 0 ? (
            <EmptyState
              title="Belum ada pembayaran"
              description="Input pembayaran pertama Anda."
              icon={CreditCard}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <SortableTh
                        label="No. Transaksi"
                        field="transaction_number"
                        sortKey={paySortKey}
                        sortDir={paySortDir}
                        onSort={togglePaySort}
                      />
                      <SortableTh
                        label="Pelanggan"
                        field="customer_name"
                        sortKey={paySortKey}
                        sortDir={paySortDir}
                        onSort={togglePaySort}
                      />
                      <SortableTh
                        label="Periode"
                        field="period"
                        sortKey={paySortKey}
                        sortDir={paySortDir}
                        onSort={togglePaySort}
                      />
                      <SortableTh
                        label="Tanggal"
                        field="date"
                        sortKey={paySortKey}
                        sortDir={paySortDir}
                        onSort={togglePaySort}
                      />
                      <SortableTh
                        label="Nominal"
                        field="amount"
                        sortKey={paySortKey}
                        sortDir={paySortDir}
                        onSort={togglePaySort}
                        align="right"
                      />
                      <SortableTh
                        label="Metode"
                        field="method"
                        sortKey={paySortKey}
                        sortDir={paySortDir}
                        onSort={togglePaySort}
                      />
                      <SortableTh
                        label="Jenis"
                        field="payment_type"
                        sortKey={paySortKey}
                        sortDir={paySortDir}
                        onSort={togglePaySort}
                      />
                      <th className="px-4 py-3 font-medium">Alokasi</th>
                      <SortableTh
                        label="Status"
                        field="status"
                        sortKey={paySortKey}
                        sortDir={paySortDir}
                        onSort={togglePaySort}
                      />
                      <th className="px-4 py-3 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payPager.pageItems.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs">
                          {p.transaction_number}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/pelanggan/${p.customer_id}`}
                            className="font-medium text-slate-900 hover:text-sky-600"
                          >
                            {p.customer_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {payPeriod(p) ? periodLabel(payPeriod(p)) : "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(p.date)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="px-4 py-3 capitalize text-slate-600">
                          {p.method}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="bg-sky-100 text-sky-700">
                            {TYPE_LABEL[p.payment_type]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {(p.allocations || [])
                            .map(
                              (a) =>
                                `${periodLabel(a.period)}: ${formatCurrency(a.amount)}`,
                            )
                            .join(", ") || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={
                              p.status === "active"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }
                          >
                            {p.status === "active" ? "Aktif" : "Void"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-end gap-1">
                            {p.status === "active" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditingPay(p);
                                  setPayForm(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {p.status === "active" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-600"
                                onClick={() => voidPayment(p)}
                                title="Void"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600"
                              onClick={() => deletePayment(p)}
                              title="Hapus"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePager {...payPager} />
            </div>
          )}
        </>
      )}

      {tab === "rapel" && <RapelPanel onChanged={load} />}

      {quickPay && (
        <QuickPay
          open={!!quickPay}
          onOpenChange={(o) => !o && setQuickPay(null)}
          customer={quickPay.customer}
          invoice={quickPay.invoice}
          mode={quickPay.mode}
          onSaved={load}
        />
      )}
      <PaymentForm
        open={payForm}
        onOpenChange={setPayForm}
        customers={customers}
        editing={editingPay}
        onSaved={load}
      />
      {invoiceEdit && (
        <InvoiceEditDialog
          open={!!invoiceEdit}
          onOpenChange={(o) => !o && setInvoiceEdit(null)}
          invoice={invoiceEdit}
          onSaved={load}
        />
      )}
      <ManualInvoiceDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        customers={customers}
        onSaved={load}
      />
    </div>
  );
}
