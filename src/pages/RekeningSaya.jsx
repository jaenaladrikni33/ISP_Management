import React, { useState, useEffect, useMemo } from "react";
import { localApi } from "@/api/localClient";
import { PageHeader, Loading, StatCard } from "@/components/ui-bits";
import { formatCurrency, currentPeriod } from "@/lib/billing";
import { buildReport } from "@/lib/reportCalc";
import {
  PiggyBank,
  Wallet,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Landmark,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import RekeningMonthTable from "@/components/rekening/RekeningMonthTable";

const monthEnd = (m) => {
  const [y, mm] = m.split("-").map(Number);
  return `${m}-${String(new Date(y, mm, 0).getDate()).padStart(2, "0")}`;
};

// Rekening Usaha: rekonsiliasi uang usaha (bukan pribadi) — saldo usaha + dana CV
// yang sudah masuk tetapi belum disetor, dibandingkan dengan uang riil di rekening.
export default function RekeningSaya() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [settingId, setSettingId] = useState(null);
  const [actual, setActual] = useState(0);
  const [inputVal, setInputVal] = useState("0");
  const { toast } = useToast();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [
          payments,
          invoices,
          customers,
          cvDeposits,
          payouts,
          incomes,
          expenses,
          settings,
        ] = await Promise.all([
          localApi.entities.Payment.filter(
            { status: "active" },
            "-created_date",
            5000,
          ),
          localApi.entities.Invoice.list("-created_date", 5000),
          localApi.entities.Customer.list(),
          localApi.entities.CVDeposit.list("-created_date", 5000),
          localApi.entities.CVPayout.filter({ status: "active" }, "-date", 5000),
          localApi.entities.Income.filter(
            { status: "active" },
            "-created_date",
            5000,
          ),
          localApi.entities.Expense.filter(
            { status: "active" },
            "-created_date",
            5000,
          ),
          localApi.entities.AppSetting.list(),
        ]);
        if (!alive) return;
        setData({
          payments,
          invoices: invoices.filter((i) => i.status !== "void"),
          customers,
          cvDeposits: cvDeposits.filter((c) => c.status !== "void"),
          payouts,
          incomes,
          expenses,
        });
        const st = settings[0];
        if (st) {
          setSettingId(st.id);
          const v = Number(st.rekening_aktual || 0);
          setActual(v);
          setInputVal(String(v));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Rincian per bulan: saldo usaha (masuk − keluar, gaji sudah termasuk keluar)
  // + dana CV yang sudah masuk namun belum disetor ke CV.
  const rows = useMemo(() => {
    if (!data) return [];
    const set = new Set();
    data.payments.forEach((p) => p.date && set.add(String(p.date).slice(0, 7)));
    data.expenses.forEach((e) => e.date && set.add(String(e.date).slice(0, 7)));
    data.incomes.forEach((i) => i.date && set.add(String(i.date).slice(0, 7)));
    data.payouts.forEach((p) => p.date && set.add(String(p.date).slice(0, 7)));
    data.cvDeposits.forEach(
      (c) => c.period && set.add(String(c.period).slice(0, 7)),
    );
    set.add(currentPeriod());

    return [...set]
      .filter((m) => /^\d{4}-\d{2}$/.test(m))
      .sort()
      .reverse()
      .map((m) => {
        const rep = buildReport(data, `${m}-01`, monthEnd(m));
        // Dana CV ditahan: hanya dari tagihan yang sudah LUNAS dan belum disetorkan.
        return {
          month: m,
          masuk: rep.totalPemasukan,
          keluar: rep.totalExpense,
          saldo: rep.saldo,
          cvHeld: rep.cvHeld,
          expected: rep.saldoKas,
        };
      });
  }, [data]);

  const cumulative = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          masuk: a.masuk + r.masuk,
          keluar: a.keluar + r.keluar,
          saldo: a.saldo + r.saldo,
          cvHeld: a.cvHeld + r.cvHeld,
          expected: a.expected + r.expected,
        }),
        { masuk: 0, keluar: 0, saldo: 0, cvHeld: 0, expected: 0 },
      ),
    [rows],
  );

  const selisih = Math.round(actual - cumulative.expected);
  const status = selisih < 0 ? "kurang" : selisih > 0 ? "lebih" : "sesuai";

  const handleSave = async () => {
    const val = Number(inputVal || 0);
    if (Number.isNaN(val)) {
      toast({ title: "Nilai tidak valid", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (settingId) {
        await localApi.entities.AppSetting.update(settingId, {
          rekening_aktual: val,
        });
      } else {
        const created = await localApi.entities.AppSetting.create({
          rekening_aktual: val,
        });
        if (created?.id) setSettingId(created.id);
      }
      setActual(val);
      toast({ title: "Uang riil disimpan" });
    } catch (e) {
      toast({ title: "Gagal menyimpan", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  const color =
    status === "kurang"
      ? "text-rose-600"
      : status === "lebih"
        ? "text-emerald-600"
        : "text-slate-700";
  const StatusIcon =
    status === "kurang"
      ? TrendingDown
      : status === "lebih"
        ? TrendingUp
        : CheckCircle2;
  const sign = status === "kurang" ? "-" : status === "lebih" ? "+" : "";

  return (
    <div>
      <PageHeader
        title="Rekening Usaha"
        subtitle="Rekonsiliasi uang usaha: yang sudah masuk, yang belum dikeluarkan, dan uang riil di rekening"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 p-5 text-white shadow-sm">
          <div className="flex items-center gap-2 text-white/80">
            <PiggyBank className="h-4 w-4" />
            <span className="text-xs font-medium">
              Uang yang Harus Ada di Rekening Usaha
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold">
            {formatCurrency(cumulative.expected)}
          </div>
          <p className="mt-1 text-[11px] text-white/70">
            Saldo usaha {formatCurrency(cumulative.saldo)} + dana CV belum
            disetor {formatCurrency(cumulative.cvHeld)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Wallet className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium">
              Uang Riil di Rekening Usaha (Input Manual)
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              type="number"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="0"
              className="flex-1"
            />
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Masukkan saldo rekening usaha yang sebenarnya saat ini
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-heading text-base font-semibold text-slate-900">
              Hasil Rekonsiliasi
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {status === "sesuai"
                ? "Uang di rekening usaha sesuai dengan yang seharusnya ada."
                : status === "kurang"
                  ? "Uang di rekening usaha lebih kecil dari yang seharusnya ada."
                  : "Uang di rekening usaha lebih besar dari yang seharusnya ada."}
            </p>
          </div>
          <div className="text-right">
            <div
              className={`flex items-center justify-end gap-1.5 text-2xl font-bold ${color}`}
            >
              <StatusIcon className="h-5 w-5" />
              {sign}
              {formatCurrency(Math.abs(selisih))}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400">Selisih</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Masuk"
          value={formatCurrency(cumulative.masuk)}
          icon={TrendingUp}
          tone="emerald"
        />
        <StatCard
          label="Total Keluar"
          value={formatCurrency(cumulative.keluar)}
          icon={TrendingDown}
          tone="rose"
        />
        <StatCard
          label="Saldo Usaha"
          value={formatCurrency(cumulative.saldo)}
          icon={PiggyBank}
          tone="sky"
        />
        <StatCard
          label="CV Belum Disetor"
          value={formatCurrency(cumulative.cvHeld)}
          icon={Landmark}
          tone="amber"
        />
      </div>

      <RekeningMonthTable rows={rows} />
    </div>
  );
}
