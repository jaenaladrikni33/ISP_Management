import React from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
import { StatCard } from "@/components/ui-bits";
import { InfoIcon, InfoLine } from "@/components/InfoIcon";
import { formatCurrency as rp } from "@/lib/billing";
import { itemsPay, itemsSource } from "@/lib/reportItems";

const cardLink = "block transition-transform hover:-translate-y-0.5";

// Kotak Keuangan di Dashboard — angka sama dengan menu Keuangan & Laporan (pemasukan terpadu).
export default function DashboardFinanceCards({ stats, rangeText }) {
  const rep = stats.rep;
  const info = (title, amount, formula, extra = {}) => (
    <InfoIcon
      title={title}
      value={rp(amount)}
      period={rangeText}
      formula={formula}
      {...extra}
    />
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Link to="/pendapatan-noncv" className={cardLink}>
        <StatCard
          label="Pendapatan Non-CV"
          value={rp(stats.totalPendapatanNonCv)}
          icon={TrendingUp}
          tone="emerald"
          info={info(
            "Pendapatan Non-CV",
            stats.totalPendapatanNonCv,
            `Pembayaran ${rp(stats.totalNonCVBayar)} − Setoran CV ${rp(stats.totalNonCVSetoran)} = Non-CV ${rp(stats.totalPendapatanNonCv)}`,
            {
              source: "Transaksi Pembayaran pelanggan (dihitung otomatis)",
              items: itemsPay(rep.nonCvList, "non_cv"),
            },
          )}
        />
      </Link>
      <Link to="/keuangan" className={cardLink}>
        <StatCard
          label="Pendapatan Lain"
          value={rp(stats.totalPendapatanLain)}
          icon={TrendingUp}
          tone="sky"
          info={info(
            "Pendapatan Lain",
            stats.totalPendapatanLain,
            "Jumlah pemasukan manual tanpa sumber transaksi otomatis lain",
            {
              source: "Input Keuangan (manual)",
              items: itemsSource(rep.manualRows),
            },
          )}
        />
      </Link>
      <Link to="/keuangan" className={cardLink}>
        <StatCard
          label="Total Pengeluaran"
          value={rp(stats.totalPengeluaran)}
          icon={TrendingDown}
          tone="rose"
          info={info(
            "Total Pengeluaran",
            stats.totalPengeluaran,
            "Jumlah seluruh pengeluaran aktif pada periode",
            {
              source: "Input Keuangan — Pengeluaran",
              items: itemsSource(rep.expenseRows),
            },
          )}
        />
      </Link>
      <Link to="/keuangan" className={cardLink}>
        <StatCard
          label="Saldo Kas (Uang Real)"
          value={rp(stats.saldoKas)}
          icon={PiggyBank}
          tone={stats.saldoKas >= 0 ? "emerald" : "red"}
          info={
            <InfoIcon
              title="Saldo Kas"
              value={rp(stats.saldoKas)}
              period={rangeText}
              source="Total Pemasukan (Non-CV + Gaji CV + Pemasukan Lain), Total Pengeluaran, dan Dana CV yang sudah masuk tetapi belum disetor"
              formula={`Pemasukan ${rp(stats.totalPemasukan)} − Pengeluaran ${rp(stats.totalPengeluaran)} + Dana CV belum disetor ${rp(stats.cvHeld)} = ${rp(stats.saldoKas)}`}
            >
              <InfoLine
                label="Pendapatan Non-CV"
                value={rp(stats.totalPendapatanNonCv)}
                tone="text-emerald-600"
              />
              <InfoLine
                label="Gaji/Pembayaran CV"
                value={rp(stats.totalPayoutCV)}
                tone="text-rose-600"
              />
              <InfoLine
                label="Pemasukan Lain"
                value={rp(stats.totalPendapatanLain)}
                tone="text-sky-600"
              />
              <InfoLine
                label="Total Pemasukan"
                value={rp(stats.totalPemasukan)}
                tone="text-indigo-600"
              />
              <InfoLine
                label="Total Pengeluaran"
                value={rp(stats.totalPengeluaran)}
                tone="text-rose-600"
              />
              <InfoLine
                label="Dana CV Belum Disetor (uang di tangan)"
                value={rp(stats.cvHeld)}
                tone="text-amber-600"
              />
            </InfoIcon>
          }
        />
      </Link>
    </div>
  );
}
