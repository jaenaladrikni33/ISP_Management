import React from "react";
import {
  Wallet,
  Landmark,
  Coins,
  Banknote,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  FileText,
  Hourglass,
  CheckCheck,
} from "lucide-react";
import { formatCurrency as rp } from "@/lib/billing";
import { InfoLine } from "@/components/InfoIcon";
import {
  itemsPay,
  itemsSource,
  itemsSetoran,
  itemsUnpaid,
} from "@/lib/reportItems";
import ReportStatCard from "@/components/reports/ReportStatCard";

export default function SummaryCards({ rep, rangeText }) {
  const p = { period: rangeText };
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <ReportStatCard
        {...p}
        label="Pembayaran Pelanggan"
        amount={rep.totalBayar}
        icon={Wallet}
        tone="emerald"
        sub={`${rep.payRows.length} transaksi`}
        source="Transaksi Pembayaran pelanggan (termasuk Rapel)"
        formula="Jumlah nominal pembayaran aktif pada periode"
        items={itemsPay(rep.payRows)}
      />
      <ReportStatCard
        {...p}
        label="Bagian CV"
        amount={rep.totalCV}
        icon={Landmark}
        tone="indigo"
        sub="Dari pembayaran pelanggan"
        source="Transaksi Pembayaran pelanggan yang menjadi Setoran CV"
        items={itemsPay(rep.cvList, "dana_cv")}
        formula={`Pembayaran ${rp(rep.totalBayar)} − Non-CV ${rp(rep.totalNonCV)} = Bagian CV ${rp(rep.totalCV)}`}
      />
      <ReportStatCard
        {...p}
        label="Pendapatan Non-CV"
        amount={rep.totalNonCV}
        icon={Coins}
        tone="emerald"
        sub="Otomatis"
        source="Transaksi Pembayaran pelanggan"
        items={itemsPay(rep.nonCvList, "non_cv")}
        formula={`Pembayaran ${rp(rep.totalBayar)} − Bagian CV ${rp(rep.totalCV)} = Non-CV ${rp(rep.totalNonCV)}`}
      />
      <ReportStatCard
        {...p}
        label="Gaji/Pembayaran CV"
        amount={rep.totalPayout}
        icon={Banknote}
        tone="rose"
        sub={`${rep.payoutRows.length} transaksi`}
        source="Menu Pembayaran/Gaji CV (otomatis masuk Pemasukan)"
        items={itemsSource(rep.payoutRows)}
        formula="Jumlah transaksi Gaji/Pembayaran CV aktif pada periode"
      />
      <ReportStatCard
        {...p}
        label="Pemasukan Lain"
        amount={rep.totalManual}
        icon={TrendingUp}
        tone="sky"
        sub={`${rep.manualRows.length} transaksi`}
        source="Input Keuangan (manual, tanpa sumber otomatis lain)"
        items={itemsSource(rep.manualRows)}
        formula="Jumlah pemasukan manual aktif pada periode"
      />
      <ReportStatCard
        {...p}
        label="Total Pemasukan"
        amount={rep.totalPemasukan}
        icon={PiggyBank}
        tone="indigo"
        sub="Non-CV + Gaji CV + Lain"
        source="Pendapatan Non-CV, Gaji/Pembayaran CV, dan Pemasukan Lain (tiap transaksi sumber dihitung sekali)"
        items={itemsSource(rep.incomeRows)}
        formula={`${rp(rep.totalNonCV)} + ${rp(rep.totalPayout)} + ${rp(rep.totalManual)} = ${rp(rep.totalPemasukan)}`}
      >
        <InfoLine
          label="Pendapatan Non-CV"
          value={rp(rep.totalNonCV)}
          tone="text-emerald-600"
        />
        <InfoLine
          label="Gaji/Pembayaran CV"
          value={rp(rep.totalPayout)}
          tone="text-rose-600"
        />
        <InfoLine
          label="Pemasukan Lain"
          value={rp(rep.totalManual)}
          tone="text-sky-600"
        />
      </ReportStatCard>
      <ReportStatCard
        {...p}
        label="Total Pengeluaran"
        amount={rep.totalExpense}
        icon={TrendingDown}
        tone="rose"
        sub={`${rep.expenseRows.length} transaksi`}
        source="Input Keuangan — Pengeluaran"
        items={itemsSource(rep.expenseRows)}
        formula="Jumlah pengeluaran aktif pada periode"
      >
        {rep.expByCat.map(([k, v]) => (
          <InfoLine key={k} label={k} value={rp(v)} tone="text-rose-600" />
        ))}
      </ReportStatCard>
      <ReportStatCard
        {...p}
        label="Saldo Kas"
        amount={rep.saldoKas}
        icon={PiggyBank}
        tone={rep.saldoKas >= 0 ? "emerald" : "red"}
        sub="Saldo + Dana CV belum disetor"
        source="Total Pemasukan, Total Pengeluaran, dan Dana CV yang sudah masuk tetapi belum disetorkan"
        items={itemsSetoran(rep.cvHeldRows, "held")}
        formula={`${rp(rep.totalPemasukan)} − ${rp(rep.totalExpense)} + ${rp(rep.cvHeld)} = ${rp(rep.saldoKas)}`}
        note="Dana CV ditahan adalah uang pelanggan CV yang sudah lunas tetapi belum disetorkan ke CV. Otomatis berkurang saat disetorkan."
      >
        <InfoLine
          label="Saldo Operasional"
          value={rp(rep.saldo)}
          tone="text-slate-600"
        />
        <InfoLine
          label="Dana CV Ditahan"
          value={rp(rep.cvHeld)}
          tone="text-amber-600"
        />
      </ReportStatCard>
      <ReportStatCard
        {...p}
        label="Total Setoran CV"
        amount={rep.totalSetoran}
        icon={Landmark}
        tone="indigo"
        sub={`${rep.setoranRows.length} setoran`}
        source="Data Setoran CV (per periode tagihan) — bukan dari status lunas pelanggan"
        items={itemsSetoran(rep.setoranRows)}
        formula="Jumlah nominal Setoran CV pada periode tagihan yang dipilih"
      />
      <ReportStatCard
        {...p}
        label="Sudah Disetorkan"
        amount={rep.totalDisetor}
        icon={CheckCheck}
        tone="emerald"
        sub="Status setoran: Disetorkan"
        source="Status pada data Setoran CV"
        items={itemsSetoran(
          rep.setoranRows.filter((r) => r.disetor > 0),
          "disetor",
        )}
        formula="Jumlah Setoran CV berstatus Disetorkan (atau bagian yang sudah disetor)"
      />
      <ReportStatCard
        {...p}
        label="Belum Disetorkan"
        amount={rep.totalBelumSetor}
        icon={Hourglass}
        tone="amber"
        sub="Status setoran: Belum"
        source="Status pada data Setoran CV"
        items={itemsSetoran(
          rep.setoranRows.filter((r) => r.belum > 0),
          "belum",
        )}
        formula={`Total Setoran ${rp(rep.totalSetoran)} − Sudah Disetorkan ${rp(rep.totalDisetor)} = ${rp(rep.totalBelumSetor)}`}
      />
      <ReportStatCard
        label="Piutang Tagihan"
        amount={rep.piutang}
        icon={FileText}
        tone="amber"
        sub={`${rep.unpaid.length} tagihan`}
        period="Posisi saat ini (semua periode)"
        source="Tagihan pelanggan yang belum lunas"
        items={itemsUnpaid(rep.unpaid)}
        formula="Jumlah sisa tagihan (tagihan − pembayaran) yang belum lunas"
      />
    </div>
  );
}
