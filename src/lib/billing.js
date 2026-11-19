import { localApi } from "@/api/localClient";

export function normalizePhone(phone) {
  if (!phone) return "";
  let p = String(phone).replace(/[^0-9]/g, "");
  if (p.startsWith("62")) return p;
  if (p.startsWith("0")) return "62" + p.slice(1);
  if (p.startsWith("8")) return "62" + p;
  return p;
}

// Valid Indonesian WhatsApp number: 62xx with 9-14 digits total
export function isValidWhatsApp(phone) {
  const p = normalizePhone(phone);
  return /^62\d{8,13}$/.test(p);
}

export function formatCurrency(n) {
  const v = Number(n || 0);
  return "Rp" + v.toLocaleString("id-ID");
}

export function formatNumber(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function currentPeriod(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function periodLabel(period) {
  if (!period) return "-";
  const [y, m] = period.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

// Shift a "YYYY-MM" period by N months (N may be negative)
export function addMonths(period, n) {
  let [y, m] = period.split("-").map(Number);
  m -= 1;
  m += n;
  y += Math.floor(m / 12);
  m = (((m % 12) + 12) % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function formatDate(d) {
  if (!d) return "-";
  const date = new Date(d);
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function nextInvoiceNumber() {
  const list = await localApi.entities.Invoice.list("-created_date", 1);
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const count = list.length || 0;
  return `INV-${ym}-${String(count + 1).padStart(4, "0")}`;
}

export async function nextPaymentNumber() {
  const list = await localApi.entities.Payment.list("-created_date", 1);
  const count = list.length || 0;
  return `PAY-${Date.now().toString().slice(-6)}${String(count + 1).padStart(3, "0")}`;
}

// FIFO allocation of an amount across unpaid invoices (oldest period first)
export function allocateRapel(amount, invoices) {
  const sorted = [...invoices].sort((a, b) => a.period.localeCompare(b.period));
  let remaining = Number(amount);
  const allocations = [];
  for (const inv of sorted) {
    if (remaining <= 0) break;
    const due = inv.amount - (inv.total_paid || 0);
    if (due <= 0) continue;
    const alloc = Math.min(due, remaining);
    allocations.push({ invoice_id: inv.id, period: inv.period, amount: alloc });
    remaining -= alloc;
  }
  return { allocations, leftover: Math.max(0, remaining) };
}

export function invoiceRemaining(inv) {
  return Number(inv.remaining ?? inv.amount - (inv.total_paid || 0));
}

// Recompute a single invoice's paid/remaining/status from all active payments
// `overrides`: pembayaran yang baru saja diubah (status/alokasi). Dipakai menggantikan hasil baca database
// agar perhitungan tidak terpengaruh jeda baca-setelah-tulis (void/hapus/terapkan rapel).
export async function recomputeInvoice(invoiceId, overrides = []) {
  const invoice = await localApi.entities.Invoice.get(invoiceId);
  const fetched = await localApi.entities.Payment.filter(
    { status: "active" },
    "-date",
    3000,
  );
  const merged = new Map(fetched.map((p) => [p.id, p]));
  overrides.forEach((p) => merged.set(p.id, p));
  const payments = [...merged.values()].filter(
    (p) => !p.status || p.status === "active",
  );
  let totalPaid = 0;
  let rapelPaid = 0; // bagian yang dibayar lewat Rapel (prepayment) — bukan cicilan
  for (const p of payments) {
    if (p.allocations) {
      for (const a of p.allocations) {
        if (a.invoice_id === invoiceId) {
          const v = Number(a.amount || 0);
          totalPaid += v;
          if (p.payment_type === "rapel" && p.rapel_status === "teraplikasi")
            rapelPaid += v;
        }
      }
    }
  }
  const remaining = Math.max(0, invoice.amount - totalPaid);
  let status = "belum_bayar";
  if (remaining <= 0) {
    status = invoice.is_rapel ? "dibayar_rapel" : "lunas";
  } else if (totalPaid - rapelPaid > 0) {
    status = "cicilan";
  } else {
    const due = invoice.due_date ? new Date(invoice.due_date) : null;
    if (due && due < new Date()) status = "jatuh_tempo";
  }
  await localApi.entities.Invoice.update(invoiceId, {
    total_paid: totalPaid,
    remaining,
    status,
  });
  return { total_paid: totalPaid, remaining, status };
}

export async function recomputeInvoices(invoiceIds, overrides = []) {
  const uniq = [...new Set((invoiceIds || []).filter(Boolean))];
  for (const id of uniq) {
    await recomputeInvoice(id, overrides);
  }
}

// ====== SETORAN WIFI/CV — berdiri sendiri dari status lunas pelanggan ======
// Nominal yang sudah disetorkan ke CV dibaca HANYA dari data Setoran CV itu sendiri.
export function cvSetorDone(d) {
  const nominal = Number(d.cv_deposit_amount || 0);
  if (d.status === "sudah_setor") return nominal;
  if (d.status === "setor_sebagian")
    return Math.min(nominal, Number(d.deposit_amount || 0));
  return 0;
}

// Saat tagihan dihapus: hanya Setoran CV yang belum pernah disetorkan ikut dihapus.
// Setoran yang sudah tercatat disetorkan tetap disimpan sebagai histori. Mengembalikan jumlah yang dipertahankan.
export async function removeUnsettledCVDeposits(invoiceId) {
  const cvs = await localApi.entities.CVDeposit.filter({ invoice_id: invoiceId });
  let kept = 0;
  for (const cv of cvs) {
    if (
      (cv.status && cv.status !== "belum_setor") ||
      Number(cv.deposit_amount || 0) > 0
    )
      kept++;
    else await localApi.entities.CVDeposit.delete(cv.id);
  }
  return kept;
}

// ====== CV SYSTEM — 2 LEVEL ======
// LEVEL 1: Setoran CV per pelanggan (NOMINAL RUPIAH, bukan persentase)
// LEVEL 2: Pembagian Hasil CV (Pusat/Mitra/PPH23)

// Level 1: pecah pembayaran aktual menjadi dana CV & non-CV (anti double counting)
// Tagihan 150rb, Setoran CV 111rb. Bayar 150rb -> danaCV 111rb, nonCV 39rb.
// Bayar 50rb -> danaCV 50rb (bukan 111rb), nonCV 0.
export function computeCVDana(paymentAmount, cvDepositAmount) {
  const pay = Number(paymentAmount || 0);
  const cv = Number(cvDepositAmount || 0);
  const danaCV = Math.max(0, Math.min(pay, cv));
  const nonCV = Math.max(0, pay - danaCV);
  return { danaCV, nonCV };
}

// Dana CV terkumpul untuk satu invoice berdasarkan pembayaran aktual
export function invoiceDanaCV(totalPaid, cvDepositAmount) {
  return Math.max(
    0,
    Math.min(Number(totalPaid || 0), Number(cvDepositAmount || 0)),
  );
}

// Level 2: Pembagian Hasil CV
// Keuntungan = Omset - Pajak; Pusat = Keuntungan*pusat%; Mitra = Keuntungan*mitra%;
// PPh23 = Mitra*pph23%; Bersih Mitra = Mitra - PPh23
export function computeCVDivision(
  omset,
  pajak,
  pusatPct = 30,
  mitraPct = 70,
  pph23Pct = 2,
) {
  const om = Number(omset || 0);
  const pj = Number(pajak || 0);
  const keuntungan = om - pj;
  const pusat = Math.round(keuntungan * (Number(pusatPct || 0) / 100));
  const mitra = Math.round(keuntungan * (Number(mitraPct || 0) / 100));
  const pph23 = Math.round(mitra * (Number(pph23Pct || 0) / 100));
  const bersihMitra = mitra - pph23;
  return { omset: om, pajak: pj, keuntungan, pusat, mitra, pph23, bersihMitra };
}

export const STATUS_LABELS = {
  belum_bayar: "Belum Bayar",
  cicilan: "Cicilan",
  lunas: "Lunas",
  jatuh_tempo: "Jatuh Tempo",
  menunggak: "Menunggak",
  dibayar_rapel: "Dibayar Rapel",
};

export const STATUS_COLORS = {
  belum_bayar: "bg-slate-100 text-slate-700",
  cicilan: "bg-amber-100 text-amber-700",
  lunas: "bg-emerald-100 text-emerald-700",
  jatuh_tempo: "bg-orange-100 text-orange-700",
  menunggak: "bg-red-100 text-red-700",
  dibayar_rapel: "bg-blue-100 text-blue-700",
};

export const CV_STATUS_LABELS = {
  belum_setor: "Belum Disetorkan",
  sudah_setor: "Disetorkan",
  setor_sebagian: "Setor Sebagian",
};

export const CV_STATUS_COLORS = {
  belum_setor: "bg-slate-100 text-slate-700",
  sudah_setor: "bg-emerald-100 text-emerald-700",
  setor_sebagian: "bg-amber-100 text-amber-700",
};

// Pajak per pelanggan CV: harga_pajak sudah termasuk PPN 11% + BHP USO 4% (total 15%).
// harga_sebelum = harga_pajak / 1.15 ; PPN = 11% × harga ; BHP = 4% × harga.
export function cvPajakPerCustomer(hargaPajak) {
  const hp = Number(hargaPajak || 0);
  const harga = Math.round(hp / 1.15);
  const ppn = Math.round(harga * 0.11);
  const bhp = Math.round(harga * 0.04);
  return { harga, ppn, bhp, pajak: ppn + bhp };
}

// Total pajak CV untuk sebuah periode dari daftar CVDeposit
export function cvTotalPajak(cvDepositsForPeriod) {
  return cvDepositsForPeriod.reduce(
    (s, d) => s + cvPajakPerCustomer(d.cv_deposit_amount).pajak,
    0,
  );
}

export const PAY_STATUS_LABELS = {
  belum_bayar: "Belum Bayar",
  cicilan: "Cicilan",
  lunas: "Lunas",
  jatuh_tempo: "Jatuh Tempo",
  menunggak: "Menunggak",
  dibayar_rapel: "Dibayar Rapel",
};

// ====== STATUS LUNAS & DANA CV DITAHAN ======
// Tagihan dianggap selesai (lunas) jika sudah dibayar penuh.
export function isInvoiceSettled(inv) {
  return !!inv && (inv.status === "lunas" || inv.status === "dibayar_rapel");
}

// Dana CV yang SUDAH masuk (tagihan lunas) tetapi BELUM disetorkan ke CV.
// Uang ini bukan pendapatan — hanya ditahan di rekening usaha, dan otomatis berkurang saat disetorkan.
export function computeCVHeld(invoices, cvDeposits) {
  const invById = {};
  const invByKey = {};
  (invoices || []).forEach((i) => {
    invById[i.id] = i;
    invByKey[`${i.customer_id}|${i.period}`] = i;
  });
  const rows = [];
  for (const d of cvDeposits || []) {
    if (d.status === "void") continue;
    const inv =
      (d.invoice_id && invById[d.invoice_id]) ||
      invByKey[`${d.customer_id}|${d.period}`];
    if (!isInvoiceSettled(inv)) continue;
    const cvPart = Math.max(
      0,
      Math.min(Number(inv.total_paid || 0), Number(d.cv_deposit_amount || 0)),
    );
    const deposited = cvSetorDone(d);
    const held = Math.max(0, cvPart - deposited);
    if (held <= 0) continue;
    rows.push({
      id: d.id,
      customer_id: d.customer_id,
      customer_name: d.customer_name,
      period: d.period,
      nominal: cvPart,
      cv_part: cvPart,
      deposited,
      held,
      deposit_date: d.deposit_date || "",
    });
  }
  return { rows, total: rows.reduce((s, r) => s + r.held, 0) };
}

// ====== PENDAPATAN NON-CV ======
// Dihunakan dari pembayaran aktual (anti double counting).
// Satu baris per alokasi pembayaran:
//  - Pelanggan CV (uses_cv_deposit / ada setoran): Pendapatan Non-CV = pembayaran - min(pembayaran, setoran CV) -> Kategori A (Selisih Setoran CV)
//  - Pelanggan non-CV: Pendapatan Non-CV = seluruh pembayaran -> Kategori B (Pembayaran Tanpa Setoran CV)
export function buildNonCVRows(payments, invoices, customers, cvDeposits) {
  const invById = {};
  (invoices || []).forEach((i) => (invById[i.id] = i));
  const custById = {};
  (customers || []).forEach((c) => (custById[c.id] = c));
  const cvByKey = {};
  (cvDeposits || []).forEach((d) => {
    cvByKey[`${d.customer_id}|${d.period}`] = Number(d.cv_deposit_amount || 0);
  });

  // 1) Satu alokasi pembayaran = satu baris laporan
  const entries = [];
  for (const p of payments || []) {
    if (p.status && p.status !== "active") continue;
    const cust = custById[p.customer_id];
    const allocs =
      p.allocations && p.allocations.length > 0
        ? p.allocations
        : [{ invoice_id: null, period: null, amount: p.amount }];
    for (const a of allocs) {
      const alloc = Number(a.amount || 0);
      if (alloc <= 0) continue;
      const inv = a.invoice_id ? invById[a.invoice_id] : null;
      const period = a.period || inv?.period || null;
      const cvDeposit = period
        ? (cvByKey[`${p.customer_id}|${period}`] ??
          Number(cust?.cv_deposit_amount || 0))
        : Number(cust?.cv_deposit_amount || 0);
      entries.push({
        p,
        cust,
        inv,
        period,
        alloc,
        cvDeposit,
        date: p.date || "",
      });
    }
  }

  // 2) Bagian CV hanya diakui SETELAH tagihan lunas — bukan saat cicilan.
  //    Selama belum lunas, uang yang masuk dihitung sebagai pendapatan pada tanggal pembayarannya.
  const budgetPerInvoice = {};
  for (const e of entries) {
    if (!e.inv) continue;
    const budget = Math.max(
      0,
      Math.min(Number(e.inv.total_paid || 0), Number(e.cvDeposit || 0)),
    );
    budgetPerInvoice[e.inv.id] = Math.max(
      budgetPerInvoice[e.inv.id] || 0,
      budget,
    );
  }
  const ordered = [...entries].sort((a, b) => {
    const ka = a.inv?.id || a.p.id;
    const kb = b.inv?.id || b.p.id;
    if (ka !== kb) return ka < kb ? -1 : 1;
    return (a.date || "").localeCompare(b.date || "");
  });
  const sisaBudget = { ...budgetPerInvoice };
  const danaByEntry = new Map();
  for (const e of ordered) {
    const usesCVThis = !!e.cust?.uses_cv_deposit || e.cvDeposit > 0;
    if (!usesCVThis) {
      danaByEntry.set(e, 0);
      continue;
    }
    if (!e.inv) {
      danaByEntry.set(e, Math.max(0, Math.min(e.alloc, e.cvDeposit)));
      continue;
    } // rapel/prabayar tanpa tagihan
    if (!isInvoiceSettled(e.inv)) {
      danaByEntry.set(e, 0);
      continue;
    }
    const dana = Math.max(0, Math.min(e.alloc, sisaBudget[e.inv.id] || 0));
    sisaBudget[e.inv.id] = Math.max(0, (sisaBudget[e.inv.id] || 0) - dana);
    danaByEntry.set(e, dana);
  }

  // 3) Bentuk baris laporan
  return entries.map((e) => {
    const danaCV = danaByEntry.get(e) || 0;
    const nonCV = Math.max(0, e.alloc - danaCV);
    const usesCVThis = !!e.cust?.uses_cv_deposit || e.cvDeposit > 0;
    let kategori;
    if (danaCV > 0) kategori = "Selisih Setoran CV";
    else if (usesCVThis && e.inv && !isInvoiceSettled(e.inv))
      kategori = "Cicilan (Belum Lunas)";
    else kategori = "Pembayaran Tanpa Setoran CV";
    return {
      date: e.p.date,
      customer_id: e.p.customer_id,
      customer_name: e.p.customer_name || e.cust?.name || "-",
      payment_amount: e.alloc,
      cv_deposit: e.cvDeposit,
      dana_cv: danaCV,
      non_cv: nonCV,
      kategori,
      period: e.period,
      method: e.p.method,
      notes: e.p.notes,
      status: e.inv?.status || "lunas",
      transaction_number: e.p.transaction_number,
      payment_id: e.p.id,
      invoice_id: e.inv?.id,
    };
  });
}
