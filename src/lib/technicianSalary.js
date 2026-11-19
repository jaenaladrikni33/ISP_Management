import { buildReport } from "@/lib/reportCalc";

// Gaji teknisi = komisi dari laba bersih periode, dibagi rata ke teknisi aktif.
// Peran & status teknisi dibaca dari pengaturan (user_roles / user_status) —
// tidak perlu daftar user, sehingga bisa dipakai juga oleh akun teknisi.
export function calcTechnicianSalary({
  payments = [],
  invoices = [],
  customers = [],
  cvDeposits = [],
  payouts = [],
  incomes = [],
  expenses = [],
  settings = {},
  start,
  end,
  enabled,
  pct,
}) {
  const rep = buildReport(
    {
      payments,
      invoices,
      customers,
      cvDeposits,
      payouts,
      incomes,
      expenses,
      settings,
    },
    start,
    end,
  );
  // Gaji owner tercatat sebagai pengeluaran, padahal itu keuntungan owner — sama dengan Dashboard.
  const gajiExpense = (rep.expByCat || [])
    .filter(([cat]) => /gaji/i.test(cat || ""))
    .reduce((s, [, amt]) => s + Number(amt || 0), 0);
  const labaBersih = rep.saldo + gajiExpense;

  const roleMap = settings.user_roles || {};
  const statusMap = settings.user_status || {};
  const teknisiEmails = Object.keys(roleMap).filter(
    (e) => roleMap[e] === "teknisi",
  );
  const aktifEmails = teknisiEmails.filter(
    (e) => (statusMap[e] || "aktif") === "aktif",
  );

  const isEnabled =
    enabled === undefined
      ? (settings.teknisi_komisi_enabled ?? true)
      : !!enabled;
  const komisiPct =
    Number(pct === undefined ? (settings.teknisi_komisi_pct ?? 10) : pct) || 0;
  const totalKomisi =
    isEnabled && labaBersih > 0
      ? Math.round((labaBersih * komisiPct) / 100)
      : 0;
  const perTeknisi =
    aktifEmails.length > 0 ? Math.round(totalKomisi / aktifEmails.length) : 0;

  return {
    rep,
    labaBersih,
    totalKomisi,
    perTeknisi,
    komisiPct,
    isEnabled,
    teknisiEmails,
    aktifEmails,
  };
}
