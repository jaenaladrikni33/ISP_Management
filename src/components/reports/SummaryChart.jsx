import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatCurrency, periodLabel } from "@/lib/billing";

// Grafik Pemasukan vs Pengeluaran dari transaksi pada periode laporan.
export default function SummaryChart({ rep }) {
  const data = useMemo(() => {
    const perDay = rep.start.slice(0, 7) === rep.end.slice(0, 7);
    const keyOf = (d) =>
      perDay ? (d || "").slice(0, 10) : (d || "").slice(0, 7);
    const labelOf = (k) =>
      perDay ? k.slice(8) : periodLabel(k).split(" ")[0].slice(0, 3);
    const by = {};
    const add = (d, f, v) => {
      const k = keyOf(d);
      if (!k) return;
      by[k] = by[k] || { masuk: 0, keluar: 0 };
      by[k][f] += v;
    };
    rep.incomeRows.forEach((r) => add(r.date, "masuk", r.nominal));
    rep.expenseRows.forEach((r) => add(r.date, "keluar", r.nominal));
    return Object.keys(by)
      .sort()
      .map((k) => ({
        name: labelOf(k),
        Pemasukan: by[k].masuk,
        Pengeluaran: by[k].keluar,
      }));
  }, [rep]);

  return (
    <div className="mt-6 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="font-heading text-base font-semibold text-slate-900">
        Grafik Pemasukan vs Pengeluaran
      </h3>
      <p className="text-xs text-slate-500">
        Dari transaksi pada periode laporan
      </p>
      <div className="mt-4 h-64">
        {data.length === 0 ? (
          <p className="pt-16 text-center text-sm text-slate-400">
            Belum ada transaksi pada periode ini.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
              />
              <Tooltip
                formatter={(v) => formatCurrency(v)}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Pengeluaran" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
