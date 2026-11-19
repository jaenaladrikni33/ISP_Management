import {
  buildNonCVRows,
  cvPajakPerCustomer,
  computeCVDivision,
  cvSetorDone,
  invoiceRemaining,
  periodLabel,
  isInvoiceSettled,
  computeCVHeld,
} from "@/lib/billing";

// ====== PERHITUNGAN LAPORAN (hanya MEMBACA transaksi yang sudah ada) ======
// TRANSAKSI -> SUMBER DATA -> PERHITUNGAN -> LAPORAN. Tidak ada transaksi baru yang dibuat di sini.

const pad = (n) => String(n).padStart(2, "0");
export const toYMD = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const RANGE_OPTIONS = [
  { key: "today", label: "Hari Ini" },
  { key: "week", label: "Minggu Ini" },
  { key: "month", label: "Bulan Ini" },
  { key: "lastmonth", label: "Bulan Lalu" },
  { key: "year", label: "Tahun Ini" },
  { key: "pick", label: "Pilih Bulan" },
  { key: "custom", label: "Rentang Tanggal" },
];

const monthBounds = (y, m0) => [
  toYMD(new Date(y, m0, 1)),
  toYMD(new Date(y, m0 + 1, 0)),
];

// Mengembalikan [tanggalMulai, tanggalAkhir] dalam format YYYY-MM-DD
export function rangeBounds(key, opts = {}, now = new Date()) {
  const today = toYMD(now);
  const y = now.getFullYear();
  const m = now.getMonth();
  if (key === "today") return [today, today];
  if (key === "week") {
    const s = new Date(now);
    s.setDate(s.getDate() - s.getDay());
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    return [toYMD(s), toYMD(e)];
  }
  if (key === "lastmonth") return monthBounds(y, m - 1);
  if (key === "year") return [`${y}-01-01`, `${y}-12-31`];
  if (key === "pick" && opts.month) {
    const [yy, mm] = opts.month.split("-").map(Number);
    return monthBounds(yy, mm - 1);
  }
  if (key === "custom") {
    const s = opts.cStart || today;
    const e = opts.cEnd || s;
    return s <= e ? [s, e] : [e, s];
  }
  return monthBounds(y, m);
}

const sum = (arr, k) => arr.reduce((s, x) => s + Number(x[k] || 0), 0);
const isActive = (x) => !x.status || x.status === "active";

export function buildReport(data, s, e) {
  const {
    payments = [],
    invoices = [],
    customers = [],
    cvDeposits = [],
    payouts = [],
    incomes = [],
    expenses = [],
    settings = {},
  } = data;
  const inR = (d) => {
    const x = (d || "").slice(0, 10);
    return !!x && x >= s && x <= e;
  };
  const periodIn = (p) => !!p && p >= s.slice(0, 7) && p <= e.slice(0, 7);

  const custById = {};
  customers.forEach((c) => {
    custById[c.id] = c;
  });
  const invById = {};
  const invByKey = {};
  invoices.forEach((i) => {
    invById[i.id] = i;
    invByKey[`${i.customer_id}|${i.period}`] = i;
  });

  // 1. Pembayaran pelanggan -> dipecah CV / Non-CV (satu baris per alokasi pembayaran)
  const activePay = payments.filter(isActive);
  const payRows = buildNonCVRows(activePay, invoices, customers, cvDeposits)
    .filter((r) => inR(r.date))
    .map((r, idx) => ({
      ...r,
      key: `pay-${r.payment_id}-${r.invoice_id || r.period || idx}`,
      customer_code: custById[r.customer_id]?.customer_id || "",
    }));
  // Laporan CV hanya memuat pelanggan yang tagihannya SUDAH LUNAS (bukan cicilan / belum bayar)
  const cvList = payRows.filter(
    (r) =>
      r.dana_cv > 0 &&
      (!r.invoice_id || isInvoiceSettled(invById[r.invoice_id])),
  );
  const nonCvList = payRows.filter((r) => r.non_cv > 0);
  const totalBayar = sum(payRows, "payment_amount");
  const totalCV = sum(payRows, "dana_cv");
  const totalNonCV = sum(payRows, "non_cv");

  // 2. Pemasukan terpadu (anti double counting via ID transaksi sumber)
  const seen = new Set();
  const incomeRows = [];
  const pushIncome = (row) => {
    const k = `${row.source_type}|${row.source_id}|${row.key}`;
    if (seen.has(k)) return;
    seen.add(k);
    incomeRows.push(row);
  };
  nonCvList.forEach((r) =>
    pushIncome({
      key: `noncv-${r.key}`,
      date: r.date,
      kategori: "Pendapatan Non-CV",
      jenis: "OTOMATIS",
      keterangan: `${r.customer_name}${r.period ? " · " + periodLabel(r.period) : ""}`,
      sumber: "Transaksi Pembayaran",
      source_type: "PEMBAYARAN_PELANGGAN",
      source_id: r.payment_id,
      nominal: r.non_cv,
    }),
  );
  payouts
    .filter((p) => isActive(p) && inR(p.date))
    .forEach((p) =>
      pushIncome({
        key: `gaji-${p.id}`,
        date: p.date,
        kategori: "Gaji/Pembayaran CV",
        jenis: "OTOMATIS",
        keterangan:
          p.description ||
          (p.period ? periodLabel(p.period) : "Gaji/Pembayaran CV"),
        sumber: "Menu Gaji CV",
        source_type: "GAJI_CV",
        source_id: p.id,
        nominal: Number(p.amount || 0),
      }),
    );
  incomes
    .filter((i) => isActive(i) && inR(i.date))
    .forEach((i) =>
      pushIncome({
        key: `manual-${i.id}`,
        date: i.date,
        kategori: i.category || "Pemasukan Lainnya",
        jenis: "MANUAL",
        keterangan: i.description || "-",
        sumber: "Input Keuangan",
        source_type: "INPUT_KEUANGAN",
        source_id: i.id,
        nominal: Number(i.amount || 0),
      }),
    );
  incomeRows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const payoutRows = incomeRows.filter((r) => r.source_type === "GAJI_CV");
  const manualRows = incomeRows.filter(
    (r) => r.source_type === "INPUT_KEUANGAN",
  );
  const totalPayout = sum(payoutRows, "nominal");
  const totalManual = sum(manualRows, "nominal");
  const totalPemasukan = totalNonCV + totalPayout + totalManual;

  // 3. Pengeluaran
  const expenseRows = expenses
    .filter((x) => isActive(x) && inR(x.date))
    .map((x) => ({
      key: `exp-${x.id}`,
      date: x.date,
      kategori: x.category || "Lainnya",
      keterangan: x.description || "-",
      sumber: "Input Keuangan (Pengeluaran)",
      source_id: x.id,
      nominal: Number(x.amount || 0),
    }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const totalExpense = sum(expenseRows, "nominal");
  const expByCat = Object.entries(
    expenseRows.reduce((m, r) => {
      m[r.kategori] = (m[r.kategori] || 0) + r.nominal;
      return m;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const saldo = totalPemasukan - totalExpense;

  // 4. Setoran WiFi/CV — dibaca dari data Setoran CV + statusnya sendiri (BUKAN dari status lunas pelanggan)
  const setoranRows = cvDeposits
    .filter((d) => {
      if (!periodIn(d.period)) return false;
      const inv =
        (d.invoice_id && invById[d.invoice_id]) ||
        invByKey[`${d.customer_id}|${d.period}`];
      // Pelanggan yang belum lunas / masih cicilan belum masuk laporan CV
      return !inv || isInvoiceSettled(inv);
    })
    .map((d) => {
      const inv =
        (d.invoice_id && invById[d.invoice_id]) ||
        invByKey[`${d.customer_id}|${d.period}`];
      const nominal = Number(d.cv_deposit_amount || 0);
      const disetor = cvSetorDone(d);
      return {
        key: `setor-${d.id}`,
        id: d.id,
        customer_id: d.customer_id,
        customer_name: d.customer_name,
        period: d.period,
        nominal,
        disetor,
        belum: Math.max(0, nominal - disetor),
        status: d.status || "belum_setor",
        deposit_date: d.deposit_date || "",
        payStatus: inv?.status || "",
        invoice_number: inv?.invoice_number || "",
      };
    });
  // Status Setoran CV per pelanggan + periode (semua periode, agar bisa dicocokkan dengan transaksi pembayaran)
  const cvStatusByKey = {};
  cvDeposits.forEach((d) => {
    cvStatusByKey[`${d.customer_id}|${d.period}`] = d.status || "belum_setor";
  });
  const totalSetoran = sum(setoranRows, "nominal");
  const totalDisetor = sum(setoranRows, "disetor");
  const totalBelumSetor = sum(setoranRows, "belum");

  // 5. Pajak CV — dasar: Setoran CV berstatus sudah disetorkan (sama dengan Dashboard & Laporan Pembagian CV)
  const taxRows = setoranRows
    .filter((r) => r.status === "sudah_setor")
    .map((r) => ({ ...r, ...cvPajakPerCustomer(r.nominal) }));
  const omsetCV = sum(taxRows, "nominal");
  const totalPajak = sum(taxRows, "pajak");
  const division = computeCVDivision(
    omsetCV,
    totalPajak,
    settings.cv_pusat_pct ?? 30,
    settings.cv_mitra_pct ?? 70,
    settings.cv_pph23_pct ?? 2,
  );

  // 5b. Dana CV ditahan — bagian CV dari tagihan yang sudah LUNAS tetapi belum disetorkan.
  // Uangnya sudah masuk rekening usaha (bukan pendapatan), dan otomatis berkurang saat disetorkan.
  const heldCalc = computeCVHeld(
    invoices.filter((i) => periodIn(i.period)),
    cvDeposits.filter((d) => periodIn(d.period)),
  );
  const cvHeldRows = heldCalc.rows;
  const cvHeld = heldCalc.total;
  const saldoKas = saldo + cvHeld;

  // 6. Piutang (saldo tagihan belum lunas saat ini)
  const unpaid = invoices.filter(
    (i) => i.status !== "lunas" && i.status !== "dibayar_rapel",
  );
  const piutang = unpaid.reduce((t, i) => t + invoiceRemaining(i), 0);

  // 7. Riwayat transaksi (gabungan, hanya baca)
  const history = [
    ...activePay
      .filter((p) => inR(p.date))
      .map((p) => ({
        key: `h-pay-${p.id}`,
        date: p.date,
        jenis: p.payment_type === "rapel" ? "Rapel" : "Pembayaran",
        keterangan: `${p.customer_name || "-"}${(p.allocations || []).some((a) => a.period) ? " · " + [...new Set(p.allocations.map((a) => a.period).filter(Boolean))].map(periodLabel).join(", ") : ""}`,
        sumber: p.transaction_number || "-",
        masuk: Number(p.amount || 0),
        keluar: 0,
      })),
    ...payoutRows.map((r) => ({
      key: `h-${r.key}`,
      date: r.date,
      jenis: "Gaji CV",
      keterangan: r.keterangan,
      sumber: "Menu Gaji CV",
      masuk: r.nominal,
      keluar: 0,
    })),
    ...manualRows.map((r) => ({
      key: `h-${r.key}`,
      date: r.date,
      jenis: "Pemasukan Lain",
      keterangan: r.keterangan,
      sumber: "Input Keuangan",
      masuk: r.nominal,
      keluar: 0,
    })),
    ...expenseRows.map((r) => ({
      key: `h-${r.key}`,
      date: r.date,
      jenis: "Pengeluaran",
      keterangan: `${r.kategori} · ${r.keterangan}`,
      sumber: r.sumber,
      masuk: 0,
      keluar: r.nominal,
    })),
    ...cvDeposits
      .filter(
        (d) =>
          d.status !== "belum_setor" && d.deposit_date && inR(d.deposit_date),
      )
      .map((d) => ({
        key: `h-setor-${d.id}`,
        date: d.deposit_date,
        jenis: "Setoran CV",
        keterangan: `${d.customer_name} · ${periodLabel(d.period)}`,
        sumber: "Penyetoran CV",
        masuk: 0,
        keluar: 0,
        info: cvSetorDone(d),
      })),
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return {
    start: s,
    end: e,
    payRows,
    cvList,
    nonCvList,
    totalBayar,
    totalCV,
    totalNonCV,
    incomeRows,
    payoutRows,
    manualRows,
    totalPayout,
    totalManual,
    totalPemasukan,
    expenseRows,
    totalExpense,
    expByCat,
    saldo,
    setoranRows,
    cvStatusByKey,
    totalSetoran,
    totalDisetor,
    totalBelumSetor,
    cvHeldRows,
    cvHeld,
    saldoKas,
    taxRows,
    omsetCV,
    totalPajak,
    division,
    unpaid,
    piutang,
    history,
  };
}
