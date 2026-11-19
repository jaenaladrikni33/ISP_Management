import React, { useState, useEffect, useMemo } from "react";
import { localApi } from "@/api/localClient";
import { getCached, setCached } from "@/lib/entityCache";
import { PageHeader, StatCard, Loading } from "@/components/ui-bits";
import { formatCurrency } from "@/lib/billing";
import { buildReport } from "@/lib/reportCalc";
import { exportExcel } from "@/lib/excel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useToast } from "@/components/ui/use-toast";

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Ags",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];
const MONTHS_FULL = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export default function AnnualReport() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);

  const load = async () => {
    const cached = getCached("annualreport");
    if (cached) {
      setData({
        ...cached,
        invoices: (cached.invoices || []).filter((x) => x.status !== "void"),
        cvDeposits: (cached.cvDeposits || []).filter(
          (x) => x.status !== "void",
        ),
      });
      setLoading(false);
    } else setLoading(true);
    try {
      const [
        payments,
        invoices,
        customers,
        cvDeposits,
        payouts,
        incomes,
        expenses,
        settings,
      ] = await Promise.all([
        localApi.entities.Payment.filter({ status: "active" }, "-date", 3000),
        localApi.entities.Invoice.list("-period", 3000),
        localApi.entities.Customer.list(),
        localApi.entities.CVDeposit.list("-period", 3000),
        localApi.entities.CVPayout.filter({ status: "active" }, "-date", 1000),
        localApi.entities.Income.filter({ status: "active" }, "-date", 1000),
        localApi.entities.Expense.filter({ status: "active" }, "-date", 1000),
        localApi.entities.AppSetting.list(),
      ]);
      const payload = {
        payments,
        invoices: invoices.filter((x) => x.status !== "void"),
        customers,
        cvDeposits: cvDeposits.filter((x) => x.status !== "void"),
        payouts,
        incomes,
        expenses,
        settings: settings[0] || {},
      };
      setCached("annualreport", payload);
      setData(payload);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const out = [];
    for (let m = 0; m < 12; m++) {
      const mm = String(m + 1).padStart(2, "0");
      const s = `${year}-${mm}-01`;
      const e = `${year}-${mm}-${new Date(year, m + 1, 0).getDate()}`;
      const rep = buildReport(data, s, e);
      out.push({
        m,
        label: MONTHS_FULL[m],
        nonCV: rep.totalNonCV,
        gaji: rep.totalPayout,
        lain: rep.totalManual,
        pemasukan: rep.totalPemasukan,
        pengeluaran: rep.totalExpense,
        saldo: rep.saldo,
      });
    }
    return out;
  }, [data, year]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          nonCV: a.nonCV + r.nonCV,
          gaji: a.gaji + r.gaji,
          lain: a.lain + r.lain,
          pemasukan: a.pemasukan + r.pemasukan,
          pengeluaran: a.pengeluaran + r.pengeluaran,
          saldo: a.saldo + r.saldo,
        }),
        { nonCV: 0, gaji: 0, lain: 0, pemasukan: 0, pengeluaran: 0, saldo: 0 },
      ),
    [rows],
  );

  const chartData = rows.map((r) => ({
    name: MONTHS_SHORT[r.m],
    Pemasukan: r.pemasukan,
    Pengeluaran: r.pengeluaran,
  }));
  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 4, y - 3, y - 2, y - 1, y];
  }, []);

  const handleExport = () => {
    const out = rows.map((r) => ({
      Bulan: r.label,
      "Pendapatan Non-CV": r.nonCV,
      "Gaji CV": r.gaji,
      "Pemasukan Lain": r.lain,
      "Total Pemasukan": r.pemasukan,
      Pengeluaran: r.pengeluaran,
      Saldo: r.saldo,
    }));
    exportExcel(
      `laporan-pendapatan-tahunan-${year}`,
      out,
      `Laporan Tahunan ${year}`,
    );
    toast({ title: "Export berhasil" });
  };

  if (loading || !data) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Laporan Pendapatan Tahunan"
        subtitle={`Rekapan pemasukan & pengeluaran per bulan — Tahun ${year}`}
      >
        <div className="flex flex-wrap gap-2">
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Export
          </Button>
        </div>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total Pemasukan"
          value={formatCurrency(totals.pemasukan)}
          icon={TrendingUp}
          tone="emerald"
        />
        <StatCard
          label="Total Pengeluaran"
          value={formatCurrency(totals.pengeluaran)}
          icon={TrendingDown}
          tone="rose"
        />
        <StatCard
          label="Saldo Tahun"
          value={formatCurrency(totals.saldo)}
          icon={PiggyBank}
          tone={totals.saldo >= 0 ? "indigo" : "red"}
        />
      </div>

      <div className="mb-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="font-heading text-base font-semibold text-slate-900">
          Pemasukan vs Pengeluaran per Bulan
        </h3>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
              />
              <Tooltip
                formatter={(v) => formatCurrency(v)}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Pengeluaran" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Bulan</th>
                <th className="px-4 py-3 text-right font-medium">
                  Pendapatan Non-CV
                </th>
                <th className="px-4 py-3 text-right font-medium">Gaji CV</th>
                <th className="px-4 py-3 text-right font-medium">
                  Pemasukan Lain
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Total Pemasukan
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Pengeluaran
                </th>
                <th className="px-4 py-3 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.m} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {r.label}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600">
                    {formatCurrency(r.nonCV)}
                  </td>
                  <td className="px-4 py-3 text-right text-rose-600">
                    {formatCurrency(r.gaji)}
                  </td>
                  <td className="px-4 py-3 text-right text-sky-600">
                    {formatCurrency(r.lain)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatCurrency(r.pemasukan)}
                  </td>
                  <td className="px-4 py-3 text-right text-rose-600">
                    {formatCurrency(r.pengeluaran)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${r.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {formatCurrency(r.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold">
              <tr>
                <td className="px-4 py-3 text-slate-900">Total {year}</td>
                <td className="px-4 py-3 text-right text-emerald-600">
                  {formatCurrency(totals.nonCV)}
                </td>
                <td className="px-4 py-3 text-right text-rose-600">
                  {formatCurrency(totals.gaji)}
                </td>
                <td className="px-4 py-3 text-right text-sky-600">
                  {formatCurrency(totals.lain)}
                </td>
                <td className="px-4 py-3 text-right text-slate-900">
                  {formatCurrency(totals.pemasukan)}
                </td>
                <td className="px-4 py-3 text-right text-rose-600">
                  {formatCurrency(totals.pengeluaran)}
                </td>
                <td
                  className={`px-4 py-3 text-right ${totals.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}
                >
                  {formatCurrency(totals.saldo)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
