import React from "react";
import { Landmark, TrendingDown, TrendingUp, PieChart } from "lucide-react";
import { formatCurrency as rp, periodLabel } from "@/lib/billing";
import { itemsTax, itemsSetoran } from "@/lib/reportItems";
import ReportSection from "@/components/reports/ReportSection";
import ReportTable from "@/components/reports/ReportTable";
import ReportStatCard from "@/components/reports/ReportStatCard";

// Laporan Pajak: dibaca dari Setoran CV yang sudah disetorkan. Tidak ada transaksi pajak buatan.
export default function TaxTab({ rep, rangeText }) {
  const d = rep.division;
  const base =
    "Setoran CV berstatus Disetorkan pada periode tagihan yang dipilih";
  const columns = [
    {
      key: "customer_name",
      label: "Pelanggan",
      render: (r) => (
        <span className="font-medium text-slate-900">{r.customer_name}</span>
      ),
    },
    { key: "period", label: "Periode", render: (r) => periodLabel(r.period) },
    {
      key: "nominal",
      label: "Setoran CV (dasar)",
      align: "right",
      render: (r) => rp(r.nominal),
    },
    {
      key: "harga",
      label: "Sebelum Pajak",
      align: "right",
      render: (r) => rp(r.harga),
    },
    { key: "ppn", label: "PPN 11%", align: "right", render: (r) => rp(r.ppn) },
    {
      key: "bhp",
      label: "BHP USO 4%",
      align: "right",
      render: (r) => rp(r.bhp),
    },
    {
      key: "pajak",
      label: "Pajak",
      align: "right",
      render: (r) => <b className="text-rose-600">{rp(r.pajak)}</b>,
    },
  ];

  return (
    <ReportSection
      title="Laporan Pajak"
      source={`Data Setoran CV — ${base}`}
      formula="Harga sudah termasuk pajak 15%: sebelum pajak = nominal ÷ 1,15; PPN = 11% × sebelum pajak; BHP USO = 4% × sebelum pajak"
      link={{ to: "/laporan-cv", label: "Laporan Pembagian CV" }}
    >
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ReportStatCard
          label="Dasar Pajak (Omset CV)"
          amount={rep.omsetCV}
          icon={Landmark}
          tone="indigo"
          period={rangeText}
          source={base}
          formula="Jumlah nominal Setoran CV yang sudah disetorkan"
          items={itemsSetoran(rep.taxRows)}
        />
        <ReportStatCard
          label="Pajak CV (PPN + BHP)"
          amount={rep.totalPajak}
          icon={TrendingDown}
          tone="rose"
          period={rangeText}
          source={base}
          formula="Jumlah pajak per pelanggan: PPN 11% + BHP USO 4% dari harga sebelum pajak"
          items={itemsTax(rep.taxRows)}
          note="Pajak dihitung otomatis dari Setoran CV, bukan transaksi pajak terpisah."
        />
        <ReportStatCard
          label="Keuntungan (Omset − Pajak)"
          amount={d.keuntungan}
          icon={TrendingUp}
          tone="emerald"
          period={rangeText}
          source={base}
          formula={`${rp(rep.omsetCV)} − ${rp(rep.totalPajak)} = ${rp(d.keuntungan)}`}
        />
        <ReportStatCard
          label="PPh 23 (bagian Mitra)"
          amount={d.pph23}
          icon={PieChart}
          tone="amber"
          period={rangeText}
          source={`${base}; persentase dari Pengaturan CV`}
          formula={`PPh 23 = persentase × bagian Mitra. Bagian Mitra ${rp(d.mitra)} → PPh 23 ${rp(d.pph23)}`}
        />
      </div>
      <ReportTable
        columns={columns}
        rows={rep.taxRows}
        empty="Belum ada Setoran CV berstatus Disetorkan pada periode tagihan ini."
        footer={
          <>
            <td className="px-3 py-2.5" colSpan={2}>
              Total
            </td>
            <td className="px-3 py-2.5 text-right">{rp(rep.omsetCV)}</td>
            <td className="px-3 py-2.5 text-right">
              {rp(rep.taxRows.reduce((s, r) => s + r.harga, 0))}
            </td>
            <td className="px-3 py-2.5 text-right">
              {rp(rep.taxRows.reduce((s, r) => s + r.ppn, 0))}
            </td>
            <td className="px-3 py-2.5 text-right">
              {rp(rep.taxRows.reduce((s, r) => s + r.bhp, 0))}
            </td>
            <td className="px-3 py-2.5 text-right text-rose-700">
              {rp(rep.totalPajak)}
            </td>
          </>
        }
      />
    </ReportSection>
  );
}
