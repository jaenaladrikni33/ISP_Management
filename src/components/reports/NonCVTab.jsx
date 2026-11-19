import React from "react";
import { Wallet, Landmark, Coins } from "lucide-react";
import { Badge } from "@/components/ui-bits";
import { formatCurrency as rp, formatDate, periodLabel } from "@/lib/billing";
import { itemsPay } from "@/lib/reportItems";
import ReportSection from "@/components/reports/ReportSection";
import ReportTable from "@/components/reports/ReportTable";
import ReportStatCard from "@/components/reports/ReportStatCard";

const CAT_BADGE = {
  "Selisih Setoran CV": "bg-indigo-100 text-indigo-700",
  "Pembayaran Tanpa Setoran CV": "bg-emerald-100 text-emerald-700",
};

// Laporan Non-CV: pembayaran pelanggan − Setoran CV. Dihitung otomatis, tidak diinput manual.
export default function NonCVTab({ rep, rangeText }) {
  const rows = rep.nonCvList;
  const bayar = rows.reduce((s, r) => s + r.payment_amount, 0);
  const cv = rows.reduce((s, r) => s + r.dana_cv, 0);
  const nonCv = rep.totalNonCV;

  const columns = [
    {
      key: "date",
      label: "Tanggal",
      render: (r) => (
        <span className="whitespace-nowrap text-slate-600">
          {formatDate(r.date)}
        </span>
      ),
    },
    {
      key: "customer_name",
      label: "Pelanggan",
      render: (r) => (
        <span className="font-medium text-slate-900">{r.customer_name}</span>
      ),
    },
    {
      key: "period",
      label: "Periode",
      render: (r) => (r.period ? periodLabel(r.period) : "-"),
    },
    {
      key: "payment_amount",
      label: "Pembayaran",
      align: "right",
      render: (r) => rp(r.payment_amount),
    },
    {
      key: "dana_cv",
      label: "Setoran CV",
      align: "right",
      render: (r) => <span className="text-indigo-600">{rp(r.dana_cv)}</span>,
    },
    {
      key: "non_cv",
      label: "Non-CV",
      align: "right",
      render: (r) => <b className="text-emerald-600">{rp(r.non_cv)}</b>,
    },
    {
      key: "kategori",
      label: "Kategori",
      render: (r) => (
        <Badge className={CAT_BADGE[r.kategori]}>{r.kategori}</Badge>
      ),
    },
  ];

  return (
    <ReportSection
      title="Laporan Non-CV"
      source="Transaksi Pembayaran pelanggan dikurangi Setoran CV (otomatis, tidak perlu input manual)"
      formula="Pembayaran − Setoran CV = Pendapatan Non-CV. Tanpa Setoran CV: Rp100.000 − Rp0 = Rp100.000"
      link={{
        to: "/pendapatan-noncv",
        label: "Buka halaman Pendapatan Non-CV",
      }}
    >
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ReportStatCard
          label="Pembayaran Pelanggan"
          amount={bayar}
          icon={Wallet}
          tone="emerald"
          period={rangeText}
          source="Transaksi Pembayaran pelanggan"
          formula="Pembayaran yang menghasilkan Non-CV"
          items={itemsPay(rows)}
        />
        <ReportStatCard
          label="Setoran CV"
          amount={cv}
          icon={Landmark}
          tone="indigo"
          period={rangeText}
          source="Bagian CV dari transaksi yang sama"
          formula="Bagian pembayaran yang menjadi Setoran CV"
          items={itemsPay(rows, "dana_cv")}
        />
        <ReportStatCard
          label="Pendapatan Non-CV"
          amount={nonCv}
          icon={Coins}
          tone="sky"
          period={rangeText}
          source="Transaksi Pembayaran pelanggan"
          formula={`${rp(bayar)} − ${rp(cv)} = ${rp(nonCv)}`}
          items={itemsPay(rows, "non_cv")}
          note="Perhitungan ini tidak membuat transaksi baru."
        />
      </div>
      <ReportTable
        columns={columns}
        rows={rows}
        empty="Belum ada pendapatan Non-CV pada periode ini."
        footer={
          <>
            <td className="px-3 py-2.5" colSpan={3}>
              Total
            </td>
            <td className="px-3 py-2.5 text-right">{rp(bayar)}</td>
            <td className="px-3 py-2.5 text-right text-indigo-700">{rp(cv)}</td>
            <td className="px-3 py-2.5 text-right text-emerald-700">
              {rp(nonCv)}
            </td>
            <td className="px-3 py-2.5"></td>
          </>
        }
      />
    </ReportSection>
  );
}
