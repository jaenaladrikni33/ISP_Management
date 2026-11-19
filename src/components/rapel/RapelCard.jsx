import React from "react";
import { formatCurrency, formatDate } from "@/lib/billing";
import {
  RapelStatusBadge,
  RapelRowActions,
} from "@/components/rapel/RapelParts";

// Tampilan kartu untuk layar kecil (ponsel)
export default function RapelCard({ row, busy, onApply, onVoid, onDelete }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">
            {row.customer_name}
          </p>
          <p className="truncate text-xs text-slate-500">
            {row.customer_code || "-"} · {row.rapelId}
          </p>
        </div>
        <RapelStatusBadge state={row.state} />
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase text-slate-400">Periode tujuan</p>
          <p className="text-sm font-medium text-slate-800">{row.periodText}</p>
        </div>
        <p className="font-heading text-base font-bold text-indigo-600">
          {formatCurrency(row.amount)}
        </p>
      </div>
      <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
        <p>
          <span className="text-slate-400">Tagihan tujuan:</span>{" "}
          {row.invoiceText}
        </p>
        {row.detailText && <p className="text-slate-500">{row.detailText}</p>}
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">
        Dibayar {formatDate(row.date)}
        {row.notes ? ` · ${row.notes}` : ""}
      </p>
      <div className="mt-1">
        <RapelRowActions
          row={row}
          busy={busy}
          onApply={onApply}
          onVoid={onVoid}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
