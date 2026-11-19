import React from "react";
import { Link } from "react-router-dom";
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  PieChart,
  PiggyBank,
  Banknote,
} from "lucide-react";
import { StatCard } from "@/components/ui-bits";
import { InfoIcon } from "@/components/InfoIcon";
import {
  formatCurrency as rp,
  periodLabel,
  currentPeriod,
} from "@/lib/billing";
import { itemsSetoran, itemsTax, itemsSource } from "@/lib/reportItems";

const cardLink = "block transition-transform hover:-translate-y-0.5";
const SRC = "Setoran CV berstatus Disetorkan pada periode berjalan";

// Kotak CV di Dashboard — setiap nominal punya ⓘ (klik untuk sumber & rumus).
export default function DashboardCVCards({
  stats,
  settings,
  rangeText,
  periodText,
}) {
  const d = stats.division;
  const period = periodText || periodLabel(currentPeriod());
  const info = (title, amount, formula, extra = {}) => (
    <InfoIcon
      title={title}
      value={rp(amount)}
      period={period}
      source={SRC}
      formula={formula}
      {...extra}
    />
  );
  const card = (to, label, amount, icon, tone, infoNode) => (
    <Link to={to} className={cardLink}>
      <StatCard
        label={label}
        value={rp(amount)}
        icon={icon}
        tone={tone}
        info={infoNode}
      />
    </Link>
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {card(
        "/laporan-cv",
        "Uang Terkumpul CV",
        stats.danaCVTotal,
        Landmark,
        "indigo",
        info(
          "Uang Terkumpul CV",
          stats.danaCVTotal,
          "Per tagihan: pembayaran diterima, maksimal sebesar nominal Setoran CV. Hanya dari tagihan yang SUDAH LUNAS (cicilan belum dihitung). Hanya informasi — tidak menentukan status setoran.",
          {
            source:
              "Pembayaran pelanggan pada tagihan periode berjalan yang sudah lunas",
          },
        ),
      )}
      {card(
        "/laporan-cv",
        "Omset CV",
        d.omset,
        TrendingUp,
        "sky",
        info(
          "Omset CV",
          d.omset,
          "Jumlah nominal Setoran CV yang sudah berstatus Disetorkan",
          { items: itemsSetoran(stats.cvRowsDeposited) },
        ),
      )}
      {card(
        "/laporan-cv",
        "Pajak CV",
        d.pajak,
        TrendingDown,
        "rose",
        info(
          "Pajak CV",
          d.pajak,
          "Per pelanggan: PPN 11% + BHP USO 4% dari harga sebelum pajak (nominal ÷ 1,15)",
          {
            items: itemsTax(stats.cvRowsDeposited),
            note: "Pajak dihitung otomatis dari Setoran CV, bukan transaksi pajak terpisah.",
          },
        ),
      )}
      {card(
        "/laporan-cv",
        "Keuntungan",
        d.keuntungan,
        TrendingUp,
        "emerald",
        info(
          "Keuntungan",
          d.keuntungan,
          `Omset ${rp(d.omset)} − Pajak ${rp(d.pajak)} = ${rp(d.keuntungan)}`,
        ),
      )}
      {card(
        "/laporan-cv",
        `Pusat (${settings.cv_pusat_pct}%)`,
        d.pusat,
        PieChart,
        "sky",
        info(
          "Bagian Pusat",
          d.pusat,
          `Keuntungan ${rp(d.keuntungan)} × ${settings.cv_pusat_pct}% = ${rp(d.pusat)}`,
        ),
      )}
      {card(
        "/laporan-cv",
        `Mitra (${settings.cv_mitra_pct}%)`,
        d.mitra,
        PieChart,
        "indigo",
        info(
          "Bagian Mitra",
          d.mitra,
          `Keuntungan ${rp(d.keuntungan)} × ${settings.cv_mitra_pct}% = ${rp(d.mitra)}`,
        ),
      )}
      {card(
        "/laporan-cv",
        `PPh 23 (${settings.cv_pph23_pct}%)`,
        d.pph23,
        TrendingDown,
        "amber",
        info(
          "PPh 23",
          d.pph23,
          `Bagian Mitra ${rp(d.mitra)} × ${settings.cv_pph23_pct}% = ${rp(d.pph23)}`,
        ),
      )}
      {card(
        "/laporan-cv",
        "Bersih Mitra",
        d.bersihMitra,
        PiggyBank,
        "emerald",
        info(
          "Bersih Mitra",
          d.bersihMitra,
          `Mitra ${rp(d.mitra)} − PPh 23 ${rp(d.pph23)} = ${rp(d.bersihMitra)}`,
        ),
      )}
      {card(
        "/pembayaran-cv",
        "Pembayaran/Gaji CV",
        stats.totalPayoutCV,
        Banknote,
        "rose",
        info(
          "Pembayaran/Gaji CV",
          stats.totalPayoutCV,
          "Jumlah transaksi Gaji/Pembayaran CV pada periode dashboard",
          {
            period: rangeText,
            source: "Menu Pembayaran/Gaji CV",
            items: itemsSource(stats.rep.payoutRows),
          },
        ),
      )}
      {card(
        "/setoran-cv",
        "Total Setoran CV",
        stats.totalSetoranCV,
        Landmark,
        "indigo",
        info(
          "Total Setoran CV",
          stats.totalSetoranCV,
          "Jumlah nominal Setoran CV periode berjalan (tidak bergantung status lunas pelanggan)",
          { source: "Data Setoran CV", items: itemsSetoran(stats.cvRowsAll) },
        ),
      )}
      {card(
        "/setoran-cv",
        "Sudah Setor CV",
        stats.totalSetorCV,
        Landmark,
        "emerald",
        info(
          "Sudah Setor CV",
          stats.totalSetorCV,
          "Jumlah nominal yang tercatat sudah disetorkan pada data Setoran CV",
          {
            source: "Status pada data Setoran CV",
            items: itemsSetoran(
              stats.cvRowsAll.filter((r) => r.disetor > 0),
              "disetor",
            ),
          },
        ),
      )}
      {card(
        "/setoran-cv",
        "Dana CV Belum Disetor",
        stats.cvHeld,
        Landmark,
        "amber",
        info(
          "Dana CV Belum Disetor",
          stats.cvHeld,
          "Bagian CV dari tagihan yang sudah LUNAS tetapi belum disetorkan ke CV. Uang ini masih di tangan dan sudah masuk Saldo Kas.",
          {
            source: "Tagihan lunas − Setoran CV yang sudah disetor",
            items: itemsSetoran(stats.rep.cvHeldRows, "held"),
          },
        ),
      )}
    </div>
  );
}
