import React from "react";
import { Coins, Banknote, TrendingUp, PiggyBank } from "lucide-react";
import { Badge } from "@/components/ui-bits";
import { InfoLine } from "@/components/InfoIcon";
import { formatCurrency as rp, formatDate } from "@/lib/billing";
import { itemsSource } from "@/lib/reportItems";
import ReportSection from "@/components/reports/ReportSection";
import ReportTable from "@/components/reports/ReportTable";
import ReportStatCard from "@/components/reports/ReportStatCard";

// Laporan Pemasukan: terpadu dari sumber transaksi (anti double counting lewat ID sumber).
export default function IncomeTab({ rep, rangeText }) {
  const noncv = rep.incomeRows.filter(
    (r) => r.source_type === "PEMBAYARAN_PELANGGAN",
  );
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
      key: "kategori",
      label: "Kategori",
      render: (r) => (
        <span className="font-medium text-slate-900">{r.kategori}</span>
      ),
    },
    {
      key: "keterangan",
      label: "Keterangan",
      className: "max-w-[220px] truncate text-slate-600",
    },
    {
      key: "sumber",
      label: "Sumber",
      render: (r) => <span className="text-xs text-slate-500">{r.sumber}</span>,
    },
    {
      key: "source_id",
      label: "ID Sumber",
      render: (r) => (
        <span className="font-mono text-[11px] text-slate-400">
          {String(r.source_id).slice(-8)}
        </span>
      ),
    },
    {
      key: "jenis",
      label: "Jenis",
      render: (r) => (
        <Badge
          className={
            r.jenis === "OTOMATIS"
              ? "bg-sky-100 text-sky-700"
              : "bg-amber-100 text-amber-700"
          }
        >
          {r.jenis}
        </Badge>
      ),
    },
    {
      key: "nominal",
      label: "Nominal",
      align: "right",
      render: (r) => <b className="text-emerald-600">{rp(r.nominal)}</b>,
    },
  ];

  return (
    <ReportSection
      title="Laporan Pemasukan"
      source="Pendapatan Non-CV (dari Pembayaran), Gaji/Pembayaran CV (dari Menu Gaji CV), dan Pemasukan manual tanpa sumber lain"
      formula="Non-CV + Gaji CV + Pemasukan Lain. Satu transaksi sumber hanya dihitung sekali."
      link={{ to: "/keuangan", label: "Kelola di menu Keuangan" }}
    >
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ReportStatCard
          label="Pendapatan Non-CV"
          amount={rep.totalNonCV}
          icon={Coins}
          tone="emerald"
          sub="Otomatis"
          period={rangeText}
          source="Transaksi Pembayaran pelanggan"
          formula={`Pembayaran ${rp(rep.totalBayar)} − Bagian CV ${rp(rep.totalCV)}`}
          items={itemsSource(noncv)}
        />
        <ReportStatCard
          label="Gaji/Pembayaran CV"
          amount={rep.totalPayout}
          icon={Banknote}
          tone="rose"
          sub="Otomatis dari Menu Gaji CV"
          period={rangeText}
          source="Menu Pembayaran/Gaji CV"
          formula="Jumlah transaksi Gaji/Pembayaran CV"
          items={itemsSource(rep.payoutRows)}
          note="Input Gaji CV cukup di Menu Gaji CV — otomatis muncul di sini, tidak perlu diinput lagi."
        />
        <ReportStatCard
          label="Pemasukan Lain"
          amount={rep.totalManual}
          icon={TrendingUp}
          tone="sky"
          sub="Manual"
          period={rangeText}
          source="Input Keuangan"
          formula="Jumlah pemasukan manual"
          items={itemsSource(rep.manualRows)}
        />
        <ReportStatCard
          label="Total Pemasukan"
          amount={rep.totalPemasukan}
          icon={PiggyBank}
          tone="indigo"
          period={rangeText}
          source="Semua sumber pemasukan di atas"
          formula={`${rp(rep.totalNonCV)} + ${rp(rep.totalPayout)} + ${rp(rep.totalManual)} = ${rp(rep.totalPemasukan)}`}
          items={itemsSource(rep.incomeRows)}
        >
          <InfoLine label="Pendapatan Non-CV" value={rp(rep.totalNonCV)} />
          <InfoLine label="Gaji/Pembayaran CV" value={rp(rep.totalPayout)} />
          <InfoLine label="Pemasukan Lain" value={rp(rep.totalManual)} />
        </ReportStatCard>
      </div>
      <ReportTable
        columns={columns}
        rows={rep.incomeRows}
        empty="Belum ada pemasukan pada periode ini."
        footer={
          <>
            <td className="px-3 py-2.5" colSpan={6}>
              Total Pemasukan
            </td>
            <td className="px-3 py-2.5 text-right text-emerald-700">
              {rp(rep.totalPemasukan)}
            </td>
          </>
        }
      />
    </ReportSection>
  );
}
