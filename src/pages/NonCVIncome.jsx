import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { localApi } from "@/api/localClient";
import { getCached, setCached } from "@/lib/entityCache";
import {
  PageHeader,
  Loading,
  EmptyState,
  Badge,
  StatCard,
} from "@/components/ui-bits";
import TablePager, { usePagination } from "@/components/TablePager";
import {
  formatCurrency,
  formatDate,
  periodLabel,
  currentPeriod,
  buildNonCVRows,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/billing";
import { exportExcel } from "@/lib/excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  FileSpreadsheet,
  TrendingUp,
  Coins,
  Calculator,
  Hourglass,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { InfoIcon, InfoLine } from "@/components/InfoIcon";

const CAT_LABEL = {
  "Selisih Setoran CV": "A · Selisih Setoran CV",
  "Pembayaran Tanpa Setoran CV": "B · Pembayaran Tanpa Setoran CV",
  "Cicilan (Belum Lunas)": "C · Cicilan (Belum Lunas)",
};
const CAT_BADGE = {
  "Selisih Setoran CV": "bg-indigo-100 text-indigo-700",
  "Pembayaran Tanpa Setoran CV": "bg-emerald-100 text-emerald-700",
  "Cicilan (Belum Lunas)": "bg-amber-100 text-amber-700",
};

export default function NonCVIncome() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cvDeposits, setCvDeposits] = useState([]);
  const [period, setPeriod] = useState(currentPeriod());
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");

  const load = async () => {
    const cached = getCached("noncv");
    if (cached) {
      setPayments(cached.pay);
      setInvoices((cached.inv || []).filter((x) => x.status !== "void"));
      setCustomers(cached.c);
      setCvDeposits((cached.cv || []).filter((x) => x.status !== "void"));
      setLoading(false);
    } else setLoading(true);
    try {
      const [pay, inv, c, cv] = await Promise.all([
        localApi.entities.Payment.filter({ status: "active" }, "-date", 3000),
        localApi.entities.Invoice.list("-period", 3000),
        localApi.entities.Customer.list(),
        localApi.entities.CVDeposit.list("-period", 3000),
      ]);
      const invA = inv.filter((x) => x.status !== "void");
      const cvA = cv.filter((x) => x.status !== "void");
      setPayments(pay);
      setInvoices(invA);
      setCustomers(c);
      setCvDeposits(cvA);
      setCached("noncv", { pay, inv: invA, c, cv: cvA });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const allRows = useMemo(
    () => buildNonCVRows(payments, invoices, customers, cvDeposits),
    [payments, invoices, customers, cvDeposits],
  );

  const rows = useMemo(() => {
    return allRows
      .filter((r) => (r.date || "").startsWith(period))
      .filter((r) => cat === "all" || r.kategori === cat)
      .filter((r) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          (r.customer_name || "").toLowerCase().includes(q) ||
          (r.transaction_number || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [allRows, period, cat, search]);

  const pager = usePagination(rows);

  const totalA = useMemo(
    () =>
      rows
        .filter((r) => r.kategori === "Selisih Setoran CV")
        .reduce((s, r) => s + r.non_cv, 0),
    [rows],
  );
  const totalB = useMemo(
    () =>
      rows
        .filter((r) => r.kategori === "Pembayaran Tanpa Setoran CV")
        .reduce((s, r) => s + r.non_cv, 0),
    [rows],
  );
  const totalC = useMemo(
    () =>
      rows
        .filter((r) => r.kategori === "Cicilan (Belum Lunas)")
        .reduce((s, r) => s + r.non_cv, 0),
    [rows],
  );
  const totalAll = totalA + totalB + totalC;
  const totalBayar = useMemo(
    () => rows.reduce((s, r) => s + r.payment_amount, 0),
    [rows],
  );
  const totalSetoran = useMemo(
    () => rows.reduce((s, r) => s + r.cv_deposit, 0),
    [rows],
  );

  const handleExport = () => {
    const data = rows.map((r) => ({
      Tanggal: r.date || "",
      "Nama Pelanggan": r.customer_name,
      "Nominal Pembayaran": r.payment_amount,
      "Nominal Setoran CV": r.cv_deposit,
      "Pendapatan Non-CV": r.non_cv,
      Kategori: r.kategori,
      Status: STATUS_LABELS[r.status] || r.status,
      Keterangan: [
        r.period ? periodLabel(r.period) : "",
        r.method || "",
        r.notes || "",
      ]
        .filter(Boolean)
        .join(" · "),
    }));
    exportExcel(`pendapatan-noncv-${period}`, data, "Pendapatan Non-CV");
    toast({ title: "Laporan di-export" });
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Pendapatan Non-CV"
        subtitle="Pendapatan di luar setoran CV, dihitung otomatis dari pembayaran pelanggan."
      >
        <Button variant="outline" size="sm" onClick={handleExport}>
          <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Export
        </Button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="A · Selisih Setoran CV"
          value={formatCurrency(totalA)}
          icon={Coins}
          tone="indigo"
          sub={periodLabel(period)}
        />
        <StatCard
          label="B · Pembayaran Tanpa Setoran CV"
          value={formatCurrency(totalB)}
          icon={TrendingUp}
          tone="emerald"
          sub={periodLabel(period)}
        />
        <StatCard
          label="C · Cicilan (Belum Lunas)"
          value={formatCurrency(totalC)}
          icon={Hourglass}
          tone="amber"
          sub={`${periodLabel(period)} · uang sudah masuk`}
        />
        <StatCard
          label="Total Pendapatan Non-CV"
          value={formatCurrency(totalAll)}
          icon={Calculator}
          tone="sky"
          sub={`A + B · ${periodLabel(period)}`}
          info={
            <InfoIcon
              title="Total Pendapatan Non-CV"
              value={formatCurrency(totalAll)}
              period={periodLabel(period)}
              source="Transaksi Pembayaran pelanggan (dihitung otomatis, bukan input manual)"
              formula={`Pembayaran ${formatCurrency(totalBayar)} − Setoran CV ${formatCurrency(rows.reduce((s, r) => s + r.dana_cv, 0))} = Non-CV ${formatCurrency(totalAll)}`}
              items={rows
                .filter((r) => r.non_cv > 0)
                .map((r) => ({
                  label: r.customer_name,
                  sub: `${formatDate(r.date)} · ${r.transaction_number || "-"} · ${r.kategori}`,
                  value: formatCurrency(r.non_cv),
                }))}
            >
              <InfoLine
                label="A · Selisih Setoran CV"
                value={formatCurrency(totalA)}
                tone="text-indigo-600"
              />
              <InfoLine
                label="B · Tanpa Setoran CV"
                value={formatCurrency(totalB)}
                tone="text-emerald-600"
              />
              <InfoLine
                label="C · Cicilan (Belum Lunas)"
                value={formatCurrency(totalC)}
                tone="text-amber-600"
              />
            </InfoIcon>
          }
        />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="w-44">
          <Label>Periode</Label>
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
        <div className="w-56">
          <Label>Kategori</Label>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger>
              <SelectValue placeholder="Semua kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              <SelectItem value="Selisih Setoran CV">
                A · Selisih Setoran CV
              </SelectItem>
              <SelectItem value="Pembayaran Tanpa Setoran CV">
                B · Pembayaran Tanpa Setoran CV
              </SelectItem>
              <SelectItem value="Cicilan (Belum Lunas)">
                C · Cicilan (Belum Lunas)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1">
          <Label>&nbsp;</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama pelanggan / no. transaksi..."
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 mb-3">
        Total pembayaran:{" "}
        <b className="text-slate-900">{formatCurrency(totalBayar)}</b> · Total
        setoran CV:{" "}
        <b className="text-indigo-600">{formatCurrency(totalSetoran)}</b> ·
        Pendapatan Non-CV:{" "}
        <b className="text-emerald-600">{formatCurrency(totalAll)}</b>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Belum ada pendapatan Non-CV"
          description="Belum ada pembayaran pada periode ini, atau ubah filter periode/kategori."
          icon={Coins}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Tanggal</th>
                  <th className="px-3 py-3 font-medium">Nama Pelanggan</th>
                  <th className="px-3 py-3 text-right font-medium">
                    Nominal Pembayaran
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    Setoran CV
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    Pendapatan Non-CV
                  </th>
                  <th className="px-3 py-3 font-medium">Kategori</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pager.pageItems.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-3 whitespace-nowrap text-slate-600">
                      {formatDate(r.date)}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-900">
                      {r.customer_id ? (
                        <Link
                          to={`/pelanggan/${r.customer_id}`}
                          className="hover:underline"
                        >
                          {r.customer_name}
                        </Link>
                      ) : (
                        r.customer_name
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {formatCurrency(r.payment_amount)}
                    </td>
                    <td className="px-3 py-3 text-right text-indigo-600">
                      {formatCurrency(r.cv_deposit)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-emerald-600">
                      {formatCurrency(r.non_cv)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge className={CAT_BADGE[r.kategori]}>
                        {CAT_LABEL[r.kategori]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        className={
                          STATUS_COLORS[r.status] ||
                          "bg-slate-100 text-slate-600"
                        }
                      >
                        {STATUS_LABELS[r.status] || r.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-slate-500 text-xs">
                      {r.period ? periodLabel(r.period) : "-"}
                      {r.method ? ` · ${r.method}` : ""}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-semibold">
                  <td className="px-3 py-3" colSpan={2}>
                    Total
                  </td>
                  <td className="px-3 py-3 text-right text-slate-800">
                    {formatCurrency(totalBayar)}
                  </td>
                  <td className="px-3 py-3 text-right text-indigo-700">
                    {formatCurrency(totalSetoran)}
                  </td>
                  <td className="px-3 py-3 text-right text-emerald-700">
                    {formatCurrency(totalAll)}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500" colSpan={3}>
                    A: {formatCurrency(totalA)} · B: {formatCurrency(totalB)} ·
                    C: {formatCurrency(totalC)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <TablePager {...pager} />
        </div>
      )}
    </div>
  );
}
