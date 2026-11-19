import React, { useState, useEffect, useMemo } from "react";
import { localApi } from "@/api/localClient";
import { getCached, setCached } from "@/lib/entityCache";
import { PageHeader, Loading } from "@/components/ui-bits";
import { formatCurrency, currentPeriod } from "@/lib/billing";
import { exportCSV, exportPDF } from "@/lib/exporter";
import { buildReport, rangeBounds } from "@/lib/reportCalc";
import { fmtRange } from "@/lib/reportItems";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import ReportFlow from "@/components/reports/ReportFlow";
import ReportPeriodFilter from "@/components/reports/ReportPeriodFilter";
import SummaryCards from "@/components/reports/SummaryCards";
import SummaryChart from "@/components/reports/SummaryChart";
import CVTab from "@/components/reports/CVTab";
import NonCVTab from "@/components/reports/NonCVTab";
import IncomeTab from "@/components/reports/IncomeTab";
import ExpenseTab from "@/components/reports/ExpenseTab";
import TaxTab from "@/components/reports/TaxTab";
import HistoryTab from "@/components/reports/HistoryTab";
import SetoranTab from "@/components/reports/SetoranTab";

const TABS = [
  { key: "ringkasan", label: "Ringkasan Keuangan" },
  { key: "cv", label: "Laporan CV" },
  { key: "noncv", label: "Laporan Non-CV" },
  { key: "pemasukan", label: "Pemasukan" },
  { key: "pengeluaran", label: "Pengeluaran" },
  { key: "pajak", label: "Pajak" },
  { key: "riwayat", label: "Riwayat Transaksi" },
  { key: "setoran", label: "Setoran WiFi/CV" },
];

const emptyFilter = () => ({
  range: "month",
  month: currentPeriod(),
  cStart: "",
  cEnd: "",
});

// Laporan: HANYA membaca transaksi yang sudah ada (tidak ada input / transaksi baru di sini).
export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState(emptyFilter());
  const [tab, setTab] = useState("ringkasan");

  useEffect(() => {
    let alive = true;
    const cached = getCached("reports2");
    if (cached) {
      setData({
        ...cached,
        invoices: (cached.invoices || []).filter((i) => i.status !== "void"),
        cvDeposits: (cached.cvDeposits || []).filter(
          (d) => d.status !== "void",
        ),
      });
      setLoading(false);
    }
    (async () => {
      try {
        const [
          payments,
          cvDeposits,
          invoices,
          expenses,
          incomes,
          customers,
          payouts,
          st,
        ] = await Promise.all([
          localApi.entities.Payment.filter({ status: "active" }, "-date", 3000),
          localApi.entities.CVDeposit.list("-period", 3000),
          localApi.entities.Invoice.list("-period", 3000),
          localApi.entities.Expense.filter({ status: "active" }, "-date", 3000),
          localApi.entities.Income.filter({ status: "active" }, "-date", 3000),
          localApi.entities.Customer.list("-created_date", 3000),
          localApi.entities.CVPayout.filter({ status: "active" }, "-date", 1000),
          localApi.entities.AppSetting.list(),
        ]);
        const settings = {
          cv_pusat_pct: st[0]?.cv_pusat_pct ?? 30,
          cv_mitra_pct: st[0]?.cv_mitra_pct ?? 70,
          cv_pph23_pct: st[0]?.cv_pph23_pct ?? 2,
        };
        const fresh = {
          payments,
          cvDeposits: cvDeposits.filter((d) => d.status !== "void"),
          invoices: invoices.filter((i) => i.status !== "void"),
          expenses,
          incomes,
          customers,
          payouts,
          settings,
        };
        setCached("reports2", fresh);
        if (alive) setData(fresh);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const [start, end] = useMemo(
    () => rangeBounds(filter.range, filter),
    [filter],
  );
  const rep = useMemo(
    () => (data ? buildReport(data, start, end) : null),
    [data, start, end],
  );
  const rangeText = fmtRange(start, end);

  if (loading || !rep) return <Loading />;

  const summaryRows = [
    ["Pembayaran Pelanggan", rep.totalBayar],
    ["Bagian CV", rep.totalCV],
    ["Pendapatan Non-CV", rep.totalNonCV],
    ["Gaji/Pembayaran CV", rep.totalPayout],
    ["Pemasukan Lain", rep.totalManual],
    ["Total Pemasukan", rep.totalPemasukan],
    ["Total Pengeluaran", rep.totalExpense],
    ["Saldo Operasional", rep.saldo],
    ["Dana CV Ditahan (lunas, belum disetor)", rep.cvHeld],
    ["Saldo Kas", rep.saldoKas],
    ["Total Setoran CV", rep.totalSetoran],
    ["Sudah Disetorkan", rep.totalDisetor],
    ["Belum Disetorkan", rep.totalBelumSetor],
    ["Pajak CV (PPN + BHP)", rep.totalPajak],
    ["Piutang Tagihan (posisi saat ini)", rep.piutang],
  ];

  const doExport = (type) => {
    if (type === "csv")
      exportCSV(
        "laporan-keuangan",
        summaryRows.map(([k, v]) => ({
          Keterangan: k,
          Nominal: v,
          Periode: rangeText,
        })),
      );
    else
      exportPDF(
        `Laporan Keuangan ISP_Management (${rangeText})`,
        ["Keterangan", "Nominal"],
        summaryRows.map(([k, v]) => [k, formatCurrency(v)]),
        "laporan-keuangan",
      );
  };

  return (
    <div>
      <PageHeader
        title="Laporan"
        subtitle="Hanya membaca transaksi yang sudah ada — tidak membuat atau mengubah transaksi."
      >
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => doExport("csv")}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => doExport("pdf")}>
            <FileText className="mr-1.5 h-4 w-4" /> PDF
          </Button>
        </div>
      </PageHeader>

      <ReportFlow />
      <ReportPeriodFilter value={filter} onChange={setFilter} />
      <p className="mb-3 text-xs text-slate-500">
        Periode laporan: <b className="text-slate-800">{rangeText}</b> — berlaku
        untuk semua bagian laporan di bawah.
      </p>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-slate-100 bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-md px-3 py-2 text-xs font-medium sm:text-sm ${tab === t.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ringkasan" && (
        <>
          <SummaryCards rep={rep} rangeText={rangeText} />
          <SummaryChart rep={rep} />
        </>
      )}
      {tab === "cv" && <CVTab rep={rep} rangeText={rangeText} />}
      {tab === "noncv" && <NonCVTab rep={rep} rangeText={rangeText} />}
      {tab === "pemasukan" && <IncomeTab rep={rep} rangeText={rangeText} />}
      {tab === "pengeluaran" && <ExpenseTab rep={rep} rangeText={rangeText} />}
      {tab === "pajak" && <TaxTab rep={rep} rangeText={rangeText} />}
      {tab === "riwayat" && <HistoryTab rep={rep} />}
      {tab === "setoran" && <SetoranTab rep={rep} rangeText={rangeText} />}
    </div>
  );
}
