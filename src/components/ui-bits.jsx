import React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "slate",
  sub,
  info,
}) {
  const tones = {
    slate: "from-slate-600 to-slate-800",
    sky: "from-sky-500 to-blue-600",
    emerald: "from-emerald-500 to-green-600",
    amber: "from-amber-500 to-orange-500",
    red: "from-red-500 to-rose-600",
    indigo: "from-indigo-500 to-violet-600",
    rose: "from-rose-500 to-pink-600",
  };
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-gradient-to-br p-4 text-white shadow-sm transition-shadow hover:shadow-md",
        tones[tone],
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs font-medium text-white/80">
            <span className="truncate">{label}</span>
            {info}
          </p>
          <p className="mt-1.5 font-heading text-sm font-bold leading-tight text-white">
            {value}
          </p>
          {sub && <p className="mt-0.5 text-[10px] text-white/70">{sub}</p>}
        </div>
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Icon style={{ width: 18, height: 18 }} />
          </div>
        )}
      </div>
    </div>
  );
}

export function Badge({ children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, description, icon: Icon, children }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <p className="font-medium text-slate-700">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function Loading({ label = "Memuat data..." }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
      <span className="ml-3 text-sm text-slate-500">{label}</span>
    </div>
  );
}
