export const MENU_ITEMS = [
  { to: "/", label: "Dashboard" },
  { to: "/pelanggan", label: "Pelanggan" },
  { to: "/paket", label: "Paket Internet" },
  { to: "/tagihan", label: "Tagihan & Pembayaran" },
  { to: "/rapel", label: "Rapel" },
  { to: "/setoran-cv", label: "Penyetoran CV" },
  { to: "/pembayaran-cv", label: "Pembayaran/Gaji CV" },
  { to: "/laporan-cv", label: "Laporan Pembagian CV" },
  { to: "/keuangan", label: "Keuangan" },
  { to: "/rekening-saya", label: "Rekening Usaha" },
  { to: "/pendapatan-noncv", label: "Pendapatan Non-CV" },
  { to: "/laporan", label: "Laporan" },
  { to: "/laporan-tahunan", label: "Laporan Tahunan" },
  { to: "/whatsapp", label: "WhatsApp" },
  { to: "/import-export", label: "Import / Export" },
  { to: "/pengaturan", label: "Pengaturan" },
  { to: "/teknisi", label: "Menu Teknisi" },
];

export const RESTRICTED_ROLES = ["biller", "teknisi"];

export function effectiveRole(user, settings = {}) {
  if (!user) return "user";
  if (user.role === "admin") return "admin";
  const map = settings.user_roles || {};
  return map[user.email] || "user";
}

export function userStatus(user, settings = {}) {
  if (!user || user.role === "admin") return "aktif";
  return (settings.user_status || {})[user.email] || "aktif";
}

export function getAccessibleMenus(role, settings = {}) {
  if (!RESTRICTED_ROLES.includes(role)) return null;
  if (role === "biller") return settings.biller_menus || [];
  const menus = settings.teknisi_menus || [];
  // Menu Teknisi selalu tersedia untuk peran teknisi
  return menus.includes("/teknisi") ? menus : [...menus, "/teknisi"];
}

export function canAccess(role, path, settings = {}) {
  const menus = getAccessibleMenus(role, settings);
  if (menus === null) return true;
  return menus.some((m) => (m === "/" ? path === "/" : path.startsWith(m)));
}
