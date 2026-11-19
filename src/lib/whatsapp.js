import { localApi } from "@/api/localClient";
import {
  normalizePhone,
  formatCurrency,
  periodLabel,
  formatDate,
  isValidWhatsApp,
  invoiceRemaining,
  computeCVDana,
} from "@/lib/billing";

export function buildInvoiceMessage(customer, invoice) {
  const paid = invoice.total_paid || 0;
  const sisa = invoiceRemaining(invoice);
  return `Assalamu'alaikum Bapak/Ibu ${customer.name}.

Berikut informasi tagihan internet ISP_Management:

Paket: ${invoice.package_name || customer.package_name || "-"}
Periode: ${periodLabel(invoice.period)}
Tagihan: ${formatCurrency(invoice.amount)}
Sudah dibayar: ${formatCurrency(paid)}
Sisa: ${formatCurrency(sisa)}
Jatuh tempo: ${formatDate(invoice.due_date)}

Mohon melakukan pembayaran.

Terima kasih.

ISP_Management`;
}

export function buildReminderMessage(customer, unpaidInvoices) {
  const total = unpaidInvoices.reduce((s, i) => s + invoiceRemaining(i), 0);
  const rincian = unpaidInvoices
    .map(
      (i) =>
        `- ${periodLabel(i.period)}: ${formatCurrency(invoiceRemaining(i))}`,
    )
    .join("\n");
  return `Assalamu'alaikum Bapak/Ibu ${customer.name}.

Kami ingin mengingatkan bahwa terdapat tunggakan pembayaran internet ISP_Management.

Total tunggakan: ${formatCurrency(total)}

Rincian:
${rincian}

Silakan melakukan pembayaran sesuai kemampuan.

Terima kasih.

ISP_Management`;
}

export function buildBroadcastMessage(area) {
  return `INFORMASI GANGGUAN ISP_Management

Mohon maaf Bapak/Ibu, saat ini sedang terjadi gangguan jaringan internet di area ${area || "layanan kami"}.

Tim teknis sedang melakukan pengecekan dan perbaikan.

Mohon maaf atas ketidaknyamanannya.

Terima kasih atas pengertiannya.

ISP_Management`;
}

// Variable otomatis untuk broadcast custom
export const BROADCAST_VARIABLES = [
  "{nama}",
  "{id_pelanggan}",
  "{no_whatsapp}",
  "{alamat}",
  "{area}",
  "{paket}",
  "{harga}",
  "{periode}",
  "{tagihan}",
  "{sudah_dibayar}",
  "{sisa}",
  "{status_tagihan}",
  "{tanggal_jatuh_tempo}",
  "{status_cv}",
  "{nominal_setoran_cv}",
];

// Bangun context variabel untuk satu pelanggan (dari tagihan belum lunas terbaru/terlama)
export function buildBroadcastContext(customer, invoices = []) {
  const unpaid = invoices
    .filter((i) => i.status !== "lunas" && i.status !== "dibayar_rapel")
    .sort((a, b) => a.period.localeCompare(b.period));
  const inv = unpaid[0] || invoices[0] || {};
  const sisa = invoiceRemaining(inv);
  const { danaCV } = computeCVDana(
    inv.total_paid || 0,
    customer.cv_deposit_amount || 0,
  );
  return {
    "{nama}": customer.name || "",
    "{id_pelanggan}": customer.customer_id || "",
    "{no_whatsapp}": normalizePhone(customer.phone) || customer.phone || "",
    "{alamat}": customer.address || "",
    "{area}": customer.area || "",
    "{paket}": customer.package_name || "",
    "{harga}": formatCurrency(customer.monthly_price || 0),
    "{periode}": periodLabel(inv.period),
    "{tagihan}": formatCurrency(inv.amount || 0),
    "{sudah_dibayar}": formatCurrency(inv.total_paid || 0),
    "{sisa}": formatCurrency(sisa),
    "{status_tagihan}": inv.status || "",
    "{tanggal_jatuh_tempo}": formatDate(inv.due_date),
    "{status_cv}": customer.uses_cv_deposit
      ? customer.cv_status === "sudah_setor"
        ? "Sudah Setor CV"
        : "Belum Setor CV"
      : "Non-CV",
    "{nominal_setoran_cv}": formatCurrency(customer.cv_deposit_amount || 0),
  };
}

export function personalizeMessage(template, ctx) {
  let out = template || "";
  for (const [key, val] of Object.entries(ctx)) {
    out = out.split(key).join(String(val));
  }
  return out;
}

// Open WhatsApp chat and log the message
export async function sendWhatsApp(customer, content, messageType = "tagihan") {
  const phone = normalizePhone(customer.phone);
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(content)}`;
  window.open(url, "_blank");
  await localApi.entities.WhatsAppLog.create({
    date: new Date().toISOString(),
    customer_id: customer.id,
    customer_name: customer.name,
    phone,
    message_type: messageType,
    content,
    status: "dibuka",
  });
  return true;
}

// Broadcast custom: validasi nomor, buka WhatsApp per penerima valid, log per pesan + buat BroadcastLog.
// Tidak mengubah data keuangan. Status = "dibuka" (bukan "terkirim") karena sistem hanya menyiapkan chat.
export async function broadcastWhatsAppCustom(
  recipients,
  template,
  ctxFor,
  messageType = "broadcast",
) {
  const valid = [];
  const invalid = [];
  for (const r of recipients) {
    if (isValidWhatsApp(r.phone)) valid.push(r);
    else invalid.push(r);
  }
  let opened = 0;
  const logs = [];
  for (const r of valid) {
    const ctx = ctxFor ? ctxFor(r) : buildBroadcastContext(r, []);
    const content = personalizeMessage(template, ctx);
    const phone = normalizePhone(r.phone);
    try {
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(content)}`;
      window.open(url, "_blank");
      logs.push(
        localApi.entities.WhatsAppLog.create({
          date: new Date().toISOString(),
          customer_id: r.id,
          customer_name: r.name,
          phone,
          message_type: messageType,
          content,
          status: "dibuka",
        }),
      );
      opened++;
    } catch (e) {
      /* skip */
    }
  }
  await Promise.all(logs);
  const adminName = (await safeMe()) || "Admin";
  await localApi.entities.BroadcastLog.create({
    date: new Date().toISOString(),
    admin: adminName,
    recipient_count: recipients.length,
    valid_count: valid.length,
    invalid_count: invalid.length,
    message: template,
    status: "dibuka",
  });
  return { opened, valid: valid.length, invalid, invalidCount: invalid.length };
}

async function safeMe() {
  try {
    const me = await localApi.auth.me();
    return me?.full_name || me?.email || "";
  } catch {
    return "";
  }
}
