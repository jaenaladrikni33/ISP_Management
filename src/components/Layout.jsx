import React, { useState, useEffect } from "react";
import { Link, useLocation, Outlet, Navigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Wifi,
  FileText,
  Landmark,
  Wallet,
  BarChart3,
  MessageCircle,
  ArrowUpDown,
  Settings as SettingsIcon,
  Menu,
  LogOut,
  PieChart,
  Banknote,
  Coins,
  RotateCcw,
  CalendarRange,
  UserCog,
  PiggyBank,
  Wrench,
  HardHat,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { appBasePath, localApi } from "@/api/localClient";
import {
  effectiveRole,
  canAccess,
  getAccessibleMenus,
  userStatus,
} from "@/lib/roleAccess";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pelanggan", label: "Pelanggan", icon: Users },
  { to: "/paket", label: "Paket Internet", icon: Wifi },
  { to: "/tagihan", label: "Tagihan & Pembayaran", icon: FileText },
  { to: "/rapel", label: "Rapel", icon: RotateCcw },
  { to: "/setoran-cv", label: "Penyetoran CV", icon: Landmark },
  { to: "/pembayaran-cv", label: "Pembayaran/Gaji CV", icon: Banknote },
  { to: "/laporan-cv", label: "Laporan Pembagian CV", icon: PieChart },
  { to: "/keuangan", label: "Keuangan", icon: Wallet },
  { to: "/rekening-saya", label: "Rekening Usaha", icon: PiggyBank },
  { to: "/pendapatan-noncv", label: "Pendapatan Non-CV", icon: Coins },
  { to: "/teknisi", label: "Menu Teknisi", icon: HardHat },
  { to: "/gaji-teknisi", label: "Gaji Teknisi", icon: Wrench },
  { to: "/laporan", label: "Laporan", icon: BarChart3 },
  { to: "/laporan-tahunan", label: "Laporan Tahunan", icon: CalendarRange },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/import-export", label: "Import / Export", icon: ArrowUpDown },
  { to: "/pengaturan", label: "Pengaturan", icon: SettingsIcon },
  { to: "/pengguna", label: "User & Peran", icon: UserCog },
];

export default function Layout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { user, logout, appPublicSettings } = useAuth();
  const [settings, setSettings] = useState(null);
  const branding = appPublicSettings?.public_settings || {};
  const companyName =
    branding.company_name?.trim() ||
    settings?.company_name?.trim() ||
    "ISP_Management";
  const logoSrc = branding.company_logo_file_id
    ? localApi.app.companyLogoUrl(branding.company_logo_file_id)
    : `${appBasePath}favicon.svg`;

  useEffect(() => {
    localApi.entities.AppSetting.list()
      .then((list) => setSettings(list[0] || {}))
      .catch(() => setSettings({}));
  }, []);

  const role = effectiveRole(user, settings || {});
  const isAdmin = role === "admin";
  const ready = settings !== null;
  const navItems = ready
    ? NAV.filter((n) =>
        n.to === "/pengguna" || n.to === "/gaji-teknisi"
          ? isAdmin
          : canAccess(role, n.to, settings),
      )
    : NAV;

  if (ready && user && userStatus(user, settings) === "nonaktif") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h2 className="font-heading text-lg font-bold text-slate-900">
            Akun Dinonaktifkan
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Akun Anda sedang dinonaktifkan oleh admin. Hubungi admin untuk
            mengaktifkan kembali.
          </p>
          <Button className="mt-4 w-full" onClick={() => logout()}>
            Keluar
          </Button>
        </div>
      </div>
    );
  }

  if (ready) {
    const path = location.pathname;
    if ((path === "/pengguna" || path === "/gaji-teknisi") && !isAdmin)
      return <Navigate to="/" replace />;
    if (!canAccess(role, path, settings)) {
      const first = (getAccessibleMenus(role, settings) || ["/"])[0] || "/";
      return <Navigate to={first} replace />;
    }
  }

  const reportPaths = ["/laporan", "/laporan-tahunan"];
  const isActive = (to) =>
    reportPaths.includes(to)
      ? location.pathname === to || location.pathname.startsWith(`${to}/`)
      : to === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(to);

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-100">
        <img
          src={logoSrc}
          alt={companyName}
          className="h-9 w-9 rounded-xl shadow-sm"
        />
        <div className="min-w-0">
          <div className="truncate font-heading text-lg font-bold tracking-tight text-slate-900">
            {companyName}
          </div>
          <div className="text-[11px] text-slate-400 -mt-0.5">
            Billing & ISP Manager
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
            {(user?.full_name || user?.email || "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-slate-700">
              {user?.full_name || "Pengguna"}
            </div>
            <div className="truncate text-[11px] text-slate-400">
              {user?.role || ""}
            </div>
          </div>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-100 bg-white lg:block">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-col lg:pl-64">
        {/* Mobile topbar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-100 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <img
              src={logoSrc}
              alt={companyName}
              className="h-7 w-7 rounded-lg"
            />
            <span className="max-w-[42vw] truncate font-heading font-bold text-slate-900">
              {companyName}
            </span>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        <footer className="border-t border-slate-100 px-4 py-4 text-center text-xs text-slate-400 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} JAENAL. Hak cipta dilindungi.
        </footer>
      </div>
    </div>
  );
}
