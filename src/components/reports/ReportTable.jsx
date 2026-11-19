import React from "react";
import { cn } from "@/lib/utils";

// Tabel laporan sederhana (hanya baca). columns: [{ key, label, align, render }]
export default function ReportTable({
  columns,
  rows,
  footer,
  empty = "Tidak ada transaksi pada periode ini.",
  maxRows = 300,
}) {
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
        {empty}
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap px-3 py-2.5 font-medium",
                    c.align === "right" && "text-right",
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, maxRows).map((r, i) => (
              <tr key={r.key || r.id || i} className="hover:bg-slate-50">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-3 py-2.5",
                      c.align === "right" && "whitespace-nowrap text-right",
                      c.className,
                    )}
                  >
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-semibold">
                {footer}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {rows.length > maxRows && (
        <div className="px-4 py-2 text-xs text-slate-400">
          Menampilkan {maxRows} dari {rows.length} baris. Persempit filter
          periode untuk melihat semuanya.
        </div>
      )}
    </div>
  );
}
