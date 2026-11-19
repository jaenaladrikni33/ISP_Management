import React from "react";
import { Users, UserCheck } from "lucide-react";

// Menampilkan persentase pelanggan yang sudah lunas terhadap total pelanggan terdaftar.
export default function DashboardCustomerLunasPercent({
  total,
  lunas,
  periodText,
}) {
  const persen = total > 0 ? (lunas / total) * 100 : 0;

  return (
    <div className="mt-6 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-heading text-base font-semibold text-slate-900">
            <UserCheck className="h-4 w-4 text-emerald-500" /> Persentase
            Pelanggan Lunas
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Pelanggan sudah lunas dari total pelanggan terdaftar
            {periodText ? ` · ${periodText}` : ""}
          </p>
        </div>
        <div className="text-3xl font-bold leading-none text-emerald-600">
          {persen.toFixed(1)}%
        </div>
      </div>

      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
          style={{ width: `${Math.min(persen, 100)}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Users className="h-4 w-4 text-slate-400" /> Total Terdaftar:{" "}
          <b className="text-slate-900">{total}</b>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <UserCheck className="h-4 w-4 text-emerald-500" /> Sudah Lunas:{" "}
          <b className="text-emerald-600">{lunas}</b>
        </div>
      </div>
    </div>
  );
}
