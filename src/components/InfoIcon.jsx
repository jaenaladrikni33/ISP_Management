import React, { useState } from "react";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const stop = (e) => e.stopPropagation();
const MAX_ITEMS = 150;

const TRIGGER = {
  card: "bg-white/25 text-white ring-1 ring-white/50 hover:bg-white/40",
  plain: "bg-sky-50 text-sky-600 ring-1 ring-sky-200 hover:bg-sky-100",
};

function Section({ label, children }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      {children}
    </div>
  );
}

// ⓘ — klik membuka jendela detail: nama nominal, nominal, periode, sumber, rincian, rumus.
// Hanya informasi: tidak membuat, mengubah, atau menghapus data apa pun.
// stopPropagation + preventDefault di tombol agar aman dipakai di dalam <Link> kartu.
export function InfoIcon({
  title = "Detail Nominal",
  value,
  period,
  source,
  formula,
  note,
  items,
  itemsTitle = "Transaksi pembentuk nominal",
  variant = "card",
  className,
  children,
}) {
  const [open, setOpen] = useState(false);
  const show = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };
  const shown = (items || []).slice(0, MAX_ITEMS);
  const hidden = (items || []).length - shown.length;

  return (
    <span className="inline-flex align-middle" onClick={stop}>
      <button
        type="button"
        aria-label={`Lihat detail ${title}`}
        title="Klik untuk melihat sumber & perhitungan"
        onClick={show}
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors",
          TRIGGER[variant] || TRIGGER.card,
          className,
        )}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-6 text-base">{title}</DialogTitle>
            <DialogDescription>
              Detail sumber dan perhitungan nominal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm text-slate-700">
            {value != null && (
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase text-slate-400">Nominal</p>
                <p className="font-heading text-xl font-bold text-slate-900">
                  {value}
                </p>
              </div>
            )}
            {period && (
              <Section label="Periode">
                <p>{period}</p>
              </Section>
            )}
            {source && (
              <Section label="Sumber transaksi">
                <p>{source}</p>
              </Section>
            )}
            {children && (
              <Section label="Rincian">
                <div className="space-y-1 [&_p]:text-xs [&_p]:text-slate-500">
                  {children}
                </div>
              </Section>
            )}
            {formula && (
              <Section label="Rumus / perhitungan">
                <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-relaxed">
                  {formula}
                </p>
              </Section>
            )}
            {shown.length > 0 && (
              <Section label={`${itemsTitle} (${(items || []).length})`}>
                <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100">
                  {shown.map((it, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-3 px-3 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-800">
                          {it.label}
                        </p>
                        {it.sub && (
                          <p className="truncate text-[11px] text-slate-400">
                            {it.sub}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-slate-800">
                        {it.value}
                      </span>
                    </div>
                  ))}
                  {hidden > 0 && (
                    <p className="px-3 py-1.5 text-[11px] text-slate-400">
                      +{hidden} transaksi lainnya
                    </p>
                  )}
                </div>
              </Section>
            )}
            {note && <p className="text-xs text-slate-500">{note}</p>}
            <p className="border-t border-slate-100 pt-2 text-[11px] text-slate-400">
              Hanya informasi — melihat detail tidak mengubah data atau
              transaksi.
            </p>
          </div>

          <DialogFooter>
            <Button className="w-full sm:w-auto" onClick={() => setOpen(false)}>
              TUTUP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}

// Baris rincian di dalam jendela ⓘ
export function InfoLine({ label, value, tone = "text-slate-700" }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={cn("font-medium", tone)}>{value}</span>
    </div>
  );
}
