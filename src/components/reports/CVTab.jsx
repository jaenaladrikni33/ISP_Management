import React from "react";
import { Wallet, Landmark, Coins } from "lucide-react";
import { Badge } from "@/components/ui-bits";
import {
  formatCurrency as rp,
  formatDate,
  periodLabel,
  STATUS_LABELS,
  STATUS_COLORS,
  CV_STATUS_LABELS,
  CV_STATUS_COLORS,
} from "@/lib/billing";
import { itemsPay } from "@/lib/reportItems";
import ReportSection from "@/components/reports/ReportSection";
import ReportTable from "@/components/reports/ReportTable";
import ReportStatCard from "@/components/reports/ReportStatCard";

// Laporan CV: hanya bagian pembayaran yang menjadi CV. Non-CV tidak masuk total CV.
export default function CVTab({ rep, rangeText }) {
  const rows = rep.cvList;
  const bayar = rows.reduce((s, r) => s + r.payment_amount, 0);
  const nonCv = rows.reduce((s, r) => s + r.non_cv, 0);
  const cv = rep.totalCV;

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
      label: "Bagian CV",
      align: "right",
      render: (r) => <b className="text-indigo-600">{rp(r.dana_cv)}</b>,
    },
    {
      key: "non_cv",
      label: "Non-CV",
      align: "right",
      render: (r) => <span className="text-slate-500">{rp(r.non_cv)}</span>,
    },
    {
      key: "pay",
      label: "Status Pembayaran Pelanggan",
      render: (r) => (
        <Badge
          className={STATUS_COLORS[r.status] || "bg-slate-100 text-slate-600"}
        >
          {STATUS_LABELS[r.status] || r.status}
        </Badge>
      ),
    },
    {
      key: "setor",
      label: "Status Setoran CV",
      render: (r) => {
        const st = rep.cvStatusByKey[`${r.customer_id}|${r.period}`];
        return st ? (
          <Badge className={CV_STATUS_COLORS[st]}>{CV_STATUS_LABELS[st]}</Badge>
        ) : (
          <span className="text-slate-400">-</span>
        );
      },
    },
  ];

  return (
    <ReportSection
      title="Laporan CV"
      source="Transaksi Pembayaran pelanggan yang tagihannya SUDAH LUNAS — hanya bagian yang menjadi Setoran CV"
      formula="Pembayaran − Non-CV = Bagian CV (pelanggan yang belum lunas / masih cicilan belum masuk laporan ini)"
      link={{ to: "/laporan-cv", label: "Pembagian Pusat / Mitra / PPh 23" }}
    >
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ReportStatCard
          label="Pembayaran (transaksi CV)"
          amount={bayar}
          icon={Wallet}
          tone="emerald"
          period={rangeText}
          source="Transaksi Pembayaran pelanggan"
          formula="Jumlah pembayaran yang memiliki bagian CV"
          items={itemsPay(rows)}
        />
        <ReportStatCard
          label="Total Bagian CV"
          amount={cv}
          icon={Landmark}
          tone="indigo"
          period={rangeText}
          source="Transaksi Pembayaran pelanggan → Setoran CV"
          formula={`Pembayaran ${rp(bayar)} − Non-CV ${rp(nonCv)} = CV ${rp(cv)}`}
          items={itemsPay(rows, "dana_cv")}
          note="Status pembayaran pelanggan dan status Setoran CV berdiri sendiri."
        />
        <ReportStatCard
          label="Non-CV (tidak masuk CV)"
          amount={nonCv}
          icon={Coins}
          tone="slate"
          period={rangeText}
          source="Transaksi Pembayaran yang sama"
          formula="Pembayaran − Bagian CV"
          items={itemsPay(rows, "non_cv")}
        />
      </div>
      <ReportTable
        columns={columns}
        rows={rows}
        empty="Belum ada pelanggan CV yang lunas pada periode ini (pelanggan cicilan / belum bayar tidak dimasukkan)."
        footer={
          <>
            <td className="px-3 py-2.5" colSpan={3}>
              Total
            </td>
            <td className="px-3 py-2.5 text-right">{rp(bayar)}</td>
            <td className="px-3 py-2.5 text-right text-indigo-700">{rp(cv)}</td>
            <td className="px-3 py-2.5 text-right">{rp(nonCv)}</td>
            <td className="px-3 py-2.5" colSpan={2}></td>
          </>
        }
      />
    </ReportSection>
  );
}
