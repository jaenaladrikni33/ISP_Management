import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui-bits";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency as rp, formatDate } from "@/lib/billing";
import ReportSection from "@/components/reports/ReportSection";
import ReportTable from "@/components/reports/ReportTable";

const JENIS = [
  "Pembayaran",
  "Rapel",
  "Gaji CV",
  "Pemasukan Lain",
  "Pengeluaran",
  "Setoran CV",
];
const JENIS_CLASS = {
  Pembayaran: "bg-emerald-100 text-emerald-700",
  Rapel: "bg-blue-100 text-blue-700",
  "Gaji CV": "bg-rose-100 text-rose-700",
  "Pemasukan Lain": "bg-sky-100 text-sky-700",
  Pengeluaran: "bg-red-100 text-red-700",
  "Setoran CV": "bg-indigo-100 text-indigo-700",
};

// Riwayat transaksi gabungan (hanya baca) dalam periode laporan.
export default function HistoryTab({ rep }) {
  const [jenis, setJenis] = useState("all");
  const rows = useMemo(
    () => rep.history.filter((h) => jenis === "all" || h.jenis === jenis),
    [rep, jenis],
  );
  const masuk = rows.reduce((s, r) => s + r.masuk, 0);
  const keluar = rows.reduce((s, r) => s + r.keluar, 0);

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
      key: "jenis",
      label: "Jenis",
      render: (r) => <Badge className={JENIS_CLASS[r.jenis]}>{r.jenis}</Badge>,
    },
    {
      key: "keterangan",
      label: "Keterangan",
      className: "max-w-[240px] truncate text-slate-700",
    },
    {
      key: "sumber",
      label: "Sumber / ID",
      render: (r) => (
        <span className="font-mono text-[11px] text-slate-400">{r.sumber}</span>
      ),
    },
    {
      key: "masuk",
      label: "Masuk",
      align: "right",
      render: (r) =>
        r.masuk ? (
          <span className="text-emerald-600">{rp(r.masuk)}</span>
        ) : (
          <span className="text-slate-300">-</span>
        ),
    },
    {
      key: "keluar",
      label: "Keluar",
      align: "right",
      render: (r) =>
        r.keluar ? (
          <span className="text-rose-600">{rp(r.keluar)}</span>
        ) : r.info != null ? (
          <span className="text-[11px] text-slate-400">info {rp(r.info)}</span>
        ) : (
          <span className="text-slate-300">-</span>
        ),
    },
  ];

  return (
    <ReportSection
      title="Riwayat Transaksi"
      source="Pembayaran, Rapel, Gaji CV, Pemasukan manual, Pengeluaran, dan catatan Setoran CV"
      formula="Daftar transaksi apa adanya. Setoran CV hanya informasi dan tidak dihitung ke Masuk/Keluar."
    >
      <div className="mb-3 w-full sm:w-56">
        <Select value={jenis} onValueChange={setJenis}>
          <SelectTrigger>
            <SelectValue placeholder="Semua jenis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Jenis</SelectItem>
            {JENIS.map((j) => (
              <SelectItem key={j} value={j}>
                {j}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ReportTable
        columns={columns}
        rows={rows}
        empty="Belum ada transaksi pada periode ini."
        footer={
          <>
            <td className="px-3 py-2.5" colSpan={4}>
              Total ({rows.length} transaksi)
            </td>
            <td className="px-3 py-2.5 text-right text-emerald-700">
              {rp(masuk)}
            </td>
            <td className="px-3 py-2.5 text-right text-rose-700">
              {rp(keluar)}
            </td>
          </>
        }
      />
    </ReportSection>
  );
}
