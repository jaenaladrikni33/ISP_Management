import React, { useState, useEffect, useMemo } from "react";
import { localApi } from "@/api/localClient";
import { getCached, setCached } from "@/lib/entityCache";
import { PageHeader, Loading } from "@/components/ui-bits";
import {
  formatCurrency,
  periodLabel,
  currentPeriod,
  computeCVDivision,
  cvPajakPerCustomer,
} from "@/lib/billing";
import { exportExcel } from "@/lib/excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, Calculator, PieChart } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { InfoIcon } from "@/components/InfoIcon";

// Omset & Pajak dihitung OTOMATIS dari pelanggan yang ditandai SUDAH SETOR di periode.
// Selisih = uang pelanggan - setoran CV (pendapatan non-CV / selisih mitra).
// Sisa Gaji di CV = Bersih Mitra - Pembayaran/Gaji CV.
export default function CVDivisionReport() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    cv_pusat_pct: 30,
    cv_mitra_pct: 70,
    cv_pph23_pct: 2,
  });
  const [cvDeposits, setCvDeposits] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [period, setPeriod] = useState(currentPeriod());

  const load = async () => {
    const cached = getCached("cvreport");
    if (cached) {
      if (cached.s?.[0])
        setSettings({
          cv_pusat_pct: cached.s[0].cv_pusat_pct ?? 30,
          cv_mitra_pct: cached.s[0].cv_mitra_pct ?? 70,
          cv_pph23_pct: cached.s[0].cv_pph23_pct ?? 2,
        });
      setCvDeposits((cached.cv || []).filter((x) => x.status !== "void"));
      setInvoices((cached.inv || []).filter((x) => x.status !== "void"));
      setPayouts(cached.po);
      setExpenses(cached.exp || []);
      setLoading(false);
    } else setLoading(true);
    try {
      const [s, cv, inv, po, exp] = await Promise.all([
        localApi.entities.AppSetting.list(),
        localApi.entities.CVDeposit.list("-period", 2000),
        localApi.entities.Invoice.list("-period", 3000),
        localApi.entities.CVPayout.filter({ status: "active" }, "-date", 1000),
        localApi.entities.Expense.filter({ status: "active" }, "-date", 1000),
      ]);
      if (s[0])
        setSettings({
          cv_pusat_pct: s[0].cv_pusat_pct ?? 30,
          cv_mitra_pct: s[0].cv_mitra_pct ?? 70,
          cv_pph23_pct: s[0].cv_pph23_pct ?? 2,
        });
      const cvA = cv.filter((x) => x.status !== "void");
      const invA = inv.filter((x) => x.status !== "void");
      setCvDeposits(cvA);
      setInvoices(invA);
      setPayouts(po);
      setExpenses(exp);
      setCached("cvreport", { s, cv: cvA, inv: invA, po, exp });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const invById = useMemo(() => {
    const m = {};
    invoices.forEach((i) => (m[i.id] = i));
    return m;
  }, [invoices]);

  // Hanya pelanggan yang sudah ditandai setor (sudah_setor) yang masuk hitungan.
  const deposited = useMemo(
    () =>
      cvDeposits.filter(
        (d) => d.period === period && d.status === "sudah_setor",
      ),
    [cvDeposits, period],
  );

  // Omset otomatis = total nominal setoran CV dari pelanggan yang sudah setor.
  const omsetOtomatis = useMemo(
    () => deposited.reduce((s, d) => s + Number(d.cv_deposit_amount || 0), 0),
    [deposited],
  );
  // Pajak otomatis per pelanggan (PPN 11% + BHP USO 4% dari harga sebelum pajak).
  const pajakOtomatis = useMemo(
    () =>
      deposited.reduce(
        (s, d) => s + cvPajakPerCustomer(d.cv_deposit_amount).pajak,
        0,
      ),
    [deposited],
  );

  // Detail per pelanggan (yang sudah setor): bayar, setoran CV, selisih, pajak.
  const detailRows = useMemo(
    () =>
      deposited.map((d) => {
        const inv = d.invoice_id
          ? invById[d.invoice_id]
          : invoices.find(
              (i) => i.customer_id === d.customer_id && i.period === d.period,
            );
        const bayar = Number(inv?.total_paid || 0);
        const setoran = Number(d.cv_deposit_amount || 0);
        const selisih = Math.max(0, bayar - setoran);
        const pajak = cvPajakPerCustomer(setoran).pajak;
        return { name: d.customer_name, bayar, setoran, selisih, pajak };
      }),
    [deposited, invById, invoices],
  );

  // Pendapatan selisih mitra (non-CV) = total selisih pelanggan yang sudah setor.
  const pendapatanSelisih = useMemo(
    () => detailRows.reduce((s, r) => s + r.selisih, 0),
    [detailRows],
  );

  const payoutPeriode = useMemo(
    () =>
      payouts
        .filter((p) => (p.period || "").startsWith(period))
        .reduce((s, p) => s + Number(p.amount || 0), 0),
    [payouts, period],
  );
  const expensePeriode = useMemo(
    () =>
      expenses
        .filter((e) => (e.date || "").startsWith(period))
        .reduce((s, e) => s + Number(e.amount || 0), 0),
    [expenses, period],
  );

  const div = computeCVDivision(
    omsetOtomatis,
    pajakOtomatis,
    settings.cv_pusat_pct,
    settings.cv_mitra_pct,
    settings.cv_pph23_pct,
  );
  const sisaGajiCV = div.bersihMitra - payoutPeriode; // Sisa gaji di CV
  const pendapatanMitra = div.bersihMitra + pendapatanSelisih; // Pendapatan bersih mitra per bulan
  const labaBersihBisnis = pendapatanMitra - expensePeriode; // Laba bersih bisnis setelah pengeluaran

  const valid = settings.cv_pusat_pct + settings.cv_mitra_pct === 100;

  // ⓘ (klik untuk sumber, rumus, dan rincian) — hanya informasi
  const inf = (title, amount, formula, extra = {}) => (
    <InfoIcon
      variant="plain"
      title={title}
      value={formatCurrency(amount)}
      period={periodLabel(period)}
      source="Setoran CV berstatus Disetorkan pada periode ini"
      formula={formula}
      {...extra}
    />
  );

  const handleExport = () => {
    const rows = [
      {
        Keterangan: "Omset CV (dari pelanggan sudah setor)",
        Nominal: div.omset,
      },
      { Keterangan: "Pajak (PPN 11% + BHP USO 4%)", Nominal: div.pajak },
      { Keterangan: "Keuntungan (Omset - Pajak)", Nominal: div.keuntungan },
      { Keterangan: `Pusat (${settings.cv_pusat_pct}%)`, Nominal: div.pusat },
      { Keterangan: `Mitra (${settings.cv_mitra_pct}%)`, Nominal: div.mitra },
      { Keterangan: `PPh 23 (${settings.cv_pph23_pct}%)`, Nominal: div.pph23 },
      { Keterangan: "Bersih Mitra", Nominal: div.bersihMitra },
      {
        Keterangan: "Pendapatan Selisih Mitra (non-CV)",
        Nominal: pendapatanSelisih,
      },
      { Keterangan: "Pembayaran/Gaji CV (periode)", Nominal: payoutPeriode },
      {
        Keterangan: "Sisa Gaji di CV (Bersih Mitra - Gaji CV)",
        Nominal: sisaGajiCV,
      },
      {
        Keterangan: "Pengeluaran Operasional (periode)",
        Nominal: expensePeriode,
      },
      {
        Keterangan: "Pendapatan Bersih Mitra per Bulan",
        Nominal: pendapatanMitra,
      },
      { Keterangan: "Laba Bersih Bisnis per Bulan", Nominal: labaBersihBisnis },
    ];
    exportExcel(`laporan-pembagian-cv-${period}`, rows, "Laporan Pembagian CV");
    toast({ title: "Laporan di-export" });
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Laporan Pembagian CV"
        subtitle="Level 2: Pembagian Hasil CV (Pusat / Mitra / PPh 23). Omset & pajak otomatis dari pelanggan yang sudah ditandai setor."
      >
        <Button variant="outline" size="sm" onClick={handleExport}>
          <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Export
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Label>Periode</Label>
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Pelanggan sudah setor:{" "}
          <b className="text-indigo-600">{deposited.length} orang</b> · Omset
          otomatis:{" "}
          <b className="text-indigo-600">{formatCurrency(omsetOtomatis)}</b> ·
          Pajak otomatis:{" "}
          <b className="text-rose-600">{formatCurrency(pajakOtomatis)}</b>
        </div>
        {!valid && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
            Pusat + Mitra harus = 100%. Atur di Pengaturan CV.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="font-heading font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-slate-400" /> Hasil Pembagian
          </h3>
          <div className="space-y-1">
            <Row
              label="Omset (otomatis dari pelanggan setor)"
              value={formatCurrency(div.omset)}
              info={inf(
                "Omset CV",
                div.omset,
                "Jumlah nominal Setoran CV pelanggan yang sudah disetorkan",
                {
                  items: detailRows.map((r) => ({
                    label: r.name,
                    sub: "Setoran CV",
                    value: formatCurrency(r.setoran),
                  })),
                },
              )}
            />
            <Row
              label="Pajak (otomatis PPN 11% + BHP 4%)"
              value={formatCurrency(div.pajak)}
              tone="text-rose-600"
              info={inf(
                "Pajak CV",
                div.pajak,
                "Per pelanggan: PPN 11% + BHP USO 4% dari harga sebelum pajak (nominal ÷ 1,15)",
                {
                  items: detailRows.map((r) => ({
                    label: r.name,
                    sub: `Dasar ${formatCurrency(r.setoran)}`,
                    value: formatCurrency(r.pajak),
                  })),
                  note: "Dihitung otomatis dari Setoran CV, bukan transaksi pajak terpisah.",
                },
              )}
            />
            <Row
              label="Keuntungan (Omset - Pajak)"
              value={formatCurrency(div.keuntungan)}
              bold
              border
              info={inf(
                "Keuntungan",
                div.keuntungan,
                `Omset ${formatCurrency(div.omset)} − Pajak ${formatCurrency(div.pajak)} = ${formatCurrency(div.keuntungan)}`,
              )}
            />
            <Row
              label={`Pusat (${settings.cv_pusat_pct}%)`}
              value={formatCurrency(div.pusat)}
              tone="text-sky-600"
              info={inf(
                "Bagian Pusat",
                div.pusat,
                `Keuntungan ${formatCurrency(div.keuntungan)} × ${settings.cv_pusat_pct}% = ${formatCurrency(div.pusat)}`,
              )}
            />
            <Row
              label={`Mitra (${settings.cv_mitra_pct}%)`}
              value={formatCurrency(div.mitra)}
              tone="text-indigo-600"
              info={inf(
                "Bagian Mitra",
                div.mitra,
                `Keuntungan ${formatCurrency(div.keuntungan)} × ${settings.cv_mitra_pct}% = ${formatCurrency(div.mitra)}`,
              )}
            />
            <Row
              label={`PPh 23 (${settings.cv_pph23_pct}% × Mitra)`}
              value={formatCurrency(div.pph23)}
              tone="text-amber-600"
              info={inf(
                "PPh 23",
                div.pph23,
                `Bagian Mitra ${formatCurrency(div.mitra)} × ${settings.cv_pph23_pct}% = ${formatCurrency(div.pph23)}`,
              )}
            />
            <Row
              label="Bersih Mitra (Mitra - PPh 23)"
              value={formatCurrency(div.bersihMitra)}
              bold
              tone="text-emerald-600"
              border
              info={inf(
                "Bersih Mitra",
                div.bersihMitra,
                `Mitra ${formatCurrency(div.mitra)} − PPh 23 ${formatCurrency(div.pph23)} = ${formatCurrency(div.bersihMitra)}`,
              )}
            />
            <Row
              label="Pendapatan Selisih Mitra (non-CV)"
              value={formatCurrency(pendapatanSelisih)}
              tone="text-emerald-600"
              info={inf(
                "Selisih Mitra (Non-CV)",
                pendapatanSelisih,
                `Per pelanggan: pembayaran − Setoran CV (jika positif). Total pembayaran ${formatCurrency(detailRows.reduce((s, r) => s + r.bayar, 0))}, total Setoran CV ${formatCurrency(omsetOtomatis)}.`,
                {
                  source:
                    "Pembayaran pelanggan pada tagihan + Setoran CV yang sudah disetorkan",
                  items: detailRows
                    .filter((r) => r.selisih > 0)
                    .map((r) => ({
                      label: r.name,
                      sub: `Bayar ${formatCurrency(r.bayar)} − Setoran ${formatCurrency(r.setoran)}`,
                      value: formatCurrency(r.selisih),
                    })),
                  note: "Non-CV TIDAK masuk ke nominal CV di laporan ini.",
                },
              )}
            />
            <Row
              label="Pembayaran/Gaji CV (periode ini)"
              value={formatCurrency(payoutPeriode)}
              tone="text-rose-600"
              info={inf(
                "Pembayaran/Gaji CV",
                payoutPeriode,
                "Jumlah transaksi Gaji/Pembayaran CV untuk periode ini",
                { source: "Menu Pembayaran/Gaji CV" },
              )}
            />
            <Row
              label="Sisa Gaji di CV (Bersih Mitra - Gaji CV)"
              value={formatCurrency(sisaGajiCV)}
              bold
              tone="text-indigo-600"
              border
              info={inf(
                "Sisa Gaji di CV",
                sisaGajiCV,
                `Bersih Mitra ${formatCurrency(div.bersihMitra)} − Gaji CV ${formatCurrency(payoutPeriode)} = ${formatCurrency(sisaGajiCV)}`,
              )}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="font-heading font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <PieChart className="h-4 w-4 text-slate-400" /> Pendapatan Mitra per
            Bulan
          </h3>
          <div className="space-y-1">
            <Row
              label="Bersih Mitra (dari pembagian CV)"
              value={formatCurrency(div.bersihMitra)}
              tone="text-emerald-600"
            />
            <Row
              label="Pendapatan Selisih Mitra (non-CV)"
              value={formatCurrency(pendapatanSelisih)}
              tone="text-emerald-600"
            />
            <Row
              label="Pendapatan Bersih Mitra per Bulan"
              value={formatCurrency(pendapatanMitra)}
              bold
              tone="text-emerald-600"
              border
            />
            <Row
              label="Pengeluaran Operasional (periode)"
              value={formatCurrency(expensePeriode)}
              tone="text-rose-600"
            />
            <Row
              label="Laba Bersih Bisnis per Bulan"
              value={formatCurrency(labaBersihBisnis)}
              bold
              tone={
                labaBersihBisnis >= 0 ? "text-emerald-600" : "text-rose-600"
              }
              border
            />
          </div>
          <p className="mt-3 rounded-md bg-emerald-50 p-2 text-[11px] text-emerald-700">
            Estimasi yang Anda dapat bulan {periodLabel(period)}:{" "}
            <b>{formatCurrency(pendapatanMitra)}</b> (sebelum pengeluaran) ·{" "}
            <b>{formatCurrency(labaBersihBisnis)}</b> (setelah pengeluaran
            operasional).
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="font-heading font-semibold text-slate-900 mb-3">
          Detail per Pelanggan (Sudah Setor CV)
        </h3>
        {detailRows.length === 0 ? (
          <p className="text-sm text-slate-500">
            Belum ada pelanggan yang ditandai setor di periode{" "}
            {periodLabel(period)}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Nama</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Bayar Pelanggan
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Setoran CV
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Selisih (non-CV)
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Pajak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detailRows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {r.name}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-600">
                      {formatCurrency(r.bayar)}
                    </td>
                    <td className="px-3 py-2 text-right text-indigo-600">
                      {formatCurrency(r.setoran)}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-600">
                      {formatCurrency(r.selisih)}
                    </td>
                    <td className="px-3 py-2 text-right text-rose-600">
                      {formatCurrency(r.pajak)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right text-emerald-700">
                    {formatCurrency(
                      detailRows.reduce((s, r) => s + r.bayar, 0),
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-indigo-700">
                    {formatCurrency(omsetOtomatis)}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-700">
                    {formatCurrency(pendapatanSelisih)}
                  </td>
                  <td className="px-3 py-2 text-right text-rose-700">
                    {formatCurrency(pajakOtomatis)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, tone = "text-slate-900", bold, border, info }) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${border ? "border-t border-slate-200" : ""}`}
    >
      <span className="flex items-center gap-1 text-sm text-slate-600">
        {label}
        {info}
      </span>
      <span
        className={`${bold ? "font-heading text-base font-bold" : "text-sm font-medium"} ${tone}`}
      >
        {value}
      </span>
    </div>
  );
}
