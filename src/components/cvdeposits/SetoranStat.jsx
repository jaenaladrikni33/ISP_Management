import React from "react";

// Kotak ringkasan Setoran CV (kartu putih) + slot ⓘ.
export default function SetoranStat({
  label,
  value,
  sub,
  tone = "text-slate-900",
  info,
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
      <p className="flex items-center gap-1 text-xs text-slate-500">
        <span className="truncate">{label}</span>
        {info}
      </p>
      <p className={`font-bold ${tone}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}
