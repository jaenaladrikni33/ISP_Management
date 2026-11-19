import React from "react";
import { formatCurrency } from "@/lib/billing";
import { Percent } from "lucide-react";

// Menampilkan persentase keuntungan bersih terhadap total omset pelanggan.
export default function DashboardProfitPercent({ omset, profit, rangeText }) {
  const persen = omset > 0 ? (profit / omset) * 100 : 0;
  const positive = persen >= 0;
  const barWidth = Math.min(Math.abs(persen), 100);

  return (
    <div className="mt-6 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-heading text-base font-semibold text-slate-900">
            <Percent className="h-4 w-4 text-emerald-500" /> Persentase
            Keuntungan
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Keuntungan bersih dibagi total tagihan pelanggan (meski belum bayar)
            {rangeText ? ` · ${rangeText}` : ""}
          </p>
        </div>
        <div
          className={`text-3xl font-bold leading-none ${positive ? "text-emerald-600" : "text-rose-600"}`}
        >
          {persen.toFixed(1)}%
        </div>
      </div>

      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${positive ? "bg-gradient-to-r from-emerald-400 to-emerald-600" : "bg-gradient-to-r from-rose-400 to-rose-600"}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="text-slate-600">
          Total Tagihan Pelanggan:{" "}
          <b className="text-slate-900">{formatCurrency(omset)}</b>
        </div>
        <div className="text-slate-600">
          Keuntungan:{" "}
          <b className={positive ? "text-emerald-600" : "text-rose-600"}>
            {formatCurrency(profit)}
          </b>
        </div>
      </div>
    </div>
  );
}
