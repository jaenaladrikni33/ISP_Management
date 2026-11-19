import React, { useState, useEffect, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Typeable customer combobox. Filters by name / phone / customer_id.
export default function CustomerPicker({
  value,
  onChange,
  customers,
  placeholder = "Cari nama / no. pelanggan...",
  disabled,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const selected = useMemo(
    () => customers.find((c) => c.id === value),
    [customers, value],
  );

  // Sync the input text whenever the selected value changes externally
  useEffect(() => {
    if (selected)
      setQuery(
        `${selected.name}${selected.customer_id ? ` (${selected.customer_id})` : ""}`,
      );
    else setQuery("");
  }, [value, selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const src = q
      ? customers.filter((c) =>
          [c.name, c.phone, c.customer_id, c.area].some((v) =>
            (v || "").toLowerCase().includes(q),
          ),
        )
      : customers;
    return src.slice(0, 60);
  }, [query, customers]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (c) => {
    onChange?.(c.id, c);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <Input
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) onChange?.("", null);
          }}
          onFocus={() => setOpen(true)}
          className="pl-8 pr-8"
        />
        {query && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            onClick={() => {
              setQuery("");
              onChange?.("", null);
              setOpen(true);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">
              Tidak ada pelanggan cocok
            </div>
          ) : (
            filtered.map((c) => (
              <button
                type="button"
                key={c.id}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700",
                  value === c.id && "bg-sky-50 dark:bg-sky-900/30",
                )}
                onClick={() => pick(c)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800 dark:text-slate-100">
                    {c.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {c.customer_id || "-"} · {c.phone || "-"}
                  </span>
                </span>
                {c.status && (
                  <span className="shrink-0 text-[10px] uppercase text-slate-400">
                    {c.status}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
