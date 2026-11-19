import { localApi } from "@/api/localClient";
import {
  nextPaymentNumber,
  recomputeInvoice,
  recomputeInvoices,
} from "@/lib/billing";

// RAPEL = pembayaran di muka untuk periode tagihan masa depan (BUKAN cicilan).
// Disimpan sebagai transaksi Payment (payment_type "rapel") — satu-satunya transaksi pembayarannya.
// Saat tagihan periode tujuan dibuat, rapel hanya DIHUBUNGKAN ke tagihan (tidak ada pembayaran baru).

export const RAPEL_STATE_LABEL = {
  menunggu: "Menunggu Tagihan",
  teraplikasi: "Teraplikasi",
  void: "Dibatalkan",
};

export function rapelPeriod(p) {
  return (
    p.rapel_period || (p.allocations || []).find((a) => a.period)?.period || ""
  );
}

// Rapel masih menunggu selama belum ada tagihan yang menerimanya.
export function isRapelPending(p) {
  if (p.rapel_status) return p.rapel_status === "menunggu_tagihan";
  return (p.allocations || []).some((a) => !a.invoice_id);
}

export function rapelState(p) {
  if (p.status === "void") return "void";
  return isRapelPending(p) ? "menunggu" : "teraplikasi";
}

// Berapa rapel yang dipakai untuk tagihan, dan berapa sisanya (kelebihan).
export function planRapelUse(rapelAmount, invoiceAmount, alreadyPaid = 0) {
  const rapel = Number(rapelAmount || 0);
  const due = Math.max(
    0,
    Number(invoiceAmount || 0) - Number(alreadyPaid || 0),
  );
  const used = Math.min(due, rapel);
  return { used, surplus: Math.max(0, rapel - used) };
}

async function changeCredit(customerId, delta) {
  const c = await localApi.entities.Customer.get(customerId);
  const next = Math.max(0, Number(c?.credit_balance || 0) + delta);
  await localApi.entities.Customer.update(customerId, { credit_balance: next });
}

async function runApply({
  period,
  customerId,
  knownInvoices = [],
  knownPayments = [],
}) {
  const q = { payment_type: "rapel", status: "active" };
  if (customerId) q.customer_id = customerId;
  const fetched = await localApi.entities.Payment.filter(q, "date", 1000);
  // Rapel yang baru saja dibuat pemanggil ikut diproses walau belum muncul di hasil baca database
  const merged = new Map(fetched.map((p) => [p.id, p]));
  knownPayments.forEach((p) => {
    if (p?.id) merged.set(p.id, p);
  });
  const all = [...merged.values()];
  const pending = all.filter(
    (p) =>
      isRapelPending(p) &&
      rapelPeriod(p) &&
      (!period || rapelPeriod(p) === period),
  );
  const result = { applied: 0, used: 0, surplus: 0, items: [] };
  if (pending.length === 0) return result;

  // Kelompokkan berdasarkan CUSTOMER ID + PERIODE (bukan nama)
  const groups = new Map();
  for (const p of pending) {
    const k = `${p.customer_id}|${rapelPeriod(p)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }

  const periods = [...new Set([...groups.keys()].map((k) => k.split("|")[1]))];
  const invByKey = {};
  for (const per of periods) {
    const invs = await localApi.entities.Invoice.filter(
      { period: per },
      "-created_date",
      3000,
    );
    invs.forEach((i) => {
      invByKey[`${i.customer_id}|${i.period}`] = i;
    });
  }
  // Tagihan yang baru saja dibuat (dikenal pemanggil) dipakai juga, agar tidak terlewat oleh jeda baca database
  knownInvoices.forEach((i) => {
    if (i?.id && i.customer_id && i.period)
      invByKey[`${i.customer_id}|${i.period}`] = i;
  });

  for (const [key, list] of groups) {
    const inv = invByKey[key];
    if (!inv) continue; // tagihan belum dibuat -> rapel tetap MENUNGGU TAGIHAN
    let paid = Number(inv.total_paid || 0);
    const updated = [];
    for (const p of list.sort((a, b) =>
      (a.date || "").localeCompare(b.date || ""),
    )) {
      const fresh = await localApi.entities.Payment.get(p.id);
      if (!fresh || fresh.status !== "active" || !isRapelPending(fresh))
        continue; // cegah diterapkan dua kali
      const plan = planRapelUse(fresh.amount, inv.amount, paid);
      const patch = {
        allocations: [
          { invoice_id: inv.id, period: inv.period, amount: plan.used },
        ],
        rapel_status: "teraplikasi",
        rapel_invoice_id: inv.id,
        rapel_invoice_number: inv.invoice_number,
        rapel_used_amount: plan.used,
        rapel_surplus_amount: plan.surplus,
      };
      await localApi.entities.Payment.update(p.id, patch);
      updated.push({ ...fresh, ...patch });
      if (plan.surplus > 0) await changeCredit(p.customer_id, plan.surplus); // kelebihan -> saldo pelanggan
      paid += plan.used;
      result.applied += 1;
      result.used += plan.used;
      result.surplus += plan.surplus;
      result.items.push({
        payment_id: p.id,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        used: plan.used,
        surplus: plan.surplus,
      });
    }
    if (updated.length) await recomputeInvoice(inv.id, updated);
  }
  return result;
}

// Terapkan rapel yang menunggu ke tagihan yang sudah ada (cocok via Customer ID + Periode).
// Dijalankan berurutan agar tidak ada dua proses menerapkan rapel yang sama.
let queue = Promise.resolve();
export function applyPendingRapel(opts = {}) {
  const run = queue.then(() => runApply(opts));
  queue = run.catch(() => {});
  return run;
}

export async function createRapel({
  customer,
  period,
  amount,
  date,
  method = "cash",
  notes = "",
}) {
  const nominal = Number(amount);
  const txNum = (await nextPaymentNumber()).replace(/^PAY-/, "RPL-");
  const payment = await localApi.entities.Payment.create({
    transaction_number: txNum,
    customer_id: customer.id,
    customer_name: customer.name,
    date,
    amount: nominal,
    method,
    payment_type: "rapel",
    allocations: [{ period, amount: nominal }],
    notes,
    status: "active",
    rapel_status: "menunggu_tagihan",
    rapel_period: period,
  });
  // Bila tagihan periode tujuan sudah ada, rapel langsung dihubungkan.
  const existing = await localApi.entities.Invoice.filter(
    { customer_id: customer.id, period },
    "-created_date",
    50,
  );
  const res = await applyPendingRapel({
    customerId: customer.id,
    period,
    knownPayments: [payment],
    knownInvoices: existing,
  });
  const applied = res.items.find((i) => i.payment_id === payment.id) || null;
  return { payment, applied };
}

const invoiceIdsOf = (p) =>
  (p.allocations || []).map((a) => a.invoice_id).filter(Boolean);

async function releaseSurplus(p) {
  const s = Number(p.rapel_surplus_amount || 0);
  if (s > 0) await changeCredit(p.customer_id, -s);
}

export async function voidRapel(p) {
  await localApi.entities.Payment.update(p.id, { status: "void" });
  await releaseSurplus(p);
  await recomputeInvoices(invoiceIdsOf(p), [{ ...p, status: "void" }]);
}

export async function deleteRapel(p) {
  await localApi.entities.Payment.delete(p.id);
  if (p.status !== "void") await releaseSurplus(p); // void sudah melepas kelebihan
  await recomputeInvoices(invoiceIdsOf(p), [{ ...p, status: "void" }]);
}
