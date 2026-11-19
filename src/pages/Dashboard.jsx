import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { localApi } from "@/api/localClient";
import { getCached, setCached } from "@/lib/entityCache";
import { PageHeader, StatCard, Loading } from "@/components/ui-bits";
import {
  formatCurrency,
  currentPeriod,
  periodLabel,
  invoiceDanaCV,
  computeCVDivision,
  cvPajakPerCustomer,
  invoiceRemaining,
} from "@/lib/billing";
import { buildReport, toYMD } from "@/lib/reportCalc";
import { fmtRange } from "@/lib/reportItems";
import {
  Users,
  UserCheck,
  UserX,
  Wifi,
  FileText,
  Wallet,
  AlertTriangle,
  Layers,
  Send,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import DashboardCVCards from "@/components/dashboard/DashboardCVCards";
import DashboardFinanceCards from "@/components/dashboard/DashboardFinanceCards";
import DashboardProfitPercent from "@/components/dashboard/DashboardProfitPercent";
import DashboardCustomerLunasPercent from "@/components/dashboard/DashboardCustomerLunasPercent";
import DashboardPercentBreakdown from "@/components/dashboard/DashboardPercentBreakdown";
import DashboardCustomerTypeCards from "@/components/dashboard/DashboardCustomerTypeCards";

const RANGES = [
  { key: "today", label: "Hari Ini" },
  { key: "week", label: "Minggu Ini" },
  { key: "month", label: "Bulan Ini" },
  { key: "year", label: "Tahun Ini" },
];

function rangeBounds(key) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  if (key === "today") return [start, end];
  if (key === "week") {
    const s = new Date(start);
    s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    return [s, end];
  }
  if (key === "month")
    return [new Date(now.getFullYear(), now.getMonth(), 1), end];
  if (key === "year") return [new Date(now.getFullYear(), 0, 1), end];
  return [start, end];
}

export default function Dashboard() {
  const [range, setRange] = useState("month");
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [cvDeposits, setCvDeposits] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [settings, setSettings] = useState({
    cv_pusat_pct: 30,
    cv_mitra_pct: 70,
    cv_pph23_pct: 2,
  });

  useEffect(() => {
    let alive = true;
    const apply = (d) => {
      if (!alive) return;
      setCustomers(d.c);
      setInvoices((d.inv || []).filter((i) => i.status !== "void"));
      setPayments(d.pay);
      setCvDeposits((d.cv || []).filter((x) => x.status !== "void"));
      setExpenses(d.exp);
      setIncomes(d.inc);
      setPayouts(d.po);
      setBroadcasts(d.br);
      if (d.st?.[0])
        setSettings({
          cv_pusat_pct: d.st[0].cv_pusat_pct ?? 30,
          cv_mitra_pct: d.st[0].cv_mitra_pct ?? 70,
          cv_pph23_pct: d.st[0].cv_pph23_pct ?? 2,
        });
    };
    const cached = getCached("dashboard");
    if (cached) {
      apply(cached);
      setLoading(false);
    } else setLoading(true);
    (async () => {
      try {
        const [c, inv, pay, cv, exp, inc, po, br, st] = await Promise.all([
          localApi.entities.Customer.list(),
          localApi.entities.Invoice.list("-created_date", 1000),
          localApi.entities.Payment.filter(
            { status: "active" },
            "-created_date",
            1000,
          ),
          localApi.entities.CVDeposit.list("-created_date", 1000),
          localApi.entities.Expense.filter(
            { status: "active" },
            "-created_date",
            1000,
          ),
          localApi.entities.Income.filter(
            { status: "active" },
            "-created_date",
            1000,
          ),
          localApi.entities.CVPayout.filter({ status: "active" }, "-date", 1000),
          localApi.entities.BroadcastLog.list("-date", 100),
          localApi.entities.AppSetting.list(),
        ]);
        if (!alive) return;
        setCached("dashboard", { c, inv, pay, cv, exp, inc, po, br, st });
        apply({ c, inv, pay, cv, exp, inc, po, br, st });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const [start, end] = useMemo(() => rangeBounds(range), [range]);
  const inRange = (d) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    return t >= start.getTime() && t <= end.getTime();
  };

  const invById = useMemo(() => {
    const m = {};
    invoices.forEach((i) => (m[i.id] = i));
    return m;
  }, [invoices]);

  // Periode yang diliput sesuai rentang dashboard (tagihan & setoran CV bersifat bulanan).
  const periodsInScope = useMemo(() => {
    if (range === "year") {
      const y = String(start.getFullYear());
      return [
        ...new Set(
          invoices.map((i) => i.period).filter((p) => p && p.startsWith(y)),
        ),
      ];
    }
    return [currentPeriod()];
  }, [range, start, invoices]);
  const periodSubText =
    range === "year"
      ? `Tahun ${start.getFullYear()}`
      : periodLabel(currentPeriod());

  const stats = useMemo(() => {
    const total = customers.length;
    const aktif = customers.filter((c) => c.status === "aktif").length;
    const tidakAktif = customers.filter(
      (c) => c.status === "tidak_aktif",
    ).length;
    const isolir = customers.filter((c) => c.status === "isolir").length;

    const monthInvoices = invoices.filter((i) =>
      periodsInScope.includes(i.period),
    );
    const totalTagihanBulan = monthInvoices.reduce(
      (s, i) => s + Number(i.amount || 0),
      0,
    );

    const payInRange = payments.filter((p) => inRange(p.date));
    const totalPembayaran = payInRange.reduce(
      (s, p) => s + Number(p.amount || 0),
      0,
    );

    const curInvoices = monthInvoices;
    const sudahBayarInv = curInvoices.filter(
      (i) => i.status === "lunas" || i.status === "dibayar_rapel",
    );
    const belumBayarInv = curInvoices.filter(
      (i) => i.status !== "lunas" && i.status !== "dibayar_rapel",
    );
    const pelangganLunas = new Set(sudahBayarInv.map((i) => i.customer_id))
      .size;
    const sudahBayarCount = sudahBayarInv.length;
    const sudahBayarNominal = sudahBayarInv.reduce(
      (s, i) => s + Number(i.amount || 0),
      0,
    );
    const belumBayarCount = belumBayarInv.length;
    const belumBayarNominal = belumBayarInv.reduce(
      (s, i) => s + invoiceRemaining(i),
      0,
    );
    const piutang = monthInvoices
      .filter((i) => i.status !== "lunas" && i.status !== "dibayar_rapel")
      .reduce(
        (s, i) =>
          s + Number(i.remaining || i.amount - (i.total_paid || 0) || 0),
        0,
      );

    // Pelanggan CV vs Non-CV: jumlah pelanggan + nominal tagihan lunas / belum lunas periode ini
    const groupByCv = (list) => {
      const ids = new Set(list.map((c) => c.id));
      const invs = monthInvoices.filter((i) => ids.has(i.customer_id));
      const paid = invs.filter(
        (i) => i.status === "lunas" || i.status === "dibayar_rapel",
      );
      const unpaid = invs.filter(
        (i) => i.status !== "lunas" && i.status !== "dibayar_rapel",
      );
      return {
        customers: list.length,
        lunasNominal: paid.reduce((s, i) => s + Number(i.amount || 0), 0),
        lunasCustomers: new Set(paid.map((i) => i.customer_id)).size,
        belumNominal: unpaid.reduce((s, i) => s + invoiceRemaining(i), 0),
        belumCustomers: new Set(unpaid.map((i) => i.customer_id)).size,
      };
    };
    const customerGroups = {
      cv: groupByCv(customers.filter((c) => c.uses_cv_deposit)),
      nonCv: groupByCv(customers.filter((c) => !c.uses_cv_deposit)),
    };

    // CV — konsisten dengan Laporan Pembagian CV: periode berjalan, dari pelanggan ditandai SUDAH SETOR.
    const cvCur = cvDeposits.filter((c) => periodsInScope.includes(c.period));
    const depositedCV = cvCur.filter((c) => c.status === "sudah_setor");
    const omsetCV = depositedCV.reduce(
      (s, c) => s + Number(c.cv_deposit_amount || 0),
      0,
    );
    const pajakCV = depositedCV.reduce(
      (s, c) => s + cvPajakPerCustomer(c.cv_deposit_amount).pajak,
      0,
    );
    const danaCVTotal = cvCur.reduce((s, c) => {
      const inv = c.invoice_id
        ? invById[c.invoice_id]
        : invoices.find(
            (i) => i.customer_id === c.customer_id && i.period === c.period,
          );
      // Hanya dari tagihan yang sudah LUNAS — cicilan belum dihitung sebagai dana CV
      if (!inv || (inv.status !== "lunas" && inv.status !== "dibayar_rapel"))
        return s;
      return s + invoiceDanaCV(inv?.total_paid || 0, c.cv_deposit_amount);
    }, 0);
    const totalSetoranCV = cvCur.reduce(
      (s, c) => s + Number(c.cv_deposit_amount || 0),
      0,
    );
    const totalSetorCV = cvCur.reduce(
      (s, c) => s + Number(c.deposit_amount || 0),
      0,
    );

    const division = computeCVDivision(
      omsetCV,
      pajakCV,
      settings.cv_pusat_pct,
      settings.cv_mitra_pct,
      settings.cv_pph23_pct,
    );
    const cvRowsDeposited = depositedCV.map((c) => ({
      customer_name: c.customer_name,
      period: c.period,
      deposit_date: c.deposit_date,
      nominal: Number(c.cv_deposit_amount || 0),
      pajak: cvPajakPerCustomer(c.cv_deposit_amount).pajak,
    }));
    const cvRowsAll = cvCur.map((c) => ({
      customer_name: c.customer_name,
      period: c.period,
      deposit_date: c.deposit_date,
      nominal: Number(c.cv_deposit_amount || 0),
      disetor: Number(c.deposit_amount || 0),
    }));

    // Pemasukan terpadu (Non-CV + Gaji CV + Pemasukan Lain) — angka sama dengan menu Keuangan & Laporan
    const rep = buildReport(
      { payments, invoices, customers, cvDeposits, payouts, incomes, expenses },
      toYMD(start),
      toYMD(end),
    );
    const totalPayoutCV = rep.totalPayout;
    const totalPendapatanNonCv = rep.totalNonCV;
    const totalNonCVBayar = rep.totalBayar;
    const totalNonCVSetoran = rep.totalCV;
    const totalPendapatanLain = rep.totalManual;
    const totalPengeluaran = rep.totalExpense;
    const totalPemasukan = rep.totalPemasukan;
    const saldoAkhir = rep.saldo;

    const belumBayar = monthInvoices.filter(
      (i) => i.status === "belum_bayar",
    ).length;
    const cicilan = monthInvoices.filter((i) => i.status === "cicilan").length;
    const menunggak = monthInvoices.filter(
      (i) => i.status === "menunggak" || i.status === "jatuh_tempo",
    ).length;
    const rapel = monthInvoices.filter(
      (i) => i.status === "dibayar_rapel",
    ).length;

    const broadcastInRange = broadcasts.filter((b) => inRange(b.date));
    const broadcastCount = broadcastInRange.length;
    const broadcastRecipients = broadcastInRange.reduce(
      (s, b) => s + Number(b.valid_count || 0),
      0,
    );
    const lastBroadcast = broadcasts[0];

    return {
      total,
      aktif,
      tidakAktif,
      isolir,
      pelangganLunas,
      customerGroups,
      totalTagihanBulan,
      totalPembayaran,
      piutang,
      sudahBayarCount,
      sudahBayarNominal,
      belumBayarCount,
      belumBayarNominal,
      omsetCV,
      pajakCV,
      danaCVTotal,
      totalSetoranCV,
      totalSetorCV,
      division,
      totalPayoutCV,
      totalPendapatanNonCv,
      totalNonCVBayar,
      totalNonCVSetoran,
      totalPendapatanLain,
      totalPengeluaran,
      totalPemasukan,
      saldoAkhir,
      cvHeld: rep.cvHeld,
      saldoKas: rep.saldoKas,
      rep,
      cvRowsDeposited,
      cvRowsAll,
      belumBayar,
      cicilan,
      menunggak,
      rapel,
      broadcastCount,
      broadcastRecipients,
      lastBroadcast,
    };
  }, [
    customers,
    invoices,
    payments,
    cvDeposits,
    expenses,
    incomes,
    payouts,
    broadcasts,
    settings,
    range,
    invById,
    periodsInScope,
  ]);

  const chartData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = periodLabel(key).split(" ")[0].slice(0, 3);
      const masuk =
        payments
          .filter((p) => p.date && p.date.startsWith(key))
          .reduce((s, p) => s + Number(p.amount || 0), 0) +
        cvDeposits
          .filter((c) => c.deposit_date && c.deposit_date.startsWith(key))
          .reduce((s, c) => s + Number(c.deposit_amount || 0), 0) +
        incomes
          .filter((i) => i.date && i.date.startsWith(key))
          .reduce((s, i) => s + Number(i.amount || 0), 0);
      const keluar =
        expenses
          .filter((e) => e.date && e.date.startsWith(key))
          .reduce((s, e) => s + Number(e.amount || 0), 0) +
        payouts
          .filter((p) => p.date && p.date.startsWith(key))
          .reduce((s, p) => s + Number(p.amount || 0), 0);
      months.push({ name: label, Pemasukan: masuk, Pengeluaran: keluar });
    }
    return months;
  }, [payments, cvDeposits, incomes, expenses, payouts]);

  if (loading) return <Loading />;

  const cardLink = "block transition-transform hover:-translate-y-0.5";
  const rangeText = fmtRange(toYMD(start), toYMD(end));

  // Gaji owner tercatat sebagai pengeluaran, padahal itu keuntungan owner —
  // keluarkan dari Pengeluaran dan masukkan ke Untung Bersih agar konsisten.
  const gajiExpense = (stats.rep?.expByCat || [])
    .filter(([cat]) => /gaji/i.test(cat || ""))
    .reduce((s, [, amt]) => s + Number(amt || 0), 0);
  const pengeluaranOperasional = Math.max(
    stats.totalPengeluaran - gajiExpense,
    0,
  );
  const untungBersihSaya = stats.saldoAkhir + gajiExpense;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Ringkasan kinerja ISP_Management berdasarkan transaksi nyata"
      >
        <div className="flex flex-wrap gap-1.5 rounded-lg bg-white p-1 shadow-sm border border-slate-100">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${range === r.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Pelanggan
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link to="/pelanggan" className={cardLink}>
          <StatCard
            label="Total Pelanggan"
            value={stats.total}
            icon={Users}
            tone="indigo"
          />
        </Link>
        <Link to="/pelanggan" className={cardLink}>
          <StatCard
            label="Pelanggan Aktif"
            value={stats.aktif}
            icon={UserCheck}
            tone="emerald"
          />
        </Link>
        <Link to="/pelanggan" className={cardLink}>
          <StatCard
            label="Tidak Aktif"
            value={stats.tidakAktif}
            icon={UserX}
            tone="slate"
          />
        </Link>
        <Link to="/pelanggan" className={cardLink}>
          <StatCard
            label="Isolir"
            value={stats.isolir}
            icon={Wifi}
            tone="red"
          />
        </Link>
      </div>
      <div className="mt-3">
        <DashboardCustomerTypeCards
          cv={stats.customerGroups.cv}
          nonCv={stats.customerGroups.nonCv}
          periodText={periodSubText}
        />
      </div>

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Tagihan
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link to="/tagihan" className={cardLink}>
          <StatCard
            label="Total Tagihan"
            value={formatCurrency(stats.totalTagihanBulan)}
            icon={FileText}
            tone="sky"
            sub={periodSubText}
          />
        </Link>
        <Link to="/tagihan" className={cardLink}>
          <StatCard
            label="Sudah Bayar"
            value={stats.sudahBayarCount}
            icon={Wallet}
            tone="emerald"
            sub={`${formatCurrency(stats.sudahBayarNominal)} · ${periodSubText}`}
          />
        </Link>
        <Link to="/tagihan" className={cardLink}>
          <StatCard
            label="Belum Bayar"
            value={stats.belumBayarCount}
            icon={AlertTriangle}
            tone="amber"
            sub={`${formatCurrency(stats.belumBayarNominal)} nominal`}
          />
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Link to="/tagihan" className={cardLink}>
          <StatCard
            label="Cicilan"
            value={stats.cicilan}
            icon={Layers}
            tone="amber"
          />
        </Link>
        <Link to="/tagihan" className={cardLink}>
          <StatCard
            label="Menunggak"
            value={stats.menunggak}
            icon={AlertTriangle}
            tone="red"
          />
        </Link>
        <Link to="/tagihan" className={cardLink}>
          <StatCard
            label="Dibayar Rapel"
            value={stats.rapel}
            icon={Layers}
            tone="sky"
          />
        </Link>
      </div>

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        CV
      </h3>
      <DashboardCVCards
        stats={stats}
        settings={settings}
        rangeText={rangeText}
        periodText={periodSubText}
      />

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Keuangan
      </h3>
      <DashboardFinanceCards stats={stats} rangeText={rangeText} />

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Komunikasi
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <Link to="/whatsapp" className={cardLink}>
          <StatCard
            label="Broadcast Hari Ini"
            value={stats.broadcastCount}
            icon={Send}
            tone="indigo"
          />
        </Link>
        <Link to="/whatsapp" className={cardLink}>
          <StatCard
            label="Penerima Broadcast"
            value={stats.broadcastRecipients}
            icon={Send}
            tone="sky"
          />
        </Link>
        <Link to="/whatsapp" className={cardLink}>
          <StatCard
            label="Broadcast Terakhir"
            value={
              stats.lastBroadcast
                ? periodLabel(stats.lastBroadcast.date?.slice(0, 7))
                : "-"
            }
            icon={Send}
            tone="slate"
          />
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="font-heading text-base font-semibold text-slate-900">
          Pemasukan vs Pengeluaran
        </h3>
        <p className="text-xs text-slate-500">6 bulan terakhir</p>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
              />
              <Tooltip
                formatter={(v) => formatCurrency(v)}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Pengeluaran" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <DashboardCustomerLunasPercent
        total={stats.total}
        lunas={stats.pelangganLunas}
        periodText={periodSubText}
      />
      <DashboardProfitPercent
        omset={stats.totalTagihanBulan}
        profit={untungBersihSaya}
        rangeText={rangeText}
      />
      <DashboardPercentBreakdown
        totalTagihan={stats.totalTagihanBulan}
        sudahBayar={stats.sudahBayarNominal}
        belumBayar={Math.max(
          stats.totalTagihanBulan - stats.sudahBayarNominal,
          0,
        )}
        cvNominal={stats.omsetCV}
        pajakNominal={stats.pajakCV}
        pengeluaran={pengeluaranOperasional}
        untung={untungBersihSaya}
        gajiNominal={gajiExpense}
        rangeText={rangeText}
      />
    </div>
  );
}
