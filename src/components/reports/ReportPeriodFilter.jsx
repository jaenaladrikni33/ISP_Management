import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RANGE_OPTIONS } from "@/lib/reportCalc";
import { addMonths, currentPeriod, periodLabel } from "@/lib/billing";

const monthList = () =>
  Array.from({ length: 24 }, (_, i) => addMonths(currentPeriod(), -i));

// Filter periode global: dipakai semua bagian laporan.
export default function ReportPeriodFilter({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-100 bg-white p-1 shadow-sm">
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => set({ range: r.key })}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${value.range === r.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      {value.range === "pick" && (
        <Select value={value.month} onValueChange={(v) => set({ month: v })}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Pilih bulan" />
          </SelectTrigger>
          <SelectContent>
            {monthList().map((m) => (
              <SelectItem key={m} value={m}>
                {periodLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {value.range === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={value.cStart}
            onChange={(e) => set({ cStart: e.target.value })}
            className="w-40"
          />
          <span className="text-slate-400">s/d</span>
          <Input
            type="date"
            value={value.cEnd}
            onChange={(e) => set({ cEnd: e.target.value })}
            className="w-40"
          />
        </div>
      )}
    </div>
  );
}
