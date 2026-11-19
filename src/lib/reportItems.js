import {
  formatCurrency,
  formatDate,
  periodLabel,
  invoiceRemaining,
} from "@/lib/billing";

// Daftar transaksi pembentuk nominal untuk jendela ⓘ (hanya baca).

export const fmtRange = (s, e) =>
  s === e ? formatDate(s) : `${formatDate(s)} – ${formatDate(e)}`;

export const itemsPay = (rows, key = "payment_amount") =>
  rows.map((r) => ({
    label: r.customer_name,
    sub: `${formatDate(r.date)} · ${r.transaction_number || "-"}${r.period ? " · " + periodLabel(r.period) : ""}`,
    value: formatCurrency(r[key]),
  }));

export const itemsSource = (rows) =>
  rows.map((r) => ({
    label: r.kategori,
    sub: `${formatDate(r.date)} · ${r.keterangan}`,
    value: formatCurrency(r.nominal),
  }));

export const itemsSetoran = (rows, key = "nominal") =>
  rows.map((r) => ({
    label: r.customer_name,
    sub: `${periodLabel(r.period)}${r.deposit_date ? " · setor " + formatDate(r.deposit_date) : ""}`,
    value: formatCurrency(r[key]),
  }));

export const itemsTax = (rows) =>
  rows.map((r) => ({
    label: r.customer_name,
    sub: `${periodLabel(r.period)} · dasar ${formatCurrency(r.nominal)}`,
    value: formatCurrency(r.pajak),
  }));

export const itemsUnpaid = (rows) =>
  rows.map((i) => ({
    label: i.customer_name,
    sub: `${periodLabel(i.period)} · ${i.invoice_number || "-"}`,
    value: formatCurrency(invoiceRemaining(i)),
  }));
