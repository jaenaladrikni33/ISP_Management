import React, { useState, useEffect, useMemo } from "react";
import { localApi } from "@/api/localClient";
import { useAuth } from "@/lib/AuthContext";
import { effectiveRole } from "@/lib/roleAccess";
import { calcTechnicianSalary } from "@/lib/technicianSalary";
import { toYMD } from "@/lib/reportCalc";
import {
  PageHeader,
  StatCard,
  Loading,
  EmptyState,
  Badge,
} from "@/components/ui-bits";
import {
  formatCurrency,
  formatDate,
  currentPeriod,
  periodLabel,
} from "@/lib/billing";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import TechnicianReportForm from "@/components/technician/TechnicianReportForm";
import { Wallet, ClipboardList, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const TYPE_LABEL = {
  perbaikan: "Perbaikan",
  pasang_baru: "Pasang Baru",
  ganti_alat: "Ganti Alat",
};
const TYPE_BADGE = {
  perbaikan: "bg-amber-100 text-amber-700",
  pasang_baru: "bg-emerald-100 text-emerald-700",
  ganti_alat: "bg-sky-100 text-sky-700",
};

// Menu Teknisi: kirim laporan pekerjaan (perbaikan / pasang baru / ganti alat + foto)
// dan lihat total gaji (hanya nominal).
export default function TechnicianReports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({});
  const [customers, setCustomers] = useState([]);
  const [fin, setFin] = useState(null);
  const [reports, setReports] = useState([]);
  const [period, setPeriod] = useState(currentPeriod());

  const role = effectiveRole(user, settings);
  const isAdmin = role === "admin";
  const isTeknisi = role === "teknisi";

  const loadReports = async (admin) => {
    if (!user?.email) return;
    const rows = admin
      ? await localApi.entities.TechnicianReport.list("-date", 200)
      : await localApi.entities.TechnicianReport.filter(
          { technician_email: user.email },
          "-date",
          200,
        );
    setReports(rows);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [st, c, pay, inv, cust, cv, po, inc, exp] = await Promise.all([
          localApi.entities.AppSetting.list(),
          localApi.entities.Customer.list("-created_date", 1000),
          localApi.entities.Payment.filter({ status: "active" }, "-date", 3000),
          localApi.entities.Invoice.list("-period", 3000),
          localApi.entities.Customer.list(),
          localApi.entities.CVDeposit.list("-period", 3000),
          localApi.entities.CVPayout.filter({ status: "active" }, "-date", 1000),
          localApi.entities.Income.filter({ status: "active" }, "-date", 1000),
          localApi.entities.Expense.filter({ status: "active" }, "-date", 1000),
        ]);
        if (!alive) return;
        const cfg = st[0] || {};
        setSettings(cfg);
        setCustomers(c);
        setFin({
          pay,
          inv: inv.filter((i) => i.status !== "void"),
          cust,
          cv: cv.filter((x) => x.status !== "void"),
          po,
          inc,
          exp,
        });
        const admin = effectiveRole(user, cfg) === "admin";
        const rows = admin
          ? await localApi.entities.TechnicianReport.list("-date", 200)
          : await localApi.entities.TechnicianReport.filter(
              { technician_email: user?.email || "" },
              "-date",
              200,
            );
        if (alive) setReports(rows);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.email]);

  const calc = useMemo(() => {
    if (!fin) return { perTeknisi: 0 };
    const [y, m] = period.split("-").map(Number);
    return calcTechnicianSalary({
      payments: fin.pay,
      invoices: fin.inv,
      customers: fin.cust,
      cvDeposits: fin.cv,
      payouts: fin.po,
      incomes: fin.inc,
      expenses: fin.exp,
      settings,
      start: `${period}-01`,
      end: toYMD(new Date(y, m, 0)),
    });
  }, [fin, settings, period]);

  const handleSubmit = async (payload) => {
    await localApi.entities.TechnicianReport.create({
      ...payload,
      technician_email: user?.email || "",
      technician_name: user?.full_name || user?.email || "",
    });
    toast({ title: "Laporan terkirim" });
    loadReports(isAdmin);
  };

  const openPhoto = async (uri) => {
    if (!uri) return;
    const { signed_url } = await localApi.integrations.Core.CreateFileSignedUrl({
      file_uri: uri,
    });
    window.open(signed_url, "_blank");
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Menu Teknisi"
        subtitle="Kirim laporan pekerjaan harian dan lihat total gaji"
      />

      {(isTeknisi || isAdmin) && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <StatCard
            label={isTeknisi ? "Total Gaji Saya" : "Total Gaji per Teknisi"}
            value={formatCurrency(calc.perTeknisi)}
            icon={Wallet}
            tone="indigo"
            sub={periodLabel(period)}
          />
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <Label>Periode Gaji</Label>
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <TechnicianReportForm customers={customers} onSubmit={handleSubmit} />

        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-heading font-semibold text-slate-900">
              {isAdmin ? "Laporan Seluruh Teknisi" : "Laporan Saya"}
            </h3>
            <p className="text-xs text-slate-500">
              {reports.length} laporan terakhir
            </p>
          </div>
          {reports.length === 0 ? (
            <EmptyState
              title="Belum ada laporan"
              description="Laporan yang dikirim akan muncul di sini."
              icon={ClipboardList}
            />
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Tanggal</th>
                    <th className="px-4 py-3 font-medium">Jenis</th>
                    <th className="px-4 py-3 font-medium">Pelanggan</th>
                    <th className="px-4 py-3 font-medium">Keterangan</th>
                    <th className="px-4 py-3 text-right font-medium">Foto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {formatDate(r.date)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            TYPE_BADGE[r.type] || "bg-slate-100 text-slate-600"
                          }
                        >
                          {TYPE_LABEL[r.type] || r.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.customer_name || "-"}
                        {isAdmin && r.technician_name && (
                          <div className="text-[11px] text-slate-400">
                            {r.technician_name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.description || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.photo_uri ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPhoto(r.photo_uri)}
                          >
                            <ImageIcon className="mr-1.5 h-4 w-4" /> Lihat
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
