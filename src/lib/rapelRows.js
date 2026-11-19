import { formatCurrency, periodLabel } from "@/lib/billing";
import { rapelPeriod, rapelState } from "@/lib/rapel";

// Baris tampilan daftar Rapel (hanya membaca transaksi Rapel + tagihan yang sudah ada).
export function buildRapelRows(pays, customers, invoices) {
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

  return pays
    .map((p) => {
      const state = rapelState(p);
      const per = rapelPeriod(p);
      const allocs = p.allocations || [];
      const periods = per
        ? [per]
        : [...new Set(allocs.map((a) => a.period).filter(Boolean))];
      const ids = allocs.map((a) => a.invoice_id).filter(Boolean);
      const numbers = p.rapel_invoice_number
        ? [p.rapel_invoice_number]
        : ids.map((id) => invById[id]?.invoice_number).filter(Boolean);
      const target =
        state === "menunggu" ? invByKey[`${p.customer_id}|${per}`] : null;
      const used =
        p.rapel_used_amount != null
          ? Number(p.rapel_used_amount)
          : allocs.reduce((s, a) => s + Number(a.amount || 0), 0);
      const surplus = Number(p.rapel_surplus_amount || 0);

      let invoiceText = "-";
      let detailText = "";
      if (state === "menunggu") {
        invoiceText = target
          ? `${target.invoice_number} sudah ada, belum dihubungkan`
          : "Belum dibuat";
      } else {
        invoiceText = numbers.join(", ") || "-";
        if (state === "teraplikasi")
          detailText = `Dipakai ${formatCurrency(used)}${surplus > 0 ? ` · kelebihan ${formatCurrency(surplus)} → saldo` : ""}`;
        else detailText = "Transaksi dibatalkan";
      }

      return {
        id: p.id,
        p,
        state,
        date: p.date,
        customer_name: p.customer_name || custById[p.customer_id]?.name || "-",
        customer_code: custById[p.customer_id]?.customer_id || "",
        rapelId: p.transaction_number || "-",
        periodKey: periods[0] || "",
        periodText: periods.map(periodLabel).join(", ") || "-",
        amount: Number(p.amount || 0),
        invoiceText,
        detailText,
        canApply: !!target,
        notes: p.notes || "",
      };
    })
    .sort((a, b) => {
      const pd = (b.periodKey || "").localeCompare(a.periodKey || "");
      if (pd !== 0) return pd;
      return (b.date || "").localeCompare(a.date || "");
    });
}
