import React from "react";
import { formatCurrency } from "@/lib/billing";

const TONES = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  indigo: "bg-indigo-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  slate: "bg-slate-500",
  violet: "bg-violet-500",
};

function Row({ label, nominal, base, tone }) {
  const persen = base > 0 ? (nominal / base) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-28 shrink-0 text-sm text-slate-600">{label}</div>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${TONES[tone]}`}
          style={{ width: `${Math.min(Math.abs(persen), 100)}%` }}
        />
      </div>
      <div className="w-14 shrink-0 text-right text-sm font-semibold text-slate-900">
        {persen.toFixed(1)}%
      </div>
      <div className="hidden w-28 shrink-0 text-right text-xs text-slate-500 sm:block">
        {formatCurrency(nominal)}
      </div>
    </div>
  );
}

// Ringkasan pembagian persentase setiap komponen terhadap total tagihan pelanggan (100%).
export default function DashboardPercentBreakdown({
  totalTagihan,
  sudahBayar,
  belumBayar,
  cvNominal,
  pajakNominal,
  pengeluaran,
  untung,
  gajiNominal = 0,
  rangeText,
}) {
  return (
    <div className="mt-6 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold text-slate-900">
            Pembagian Persentase
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Rincian pembagian nominal terhadap total tagihan pelanggan (100%)
            {rangeText ? ` · ${rangeText}` : ""}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Total Tagihan</div>
          <div className="text-sm font-bold text-slate-900">
            {formatCurrency(totalTagihan)}
          </div>
        </div>
      </div>

      <div className="mt-4 divide-y divide-slate-100">
        <Row
          label="Sudah Bayar"
          nominal={sudahBayar}
          base={totalTagihan}
          tone="emerald"
        />
        <Row
          label="Belum Bayar"
          nominal={belumBayar}
          base={totalTagihan}
          tone="amber"
        />
        <Row
          label="CV / Mitra"
          nominal={cvNominal}
          base={totalTagihan}
          tone="indigo"
        />
        <Row
          label="Pajak (PPH23)"
          nominal={pajakNominal}
          base={totalTagihan}
          tone="rose"
        />
        <Row
          label="Pengeluaran"
          nominal={pengeluaran}
          base={totalTagihan}
          tone="sky"
        />
        {gajiNominal > 0 && (
          <Row
            label="Gaji Saya"
            nominal={gajiNominal}
            base={totalTagihan}
            tone="violet"
          />
        )}
        <Row
          label="Untung Bersih"
          nominal={untung}
          base={totalTagihan}
          tone="emerald"
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Kategori <b>Gaji</b> dikeluarkan dari Pengeluaran dan masuk ke Untung
        Bersih karena itu keuntungan owner, bukan biaya operasional.
      </p>
    </div>
  );
}
