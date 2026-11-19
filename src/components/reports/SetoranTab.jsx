import React from "react";
import { Landmark, CheckCheck, Hourglass } from "lucide-react";
import { Badge } from "@/components/ui-bits";
import {
  formatCurrency as rp,
  formatDate,
  periodLabel,
  STATUS_LABELS,
  STATUS_COLORS,
  CV_STATUS_LABELS,
  CV_STATUS_COLORS,
} from "@/lib/billing";
import { itemsSetoran } from "@/lib/reportItems";
import ReportSection from "@/components/reports/ReportSection";
import ReportTable from "@/components/reports/ReportTable";
import ReportStatCard from "@/components/reports/ReportStatCard";

// Laporan Setoran WiFi/CV: dihitung dari data Setoran CV + statusnya sendiri,
// BUKAN dari jumlah pelanggan lunas. Status pelanggan hanya ditampilkan sebagai informasi terpisah.
export default function SetoranTab({ rep, rangeText }) {
  const src =
    "Data Setoran CV (ID setoran + nominal + status setoran), dikelompokkan per periode tagihan";
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
      label: "Setoran CV",
      align: "right",
      render: (r) => rp(r.nominal),
    },
    {
      key: "disetor",
      label: "Disetorkan",
      align: "right",
      render: (r) => <span className="text-emerald-600">{rp(r.disetor)}</span>,
    },
    {
      key: "belum",
      label: "Belum",
      align: "right",
      render: (r) => <span className="text-amber-600">{rp(r.belum)}</span>,
    },
    {
      key: "status",
      label: "Status Setoran CV",
      render: (r) => (
        <Badge className={CV_STATUS_COLORS[r.status]}>
          {CV_STATUS_LABELS[r.status]}
        </Badge>
      ),
    },
    {
      key: "deposit_date",
      label: "Tgl Setor",
      render: (r) => (r.deposit_date ? formatDate(r.deposit_date) : "-"),
    },
    {
      key: "payStatus",
      label: "Status Pelanggan (info terpisah)",
      render: (r) =>
        r.payStatus ? (
          <Badge className={STATUS_COLORS[r.payStatus]}>
            {STATUS_LABELS[r.payStatus]}
          </Badge>
        ) : (
          <span className="text-slate-400">-</span>
        ),
    },
  ];

  return (
    <ReportSection
      title="Laporan Setoran WiFi/CV"
      source={src}
      formula="Belum Disetorkan = Total Setoran − Sudah Disetorkan. Tidak bergantung pada status lunas pelanggan."
      link={{ to: "/setoran-cv", label: "Ubah status di menu Penyetoran CV" }}
    >
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ReportStatCard
          label="Total Setoran CV"
          amount={rep.totalSetoran}
          icon={Landmark}
          tone="indigo"
          sub={`${rep.setoranRows.length} setoran`}
          period={rangeText}
          source={src}
          formula="Jumlah nominal seluruh Setoran CV pada periode"
          items={itemsSetoran(rep.setoranRows)}
        />
        <ReportStatCard
          label="Sudah Disetorkan"
          amount={rep.totalDisetor}
          icon={CheckCheck}
          tone="emerald"
          period={rangeText}
          source={src}
          formula="Jumlah Setoran CV berstatus Disetorkan (ditambah bagian yang sudah disetor pada Setor Sebagian)"
          items={itemsSetoran(
            rep.setoranRows.filter((r) => r.disetor > 0),
            "disetor",
          )}
        />
        <ReportStatCard
          label="Belum Disetorkan"
          amount={rep.totalBelumSetor}
          icon={Hourglass}
          tone="amber"
          period={rangeText}
          source={src}
          formula={`${rp(rep.totalSetoran)} − ${rp(rep.totalDisetor)} = ${rp(rep.totalBelumSetor)}`}
          items={itemsSetoran(
            rep.setoranRows.filter((r) => r.belum > 0),
            "belum",
          )}
        />
      </div>
      <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Status pembayaran pelanggan (Lunas / Belum Lunas) dan status Setoran CV
        (Belum Disetorkan / Disetorkan) berdiri sendiri. Laporan ini hanya
        membaca, tidak mengubah status apa pun.
      </p>
      <ReportTable
        columns={columns}
        rows={rep.setoranRows}
        empty="Belum ada data Setoran CV pada periode tagihan ini."
        footer={
          <>
            <td className="px-3 py-2.5" colSpan={2}>
              Total
            </td>
            <td className="px-3 py-2.5 text-right">{rp(rep.totalSetoran)}</td>
            <td className="px-3 py-2.5 text-right text-emerald-700">
              {rp(rep.totalDisetor)}
            </td>
            <td className="px-3 py-2.5 text-right text-amber-700">
              {rp(rep.totalBelumSetor)}
            </td>
            <td className="px-3 py-2.5" colSpan={3}></td>
          </>
        }
      />
    </ReportSection>
  );
}
