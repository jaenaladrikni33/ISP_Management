import React from "react";
import { ArrowRight } from "lucide-react";

const STEPS = [
  {
    t: "1 · Transaksi",
    d: "Pembayaran, Rapel, Setoran CV, Gaji CV, Pengeluaran",
  },
  {
    t: "2 · Sumber Data",
    d: "Dibaca lewat ID transaksi, tidak dihitung dua kali",
  },
  {
    t: "3 · Perhitungan",
    d: "CV / Non-CV, pajak, dan saldo dihitung otomatis",
  },
  { t: "4 · Laporan", d: "Hanya membaca, tidak membuat transaksi baru" },
];

// Alur: TRANSAKSI -> SUMBER DATA -> PERHITUNGAN -> LAPORAN
export default function ReportFlow() {
  return (
    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {STEPS.map((s, i) => (
        <div
          key={s.t}
          className="relative rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm"
        >
          <p className="text-xs font-semibold text-slate-800">{s.t}</p>
          <p className="text-[11px] leading-snug text-slate-500">{s.d}</p>
          {i < STEPS.length - 1 && (
            <ArrowRight className="absolute -right-2.5 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rounded-full bg-white text-slate-400 sm:block" />
          )}
        </div>
      ))}
    </div>
  );
}
