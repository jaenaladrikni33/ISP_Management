import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZES = [25, 50, 75, 100];

// Hook paginasi: default 25 baris per halaman, bisa diganti 25/50/75/100.
export function usePagination(list, initialSize = 25) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => list.slice((current - 1) * pageSize, current * pageSize),
    [list, current, pageSize],
  );
  const changeSize = (s) => {
    setPageSize(Number(s));
    setPage(1);
  };
  return {
    page: current,
    setPage,
    pageSize,
    setPageSize: changeSize,
    pageItems,
    totalPages,
    total,
  };
}

function pageNumbers(current, totalPages) {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  const nums = [1];
  let start = Math.max(2, current - 1);
  let end = Math.min(totalPages - 1, current + 1);
  if (current <= 3) {
    start = 2;
    end = 4;
  }
  if (current >= totalPages - 2) {
    start = totalPages - 3;
    end = totalPages - 1;
  }
  if (start > 2) nums.push("…");
  for (let i = start; i <= end; i++) nums.push(i);
  if (end < totalPages - 1) nums.push("…");
  nums.push(totalPages);
  return nums;
}

// Footer paginasi: pilih jumlah baris + tombol nomor halaman & next/prev.
export default function TablePager({
  page,
  setPage,
  pageSize,
  setPageSize,
  totalPages,
  total,
}) {
  if (!total) return null;
  const nums = pageNumbers(page, totalPages);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="mt-3 flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-1 pt-3 text-xs text-slate-500 sm:flex-row">
      <div className="flex items-center gap-2">
        <span>Menampilkan</span>
        <Select value={String(pageSize)} onValueChange={setPageSize}>
          <SelectTrigger className="h-8 w-[74px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>
          baris · {from}–{to} dari {total}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {nums.map((n, idx) =>
          n === "…" ? (
            <span key={`e${idx}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <Button
              key={n}
              size="sm"
              variant={n === page ? "default" : "outline"}
              className="h-8 min-w-[32px] px-2"
              onClick={() => setPage(n)}
            >
              {n}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
