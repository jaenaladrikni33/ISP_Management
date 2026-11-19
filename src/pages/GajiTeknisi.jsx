import React, { useState, useEffect, useMemo } from "react";
import { localApi } from "@/api/localClient";
import {
  PageHeader,
  StatCard,
  Loading,
  EmptyState,
  Badge,
} from "@/components/ui-bits";
import { formatCurrency, currentPeriod, periodLabel } from "@/lib/billing";
import { toYMD } from "@/lib/reportCalc";
import { calcTechnicianSalary } from "@/lib/technicianSalary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Wrench, TrendingUp, Percent, Users, Save } from "lucide-react";

export default function GajiTeknisi() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingId, setSettingId] = useState(null);
  const [appSetting, setAppSetting] = useState({});
  const [users, setUsers] = useState([]);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(currentPeriod());
  const [form, setForm] = useState({ enabled: true, pct: 10 });

  useEffect(() => {
    (async () => {
      try {
        const [u, st, pay, inv, cust, cv, po, inc, exp] = await Promise.all([
          localApi.entities.User.list(),
          localApi.entities.AppSetting.list(),
          localApi.entities.Payment.filter({ status: "active" }, "-date", 3000),
          localApi.entities.Invoice.list("-period", 3000),
          localApi.entities.Customer.list(),
          localApi.entities.CVDeposit.list("-period", 3000),
          localApi.entities.CVPayout.filter({ status: "active" }, "-date", 3000),
          localApi.entities.Income.filter({ status: "active" }, "-date", 3000),
          localApi.entities.Expense.filter({ status: "active" }, "-date", 3000),
        ]);
        const s = st[0] || {};
        setAppSetting(s);
        setSettingId(s.id || null);
        setForm({
          enabled: s.teknisi_komisi_enabled ?? true,
          pct: s.teknisi_komisi_pct ?? 10,
        });
        setUsers(u);
        setData({
          pay,
          inv: inv.filter((i) => i.status !== "void"),
          cust,
          cv: cv.filter((x) => x.status !== "void"),
          po,
          inc,
          exp,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const range = useMemo(() => {
    const [y, m] = period.split("-").map(Number);
    return [`${period}-01`, toYMD(new Date(y, m, 0))];
  }, [period]);

  const calc = useMemo(() => {
    if (!data)
      return {
        labaBersih: 0,
        totalKomisi: 0,
        perTeknisi: 0,
        aktifEmails: [],
        teknisiEmails: [],
      };
    return calcTechnicianSalary({
      payments: data.pay,
      invoices: data.inv,
      customers: data.cust,
      cvDeposits: data.cv,
      payouts: data.po,
      incomes: data.inc,
      expenses: data.exp,
      settings: appSetting,
      start: range[0],
      end: range[1],
      enabled: form.enabled,
      pct: form.pct,
    });
  }, [data, range, appSetting, form]);

  const teknisiUsers = useMemo(
    () => users.filter((u) => (calc.teknisiEmails || []).includes(u.email)),
    [users, calc],
  );

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        teknisi_komisi_enabled: !!form.enabled,
        teknisi_komisi_pct: Number(form.pct || 0),
      };
      if (settingId)
        await localApi.entities.AppSetting.update(settingId, payload);
      else {
        const created = await localApi.entities.AppSetting.create(payload);
        setSettingId(created.id);
      }
      setAppSetting((s) => ({ ...s, ...payload }));
      toast({ title: "Pengaturan komisi disimpan" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Gaji Teknisi"
        subtitle="Komisi teknisi dihitung dari laba bersih periode terpilih"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Laba Bersih"
          value={formatCurrency(calc.labaBersih)}
          icon={TrendingUp}
          tone={calc.labaBersih >= 0 ? "emerald" : "red"}
          sub={periodLabel(period)}
        />
        <StatCard
          label="Total Komisi Teknisi"
          value={formatCurrency(calc.totalKomisi)}
          icon={Percent}
          tone="indigo"
          sub={
            form.enabled
              ? `${Number(form.pct || 0)}% dari laba bersih`
              : "Komisi nonaktif"
          }
        />
        <StatCard
          label="Gaji per Teknisi"
          value={formatCurrency(calc.perTeknisi)}
          icon={Wrench}
          tone="sky"
          sub={`Dibagi rata ke ${calc.aktifEmails.length} teknisi aktif`}
        />
        <StatCard
          label="Teknisi Aktif"
          value={calc.aktifEmails.length}
          icon={Users}
          tone="amber"
          sub={`${teknisiUsers.length} teknisi terdaftar`}
        />
      </div>

      <div className="mb-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="font-heading font-semibold text-slate-900">
          Pengaturan Komisi
        </h3>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div className="w-44">
            <Label>Periode</Label>
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>
          <div className="w-32">
            <Label>Komisi (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={form.pct}
              onChange={(e) => setForm({ ...form, pct: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2 pb-1.5">
            <Switch
              checked={!!form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
            <span className="text-sm text-slate-600">
              {form.enabled ? "Komisi aktif" : "Komisi nonaktif"}
            </span>
          </div>
          <Button onClick={save} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" />{" "}
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Rumus: Gaji Teknisi = Laba Bersih × {Number(form.pct || 0)}%{" "}
          {form.enabled ? "" : "(komisi sedang dinonaktifkan)"} · Laba bersih =
          pemasukan − pengeluaran, gaji owner dianggap laba.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="font-heading font-semibold text-slate-900">
            Daftar Teknisi
          </h3>
          <p className="text-xs text-slate-500">
            Periode {periodLabel(period)}
          </p>
        </div>
        {teknisiUsers.length === 0 ? (
          <EmptyState
            title="Belum ada teknisi"
            description="Atur peran teknisi pada menu User & Peran."
            icon={Wrench}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Gaji / Komisi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teknisiUsers.map((u) => {
                  const aktif = calc.aktifEmails.includes(u.email);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {u.full_name || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            aktif
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }
                        >
                          {aktif ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-indigo-600">
                        {aktif ? formatCurrency(calc.perTeknisi) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold text-slate-900">
                <tr>
                  <td className="px-4 py-3" colSpan={3}>
                    Total Gaji Teknisi
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(calc.totalKomisi)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
