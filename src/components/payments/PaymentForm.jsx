import React, { useState, useEffect, useMemo } from "react";
import { localApi } from "@/api/localClient";
import {
  formatCurrency,
  periodLabel,
  nextPaymentNumber,
  recomputeInvoices,
  invoiceRemaining,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import CustomerPicker from "@/components/payments/CustomerPicker";

export default function PaymentForm({
  open,
  onOpenChange,
  customers,
  onSaved,
  editing,
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    customer_id: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    method: "cash",
    payment_type: "tagihan",
    invoice_id: "",
    notes: "",
    overpayAction: "credit",
  });
  const [unpaid, setUnpaid] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm({
        customer_id: "",
        date: new Date().toISOString().slice(0, 10),
        amount: "",
        method: "cash",
        payment_type: "tagihan",
        invoice_id: "",
        notes: "",
        overpayAction: "credit",
      });
      setUnpaid([]);
      return;
    }
    if (editing) {
      const allocs = editing.allocations || [];
      setForm({
        customer_id: editing.customer_id,
        date: (editing.date || "").slice(0, 10),
        amount: String(editing.amount || ""),
        method: editing.method || "cash",
        payment_type: editing.payment_type || "tagihan",
        invoice_id: allocs[0]?.invoice_id || "",
        notes: editing.notes || "",
        overpayAction: "credit",
      });
    }
  }, [open, editing]);

  useEffect(() => {
    if (!open || !form.customer_id) {
      setUnpaid([]);
      return;
    }
    (async () => {
      let invs = await localApi.entities.Invoice.filter(
        { customer_id: form.customer_id },
        "-period",
        300,
      );
      if (editing && editing.allocations) {
        const myAlloc = {};
        editing.allocations.forEach(
          (a) =>
            (myAlloc[a.invoice_id] =
              (myAlloc[a.invoice_id] || 0) + Number(a.amount || 0)),
        );
        invs = invs.map((i) => ({
          ...i,
          _free: invoiceRemaining(i) + (myAlloc[i.id] || 0),
        }));
      } else {
        invs = invs.map((i) => ({ ...i, _free: invoiceRemaining(i) }));
      }
      setUnpaid(
        invs
          .filter((i) => i._free > 0)
          .sort((a, b) => a.period.localeCompare(b.period)),
      );
    })();
  }, [open, form.customer_id, editing]);

  const customer = customers.find((c) => c.id === form.customer_id);
  const amount = Number(form.amount || 0);

  const preview = useMemo(() => {
    if (!form.customer_id || amount <= 0) return null;
    const dueOf = (i) => i._free;
    if (form.payment_type === "rapel" || form.payment_type === "pelunasan") {
      const totalDue = unpaid.reduce((s, i) => s + dueOf(i), 0);
      const sorted = [...unpaid].sort((a, b) =>
        a.period.localeCompare(b.period),
      );
      let rem = amount;
      const allocations = [];
      for (const inv of sorted) {
        if (rem <= 0) break;
        const alloc = Math.min(dueOf(inv), rem);
        allocations.push({
          invoice_id: inv.id,
          period: inv.period,
          amount: alloc,
        });
        rem -= alloc;
      }
      return {
        allocations,
        leftover: Math.max(0, rem),
        totalDue,
        overpay: rem > 0,
      };
    }
    if (form.payment_type === "tagihan" || form.payment_type === "cicilan") {
      const inv = unpaid.find((i) => i.id === form.invoice_id);
      if (!inv) return null;
      const due = dueOf(inv);
      const alloc = Math.min(amount, due);
      return {
        allocations: [
          { invoice_id: inv.id, period: inv.period, amount: alloc },
        ],
        leftover: Math.max(0, amount - due),
        totalDue: due,
        overpay: amount > due,
      };
    }
    return { allocations: [], leftover: amount, totalDue: 0, overpay: false };
  }, [form, amount, unpaid]);

  const save = async () => {
    if (!form.customer_id) {
      toast({ variant: "destructive", title: "Pilih pelanggan" });
      return;
    }
    if (amount <= 0) {
      toast({ variant: "destructive", title: "Nominal harus > 0" });
      return;
    }
    if (
      (form.payment_type === "tagihan" || form.payment_type === "cicilan") &&
      !form.invoice_id
    ) {
      toast({ variant: "destructive", title: "Pilih tagihan" });
      return;
    }
    if (
      (form.payment_type === "rapel" || form.payment_type === "pelunasan") &&
      unpaid.length === 0
    ) {
      toast({ variant: "destructive", title: "Tidak ada tagihan belum lunas" });
      return;
    }
    if (
      preview?.overpay &&
      !editing &&
      !confirm(
        `Kelebihan pembayaran ${formatCurrency(preview.leftover)}. Simpan sebagai saldo pelanggan?`,
      )
    )
      return;

    setSaving(true);
    try {
      // Anti ganda: re-check target invoices masih punya sisa
      if (!editing) {
        const fresh = await localApi.entities.Invoice.filter(
          { customer_id: form.customer_id },
          "-period",
          300,
        );
        const freshMap = {};
        fresh.forEach((i) => (freshMap[i.id] = i));
        for (const a of preview?.allocations || []) {
          const inv = freshMap[a.invoice_id];
          if (inv && invoiceRemaining(inv) <= 0) {
            toast({
              variant: "destructive",
              title: "Pembayaran ganda dicegah",
              description: `Tagihan ${periodLabel(inv.period)} sudah lunas.`,
            });
            setSaving(false);
            return;
          }
        }
      }
      const allocations = preview?.allocations || [];
      const affected = new Set(allocations.map((a) => a.invoice_id));
      if (editing)
        (editing.allocations || []).forEach((a) => affected.add(a.invoice_id));
      const payload = {
        customer_id: form.customer_id,
        customer_name: customer?.name || "",
        date: form.date,
        amount,
        method: form.method,
        payment_type: form.payment_type,
        allocations,
        notes: form.notes,
        status: "active",
      };
      if (editing) {
        await localApi.entities.Payment.update(editing.id, payload);
      } else {
        const txNum = await nextPaymentNumber();
        await localApi.entities.Payment.create({
          transaction_number: txNum,
          ...payload,
        });
      }
      await recomputeInvoices([...affected]);
      if (
        !editing &&
        preview?.overpay &&
        preview.leftover > 0 &&
        form.overpayAction === "credit"
      ) {
        const newBalance = (customer?.credit_balance || 0) + preview.leftover;
        await localApi.entities.Customer.update(form.customer_id, {
          credit_balance: newBalance,
        });
      }
      toast({
        title: editing ? "Pembayaran diperbarui" : "Pembayaran tersimpan",
        description: formatCurrency(amount),
      });
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan",
        description: e.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Pembayaran" : "Input Pembayaran"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Pelanggan *</Label>
            <CustomerPicker
              value={form.customer_id}
              onChange={(v) =>
                setForm({ ...form, customer_id: v, invoice_id: "" })
              }
              customers={customers}
              disabled={!!editing}
              placeholder="Ketik nama / no. pelanggan..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Nominal *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="50000"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Metode</Label>
              <Select
                value={form.method}
                onValueChange={(v) => setForm({ ...form, method: v })}
              >
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
              <Label>Jenis Pembayaran</Label>
              <Select
                value={form.payment_type}
                onValueChange={(v) =>
                  setForm({ ...form, payment_type: v, invoice_id: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tagihan">Pembayaran Tagihan</SelectItem>
                  <SelectItem value="cicilan">Cicilan</SelectItem>
                  <SelectItem value="rapel">Pembayaran Rapel</SelectItem>
                  <SelectItem value="pelunasan">Pelunasan Tunggakan</SelectItem>
                  <SelectItem value="lainnya">Pembayaran Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(form.payment_type === "tagihan" ||
            form.payment_type === "cicilan") && (
            <div>
              <Label>Pilih Tagihan *</Label>
              <Select
                value={form.invoice_id}
                onValueChange={(v) => setForm({ ...form, invoice_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih tagihan belum lunas" />
                </SelectTrigger>
                <SelectContent>
                  {unpaid.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {periodLabel(i.period)} - {formatCurrency(i._free)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(form.payment_type === "rapel" ||
            form.payment_type === "pelunasan") &&
            unpaid.length > 0 && (
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-600 mb-2">
                  Alokasi Otomatis (FIFO - periode terlama dahulu):
                </p>
                <div className="space-y-1 text-xs">
                  {unpaid.map((i) => {
                    const a = preview?.allocations.find(
                      (x) => x.invoice_id === i.id,
                    );
                    return (
                      <div key={i.id} className="flex justify-between">
                        <span>{periodLabel(i.period)}</span>
                        <span
                          className={
                            a
                              ? "font-medium text-emerald-600"
                              : "text-slate-400"
                          }
                        >
                          {a ? formatCurrency(a.amount) : "-"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {preview?.overpay && preview.leftover > 0 && !editing && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-800">
                Kelebihan pembayaran: <b>{formatCurrency(preview.leftover)}</b>
              </p>
              <Label className="mt-2 block">Tindakan kelebihan</Label>
              <Select
                value={form.overpayAction}
                onValueChange={(v) => setForm({ ...form, overpayAction: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">
                    Simpan sebagai saldo/kredit pelanggan
                  </SelectItem>
                  <SelectItem value="return">
                    Kembalikan kepada pelanggan
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Catatan</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving
              ? "Menyimpan..."
              : editing
                ? "Simpan Perubahan"
                : "Simpan Pembayaran"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
