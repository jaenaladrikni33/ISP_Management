import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

// useSort: reusable column-sort hook for tables
export function useSort(initialKey, initialDir = "asc") {
  const [sortKey, setSortKey] = useState(initialKey);
  const [sortDir, setSortDir] = useState(initialDir);
  const toggleSort = (key) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };
  const sortFn = (arr, accessor) => {
    const sorted = [...arr].sort((a, b) => {
      const av = accessor(a, sortKey);
      const bv = accessor(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv), "id");
    });
    return sortDir === "desc" ? sorted.reverse() : sorted;
  };
  return { sortKey, sortDir, toggleSort, sortFn };
}

// SortableTh: table header with arrow indicator
export function SortableTh({
  label,
  field,
  sortKey,
  sortDir,
  onSort,
  align = "left",
  className,
}) {
  const active = field === sortKey;
  return (
    <th
      className={cn(
        "px-4 py-3 font-medium select-none",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 hover:text-slate-900"
      >
        {label}
        <span
          className={cn(
            "text-[10px] transition-transform",
            active ? "text-slate-900" : "text-slate-300",
          )}
        >
          {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

// InfoBadge: exclamation-in-circle that shows an explanation popover on click
export function InfoBadge({ text, title }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500 hover:border-slate-500 hover:text-slate-700 align-middle"
        >
          !
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 text-xs leading-relaxed text-slate-600"
        side="top"
      >
        {title && <p className="mb-1 font-semibold text-slate-800">{title}</p>}
        {text}
      </PopoverContent>
    </Popover>
  );
}
