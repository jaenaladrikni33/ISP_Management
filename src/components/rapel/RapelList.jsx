import React from "react";
import { formatCurrency, formatDate } from "@/lib/billing";
import {
  RapelStatusBadge,
  RapelRowActions,
} from "@/components/rapel/RapelParts";
import RapelCard from "@/components/rapel/RapelCard";

// Daftar Rapel: tabel di layar lebar, kartu di ponsel.
export default function RapelList({ rows, busyId, onApply, onVoid, onDelete }) {
  return (
    <>
      <div className="space-y-2 sm:hidden">
        {rows.map((r) => (
          <RapelCard
            key={r.id}
            row={r}
            busy={busyId === r.id}
            onApply={onApply}
            onVoid={onVoid}
            onDelete={onDelete}
          />
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">Tanggal</th>
                <th className="px-3 py-3 font-medium">Pelanggan</th>
                <th className="px-3 py-3 font-medium">Customer ID</th>
                <th className="px-3 py-3 font-medium">Periode</th>
                <th className="px-3 py-3 text-right font-medium">Nominal</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Tagihan Tujuan</th>
                <th className="px-3 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                    {formatDate(r.date)}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-900">
                      {r.customer_name}
                    </p>
                    <p className="font-mono text-[11px] text-slate-400">
                      {r.rapelId}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-600">
                    {r.customer_code || "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {r.periodText}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-indigo-600">
                    {formatCurrency(r.amount)}
                  </td>
                  <td className="px-3 py-3">
                    <RapelStatusBadge state={r.state} />
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    <p>{r.invoiceText}</p>
                    {r.detailText && (
                      <p className="text-slate-400">{r.detailText}</p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <RapelRowActions
                      row={r}
                      busy={busyId === r.id}
                      onApply={onApply}
                      onVoid={onVoid}
                      onDelete={onDelete}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
