import React, { useState, useEffect, useMemo } from "react";
import { localApi } from "@/api/localClient";
import { invalidateAll } from "@/lib/entityCache";
import { StatCard, Loading, EmptyState } from "@/components/ui-bits";
import { InfoIcon } from "@/components/InfoIcon";
import { formatCurrency, periodLabel } from "@/lib/billing";
import { applyPendingRapel, voidRapel, deleteRapel } from "@/lib/rapel";
import { buildRapelRows } from "@/lib/rapelRows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  Search,
  RotateCcw,
  Hourglass,
  CheckCheck,
  Wallet,
} from "lucide-react";
import RapelList from "@/components/rapel/RapelList";
import RapelPrepayDialog from "@/components/billing/RapelPrepayDialog";

const sumBy = (rows) => rows.reduce((s, r) => s + r.amount, 0);
const itemsOf = (rows) =>
  rows.map((r) => ({
    label: r.customer_name,
    sub: `${r.customer_code || "-"} · ${r.periodText} · ${r.rapelId}`,
    value: formatCurrency(r.amount),
  }));

// Menu Rapel: pembayaran di muka untuk periode tagihan masa depan (bukan cicilan).
export default function RapelPanel({ onChanged }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pays, setPays] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    const [p, c, i] = await Promise.all([
      localApi.entities.Payment.filter({ payment_type: "rapel" }, "-date", 1000),
      localApi.entities.Customer.list("-created_date", 3000),
      localApi.entities.Invoice.list("-period", 3000),
    ]);
    setPays(p);
    setCustomers(c);
    setInvoices(i.filter((x) => x.status !== "void"));
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const afterChange = async () => {
    invalidateAll();
    await load();
    onChanged?.();
  };

  const allRows = useMemo(
    () => buildRapelRows(pays, customers, invoices),
    [pays, customers, invoices],
  );
  const periods = useMemo(
    () =>
      [...new Set(allRows.map((r) => r.periodKey).filter(Boolean))]
        .sort()
        .reverse(),
    [allRows],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (stateFilter === "all" ? r.state === "void" : r.state !== stateFilter)
        return false;
      if (periodFilter !== "all" && r.periodKey !== periodFilter) return false;
      if (!q) return true;
      return [r.customer_name, r.customer_code, r.rapelId, r.periodText].some(
        (v) => (v || "").toLowerCase().includes(q),
      );
    });
  }, [allRows, search, stateFilter, periodFilter]);

  const waiting = allRows.filter((r) => r.state === "menunggu");
  const applied = allRows.filter((r) => r.state === "teraplikasi");
  const active = [...waiting, ...applied];

  const run = async (row, fn, okTitle) => {
    setBusyId(row.id);
    try {
      await fn();
      toast({ title: okTitle });
      await afterChange();
    } catch (e) {
      toast({ variant: "destructive", title: "Gagal", description: e.message });
    } finally {
      setBusyId("");
    }
  };

  const onApply = (row) =>
    run(
      row,
      async () => {
        const res = await applyPendingRapel({
          customerId: row.p.customer_id,
          period: row.periodKey,
        });
        if (!res.applied) throw new Error("Tagihan tujuan belum tersedia.");
      },
      "Rapel diterapkan ke tagihan",
    );

  const onVoid = (row) => {
    const extra =
      row.state === "teraplikasi"
        ? ` Tagihan ${row.invoiceText} akan dihitung ulang.`
        : "";
    if (
      confirm(
        `Batalkan (void) rapel ${row.rapelId} ${formatCurrency(row.amount)}?${extra}`,
      )
    )
      run(row, () => voidRapel(row.p), "Rapel dibatalkan");
  };

  const onDelete = (row) => {
    const extra =
      row.state === "teraplikasi"
        ? ` Tagihan ${row.invoiceText} akan dihitung ulang.`
        : "";
    if (
      confirm(
        `Hapus rapel ${row.rapelId} ${formatCurrency(row.amount)} secara permanen?${extra}`,
      )
    )
      run(row, () => deleteRapel(row.p), "Rapel dihapus");
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
        Alur rapel: <b>Input Rapel</b> → <b>Menunggu Tagihan</b> → tagihan
        periode dibuat → <b>otomatis diterapkan</b> (cocok Customer ID +
        Periode) → status tagihan diperbarui. Rapel adalah pembayaran di muka,
        bukan cicilan.
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Menunggu Tagihan"
          value={formatCurrency(sumBy(waiting))}
          icon={Hourglass}
          tone="amber"
          sub={`${waiting.length} rapel`}
          info={
            <InfoIcon
              title="Rapel Menunggu Tagihan"
              value={formatCurrency(sumBy(waiting))}
              source="Transaksi Rapel (pembayaran di muka) yang tagihan periodenya belum dibuat"
              formula="Jumlah nominal semua rapel berstatus MENUNGGU TAGIHAN"
              items={itemsOf(waiting)}
            />
          }
        />
        <StatCard
          label="Teraplikasi"
          value={formatCurrency(sumBy(applied))}
          icon={CheckCheck}
          tone="emerald"
          sub={`${applied.length} rapel`}
          info={
            <InfoIcon
              title="Rapel Teraplikasi"
              value={formatCurrency(sumBy(applied))}
              source="Transaksi Rapel yang sudah dihubungkan ke tagihan"
              formula="Jumlah nominal semua rapel berstatus TERAPLIKASI (nominal yang diterima, termasuk kelebihan yang masuk saldo)"
              items={itemsOf(applied)}
            />
          }
        />
        <StatCard
          label="Total Rapel Aktif"
          value={formatCurrency(sumBy(active))}
          icon={Wallet}
          tone="indigo"
          sub={`${active.length} rapel`}
          info={
            <InfoIcon
              title="Total Rapel Aktif"
              value={formatCurrency(sumBy(active))}
              source="Semua transaksi Rapel yang tidak dibatalkan"
              formula={`Menunggu ${formatCurrency(sumBy(waiting))} + Teraplikasi ${formatCurrency(sumBy(applied))}`}
              items={itemsOf(active)}
            />
          }
        />
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pelanggan, Customer ID, ID rapel..."
            className="pl-9"
          />
        </div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua (aktif)</SelectItem>
            <SelectItem value="menunggu">Menunggu Tagihan</SelectItem>
            <SelectItem value="teraplikasi">Teraplikasi</SelectItem>
            <SelectItem value="void">Dibatalkan</SelectItem>
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Periode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Periode</SelectItem>
            {periods.map((p) => (
              <SelectItem key={p} value={p}>
                {periodLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Input Rapel
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Belum ada rapel"
          description="Klik Input Rapel untuk mencatat pembayaran di muka periode tagihan berikutnya."
          icon={RotateCcw}
        />
      ) : (
        <RapelList
          rows={rows}
          busyId={busyId}
          onApply={onApply}
          onVoid={onVoid}
          onDelete={onDelete}
        />
      )}

      <RapelPrepayDialog
        open={open}
        onOpenChange={setOpen}
        customers={customers}
        onSaved={afterChange}
      />
    </div>
  );
}
