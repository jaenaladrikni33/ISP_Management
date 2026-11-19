import React from "react";
import { TrendingDown } from "lucide-react";
import { InfoLine } from "@/components/InfoIcon";
import { formatCurrency as rp, formatDate } from "@/lib/billing";
import { itemsSource } from "@/lib/reportItems";
import ReportSection from "@/components/reports/ReportSection";
import ReportTable from "@/components/reports/ReportTable";
import ReportStatCard from "@/components/reports/ReportStatCard";

// Laporan Pengeluaran: dibaca dari transaksi pengeluaran yang sudah ada.
export default function ExpenseTab({ rep, rangeText }) {
  const columns = [
    {
      key: "date",
      label: "Tanggal",
      render: (r) => (
        <span className="whitespace-nowrap text-slate-600">
          {formatDate(r.date)}
        </span>
      ),
    },
    {
      key: "kategori",
      label: "Kategori",
      render: (r) => (
        <span className="font-medium text-slate-900">{r.kategori}</span>
      ),
    },
    {
      key: "keterangan",
      label: "Keterangan",
      className: "max-w-[240px] truncate text-slate-600",
    },
    {
      key: "sumber",
      label: "Sumber",
      render: (r) => <span className="text-xs text-slate-500">{r.sumber}</span>,
    },
    {
      key: "nominal",
      label: "Nominal",
      align: "right",
      render: (r) => <b className="text-rose-600">{rp(r.nominal)}</b>,
    },
  ];

  return (
    <ReportSection
      title="Laporan Pengeluaran"
      source="Transaksi pengeluaran aktif (Input Keuangan → Pengeluaran)"
      formula="Jumlah seluruh pengeluaran aktif pada periode"
      link={{ to: "/keuangan", label: "Kelola di menu Keuangan" }}
    >
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ReportStatCard
          label="Total Pengeluaran"
          amount={rep.totalExpense}
          icon={TrendingDown}
          tone="rose"
          sub={`${rep.expenseRows.length} transaksi`}
          period={rangeText}
          source="Input Keuangan — Pengeluaran"
          formula="Jumlah pengeluaran aktif pada periode"
          items={itemsSource(rep.expenseRows)}
        >
          {rep.expByCat.map(([k, v]) => (
            <InfoLine key={k} label={k} value={rp(v)} tone="text-rose-600" />
          ))}
        </ReportStatCard>
        {rep.expByCat.slice(0, 3).map(([k, v]) => (
          <div
            key={k}
            className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm"
          >
            <p className="truncate text-xs text-slate-500">{k}</p>
            <p className="font-bold text-rose-600">{rp(v)}</p>
          </div>
        ))}
      </div>
      <ReportTable
        columns={columns}
        rows={rep.expenseRows}
        empty="Belum ada pengeluaran pada periode ini."
        footer={
          <>
            <td className="px-3 py-2.5" colSpan={4}>
              Total Pengeluaran
            </td>
            <td className="px-3 py-2.5 text-right text-rose-700">
              {rp(rep.totalExpense)}
            </td>
          </>
        }
      />
    </ReportSection>
  );
}
