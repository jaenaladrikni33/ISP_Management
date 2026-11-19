import React from "react";
import { Landmark, Wifi, Wallet, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/billing";

function TypeCard({ title, subtitle, icon: Icon, tone, data }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-white",
            tone,
          )}
        >
          <Icon style={{ width: 18, height: 18 }} />
        </div>
        <div className="min-w-0">
          <p className="font-heading text-sm font-bold text-slate-900">
            {title}
          </p>
          <p className="text-[11px] text-slate-500">
            {subtitle} · {data.customers} pelanggan
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-emerald-50 px-3 py-2">
          <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
            <Wallet style={{ width: 12, height: 12 }} /> Lunas
          </p>
          <p className="mt-0.5 font-heading text-sm font-bold leading-tight text-emerald-700">
            {formatCurrency(data.lunasNominal)}
          </p>
          <p className="text-[10px] text-emerald-600">
            {data.lunasCustomers} pelanggan
          </p>
        </div>
        <div className="rounded-lg bg-amber-50 px-3 py-2">
          <p className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
            <AlertTriangle style={{ width: 12, height: 12 }} /> Belum Lunas
          </p>
          <p className="mt-0.5 font-heading text-sm font-bold leading-tight text-amber-700">
            {formatCurrency(data.belumNominal)}
          </p>
          <p className="text-[10px] text-amber-600">
            {data.belumCustomers} pelanggan
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardCustomerTypeCards({ cv, nonCv, periodText }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TypeCard
        title="Pelanggan CV"
        subtitle={periodText}
        icon={Landmark}
        tone="from-indigo-500 to-violet-600"
        data={cv}
      />
      <TypeCard
        title="Pelanggan Non-CV"
        subtitle={periodText}
        icon={Wifi}
        tone="from-sky-500 to-blue-600"
        data={nonCv}
      />
    </div>
  );
}
