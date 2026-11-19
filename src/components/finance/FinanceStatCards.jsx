import React from "react";
import {
  Coins,
  Banknote,
  TrendingUp,
  TrendingDown,
  PiggyBank,
} from "lucide-react";
import { formatCurrency as rp, periodLabel } from "@/lib/billing";
import { InfoLine } from "@/components/InfoIcon";
import { itemsSource } from "@/lib/reportItems";
import ReportStatCard from "@/components/reports/ReportStatCard";

// Kotak nominal menu Keuangan — setiap kotak punya ⓘ (klik untuk sumber, rumus, dan transaksi pembentuk).
export default function FinanceStatCards({
  period,
  nonCVRows,
  payoutRows,
  manualRows,
  activeExp,
  nonCV,
  payoutTotal,
  manualTotal,
  totalPemasukan,
  totalExp,
  expByCat,
  saldo,
  cvHeld = 0,
  cvHeldRows = [],
}) {
  const per = periodLabel(period);
  const expItems = activeExp.map((e) => ({
    kategori: e.category,
    date: e.date,
    keterangan: e.description || "-",
    nominal: Number(e.amount || 0),
  }));

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <ReportStatCard
        label="Pendapatan Non-CV"
        amount={nonCV.total}
        icon={Coins}
        tone="emerald"
        sub={`${per} · OTOMATIS`}
        period={per}
        source="Transaksi Pembayaran pelanggan (dihitung otomatis)"
        items={itemsSource(nonCVRows)}
        formula={`Pembayaran ${rp(nonCV.bayar)} − Setoran CV ${rp(nonCV.cv)} = Non-CV ${rp(nonCV.total)}`}
      />
      <ReportStatCard
        label="Gaji/Pembayaran CV"
        amount={payoutTotal}
        icon={Banknote}
        tone="rose"
        sub={`${payoutRows.length} transaksi · OTOMATIS`}
        period={per}
        source="Menu Gaji/Pembayaran CV"
        items={itemsSource(payoutRows)}
        formula="Jumlah transaksi Gaji/Pembayaran CV aktif pada periode"
        note="Diinput di menu Pembayaran/Gaji CV, bukan di sini — otomatis masuk Pemasukan."
      />
      <ReportStatCard
        label="Pemasukan Lain (Manual)"
        amount={manualTotal}
        icon={TrendingUp}
        tone="sky"
        sub={`${manualRows.length} transaksi · MANUAL`}
        period={per}
        source="Input Keuangan"
        items={itemsSource(manualRows)}
        formula="Jumlah pemasukan manual aktif pada periode"
        note="Hanya untuk pemasukan tanpa sumber transaksi otomatis lain."
      />
      <ReportStatCard
        label="Total Pemasukan"
        amount={totalPemasukan}
        icon={PiggyBank}
        tone="indigo"
        sub={per}
        period={per}
        source="Pendapatan Non-CV, Gaji/Pembayaran CV, dan Pemasukan Lain"
        items={itemsSource([...nonCVRows, ...payoutRows, ...manualRows])}
        formula={`${rp(nonCV.total)} + ${rp(payoutTotal)} + ${rp(manualTotal)} = ${rp(totalPemasukan)}`}
        note="Satu transaksi sumber hanya dihitung sekali (anti double counting)."
      >
        <InfoLine
          label="Pendapatan Non-CV"
          value={rp(nonCV.total)}
          tone="text-emerald-600"
        />
        <InfoLine
          label="Gaji/Pembayaran CV"
          value={rp(payoutTotal)}
          tone="text-rose-600"
        />
        <InfoLine
          label="Pemasukan Lain"
          value={rp(manualTotal)}
          tone="text-sky-600"
        />
      </ReportStatCard>
      <ReportStatCard
        label="Total Pengeluaran"
        amount={totalExp}
        icon={TrendingDown}
        tone="rose"
        sub={`${activeExp.length} transaksi · ${per}`}
        period={per}
        source="Input Keuangan — Pengeluaran"
        items={itemsSource(expItems)}
        formula="Jumlah pengeluaran aktif pada periode"
      >
        {expByCat.map(([k, v]) => (
          <InfoLine key={k} label={k} value={rp(v)} tone="text-rose-600" />
        ))}
      </ReportStatCard>
      <ReportStatCard
        label="Saldo Kas"
        amount={saldo + cvHeld}
        icon={PiggyBank}
        tone={saldo + cvHeld >= 0 ? "emerald" : "red"}
        sub={`${per} · termasuk Dana CV`}
        period={per}
        source="Total Pemasukan, Total Pengeluaran, dan Dana CV yang sudah masuk tetapi belum disetorkan"
        items={cvHeldRows.map((r) => ({
          label: r.customer_name,
          sub: `${periodLabel(r.period)} · belum disetor`,
          value: rp(r.held),
        }))}
        formula={`Pemasukan ${rp(totalPemasukan)} − Pengeluaran ${rp(totalExp)} + Dana CV ${rp(cvHeld)} = ${rp(saldo + cvHeld)}`}
        note="Dana CV ditahan otomatis berkurang saat Setoran CV ditandai disetorkan."
      >
        <InfoLine
          label="Saldo Operasional"
          value={rp(saldo)}
          tone="text-slate-600"
        />
        <InfoLine
          label="Dana CV Ditahan"
          value={rp(cvHeld)}
          tone="text-amber-600"
        />
      </ReportStatCard>
    </div>
  );
}
