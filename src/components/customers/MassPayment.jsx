import React, { useState, useEffect } from "react";
import { localApi } from "@/api/localClient";
import {
  formatCurrency,
  periodLabel,
  invoiceRemaining,
  nextPaymentNumber,
  recomputeInvoices,
  allocateRapel,
} from "@/lib/billing";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

// customers: array of selected customer objects
// modePay: "lunas" (bayar semua sisa) | "custom" (nominal per pelanggan)
export default function MassPayment({ open, onOpenChange, customers, onDone }) {
  const { toast } = useToast();
  const [modePay, setModePay] = useState("lunas");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("cash");
  const [amounts, setAmounts] = useState({}); // {customerId: nominal}
  const [rows, setRows] = useState([]); // [{customer, unpaid:[], sisa}]
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (!open || !customers?.length) return;
    setResults(null);
    setAmounts({});
    (async () => {
      const out = [];
      for (const c of customers) {
        const invs = await localApi.entities.Invoice.filter(
          { customer_id: c.id },
          "-period",
          200,
        );
        const unpaid = invs
          .filter((i) => i.status !== "lunas" && i.status !== "dibayar_rapel")
          .sort((a, b) => a.period.localeCompare(b.period));
        const sisa = unpaid.reduce((s, i) => s + invoiceRemaining(i), 0);
        out.push({ customer: c, unpaid, sisa });
      }
      setRows(out);
    })();
  }, [open, customers]);

  const totalLunas = rows.reduce((s, r) => s + r.sisa, 0);
  const totalCustom = rows.reduce(
    (s, r) => s + Number(amounts[r.customer.id] || 0),
    0,
  );
  const total = modePay === "lunas" ? totalLunas : totalCustom;

  const save = async () => {
    if (!rows.length) return;
    if (
      !confirm(
        `Anda akan memproses ${rows.length} pelanggan dengan total pembayaran ${formatCurrency(total)}. Lanjutkan?`,
      )
    )
      return;
    setSaving(true);
    const done = [];
    const failed = [];
    try {
      for (const r of rows) {
        const pay =
          modePay === "lunas" ? r.sisa : Number(amounts[r.customer.id] || 0);
        if (pay <= 0) continue;
        if (r.unpaid.length === 0) {
          failed.push({
            name: r.customer.name,
            reason: "Tidak ada tagihan belum lunas",
          });
          continue;
        }
        try {
          const txNum = await nextPaymentNumber();
          const { allocations } = allocateRapel(pay, r.unpaid);
          await localApi.entities.Payment.create({
            transaction_number: txNum,
            customer_id: r.customer.id,
            customer_name: r.customer.name,
            date,
            amount: pay,
            method,
            payment_type: "rapel",
            allocations,
            status: "active",
          });
          await recomputeInvoices(allocations.map((a) => a.invoice_id));
          done.push(r.customer.name);
        } catch (e) {
          failed.push({ name: r.customer.name, reason: e.message || "Gagal" });
        }
      }
      setResults({ done: done.length, failed });
      onDone?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Pembayaran Massal — {customers?.length || 0} pelanggan
          </DialogTitle>
        </DialogHeader>

        {!results && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tanggal</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Metode</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Tunai</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="qris">QRIS</SelectItem>
                    <SelectItem value="lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mode</Label>
                <Select value={modePay} onValueChange={setModePay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lunas">
                      Bayar Lunas (semua sisa)
                    </SelectItem>
                    <SelectItem value="custom">
                      Nominal masing-masing
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="max-h-64 overflow-auto rounded-lg border border-slate-100">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Pelanggan</th>
                    <th className="px-3 py-2">Periode Tertua</th>
                    <th className="px-3 py-2 text-right">Sisa</th>
                    {modePay === "custom" && (
                      <th className="px-3 py-2 text-right">Nominal</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.customer.id}>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {r.customer.name}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {r.unpaid[0] ? periodLabel(r.unpaid[0].period) : "-"}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-600">
                        {formatCurrency(r.sisa)}
                      </td>
                      {modePay === "custom" && (
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            value={amounts[r.customer.id] || ""}
                            onChange={(e) =>
                              setAmounts({
                                ...amounts,
                                [r.customer.id]: e.target.value,
                              })
                            }
                            className="h-8 w-28 text-right"
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-sm text-slate-600">
                {rows.length} pelanggan dipilih
              </span>
              <span className="font-bold text-slate-900">
                Total: {formatCurrency(total)}
              </span>
            </div>
          </div>
        )}

        {results && (
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-50 p-3 text-emerald-700 text-sm font-medium">
              Pembayaran massal selesai: {results.done} transaksi tersimpan.
            </div>
            {results.failed.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-lg border border-amber-200">
                <table className="w-full text-xs">
                  <thead className="bg-amber-50 text-left text-amber-700">
                    <tr>
                      <th className="px-3 py-2">Pelanggan</th>
                      <th className="px-3 py-2">Alasan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {results.failed.map((f, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{f.name}</td>
                        <td className="px-3 py-2 text-amber-700">{f.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {results ? (
            <Button onClick={() => onOpenChange(false)}>Selesai</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Batal
              </Button>
              <Button onClick={save} disabled={saving || !rows.length}>
                {saving ? "Memproses..." : `Konfirmasi & Simpan`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
