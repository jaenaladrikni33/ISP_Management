import React from "react";
import { formatCurrency, periodLabel } from "@/lib/billing";

// Rincian per bulan untuk Rekening Usaha (terbaru di atas).
export default function RekeningMonthTable({ rows }) {
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="font-heading text-sm font-semibold text-slate-900">
          Rincian per Bulan
        </h3>
        <p className="text-[11px] text-slate-400">
          Terbaru di atas · pengeluaran sudah dikurangkan
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Bulan</th>
              <th className="px-4 py-3 text-right font-medium">Masuk</th>
              <th className="px-4 py-3 text-right font-medium">Keluar</th>
              <th className="px-4 py-3 text-right font-medium">Saldo</th>
              <th className="px-4 py-3 text-right font-medium">
                CV Belum Disetor
              </th>
              <th className="px-4 py-3 text-right font-medium">Seharusnya</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.month} className="hover:bg-slate-50">
                <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-900">
                  {periodLabel(r.month)}
                </td>
                <td className="px-4 py-3 text-right text-emerald-600">
                  {formatCurrency(r.masuk)}
                </td>
                <td className="px-4 py-3 text-right text-rose-600">
                  {formatCurrency(r.keluar)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">
                  {formatCurrency(r.saldo)}
                </td>
                <td className="px-4 py-3 text-right text-amber-600">
                  {formatCurrency(r.cvHeld)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-indigo-700">
                  {formatCurrency(r.expected)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
