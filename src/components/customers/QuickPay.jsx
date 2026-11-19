import React, { useState, useEffect } from "react";
import { localApi } from "@/api/localClient";
import {
  formatCurrency,
  periodLabel,
  allocateRapel,
  invoiceRemaining,
  nextPaymentNumber,
  recomputeInvoices,
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

const MODE_TYPE = { bayar: "tagihan", cicil: "cicilan", rapel: "rapel" };
const MODE_TITLE = {
  bayar: "Bayar Tagihan",
  cicil: "Cicilan",
  rapel: "Bayar Rapel (FIFO)",
};

export default function QuickPay({
  open,
  onOpenChange,
  customer,
  mode = "bayar",
  invoice,
  onSaved,
}) {
  const { toast } = useToast();
  const [unpaid, setUnpaid] = useState([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    method: "cash",
    invoice_id: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !customer) return;
    setForm({
      date: new Date().toISOString().slice(0, 10),
      amount: "",
      method: "cash",
      invoice_id: "",
      notes: "",
    });
    (async () => {
      const invs = await localApi.entities.Invoice.filter(
        { customer_id: customer.id },
        "-period",
        200,
      );
      const u = invs
        .filter((i) => i.status !== "lunas" && i.status !== "dibayar_rapel")
        .sort((a, b) => a.period.localeCompare(b.period));
      setUnpaid(u);
      if (mode === "rapel" && u.length) {
        setForm((f) => ({
          ...f,
          amount: String(u.reduce((s, i) => s + invoiceRemaining(i), 0)),
        }));
      } else if (invoice) {
        setForm((f) => ({
          ...f,
          invoice_id: invoice.id,
          amount: mode === "bayar" ? String(invoiceRemaining(invoice)) : "",
        }));
      } else if (u.length) {
        setForm((f) => ({
          ...f,
          invoice_id: u[0].id,
          amount: mode === "bayar" ? String(invoiceRemaining(u[0])) : "",
        }));
      }
    })();
  }, [open, customer, mode, invoice]);

  if (!customer) return null;

  const totalSisa = unpaid.reduce((s, i) => s + invoiceRemaining(i), 0);
  const amount = Number(form.amount || 0);

  const preview = (() => {
    if (amount <= 0) return null;
    if (mode === "rapel") return allocateRapel(amount, unpaid);
    const inv =
      unpaid.find((i) => i.id === form.invoice_id) ||
      (invoice && invoice.id === form.invoice_id ? invoice : null);
    if (!inv) return null;
    const due = invoiceRemaining(inv);
    const alloc = Math.min(amount, due);
    return {
      allocations: [{ invoice_id: inv.id, period: inv.period, amount: alloc }],
      leftover: Math.max(0, amount - due),
    };
  })();

  const save = async () => {
    if (amount <= 0) {
      toast({ variant: "destructive", title: "Nominal harus > 0" });
      return;
    }
    if (mode !== "rapel" && !form.invoice_id) {
      toast({ variant: "destructive", title: "Pilih tagihan" });
      return;
    }
    if (mode === "rapel" && unpaid.length === 0) {
      toast({ variant: "destructive", title: "Tidak ada tunggakan" });
      return;
    }
    if (
      !confirm(
        `Simpan pembayaran ${formatCurrency(amount)} untuk ${customer.name}?`,
      )
    )
      return;
    setSaving(true);
    try {
      // Anti ganda: pastikan tagihan target masih punya sisa
      const fresh = await localApi.entities.Invoice.filter(
        { customer_id: customer.id },
        "-period",
        200,
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
      const txNum = await nextPaymentNumber();
      const allocations = preview?.allocations || [];
      await localApi.entities.Payment.create({
        transaction_number: txNum,
        customer_id: customer.id,
        customer_name: customer.name,
        date: form.date,
        amount,
        method: form.method,
        payment_type: MODE_TYPE[mode] || "tagihan",
        allocations,
        notes: form.notes,
        status: "active",
      });
      await recomputeInvoices(allocations.map((a) => a.invoice_id));
      toast({
        title: "Pembayaran tersimpan",
        description: `${txNum} - ${formatCurrency(amount)}`,
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
            {MODE_TITLE[mode] || "Bayar Tagihan"} — {customer.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="flex justify-between">
              <span className="text-slate-500">ID</span>
              <span className="font-medium">{customer.customer_id || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Sisa</span>
              <span className="font-medium text-amber-600">
                {formatCurrency(totalSisa)}
              </span>
            </div>
          </div>
          {mode !== "rapel" && (
            <div>
              <Label>Pilih Tagihan *</Label>
              <Select
                value={form.invoice_id}
                onValueChange={(v) => {
                  const inv =
                    unpaid.find((i) => i.id === v) ||
                    (invoice && invoice.id === v ? invoice : null);
                  setForm({
                    ...form,
                    invoice_id: v,
                    amount:
                      mode === "bayar" && inv
                        ? String(invoiceRemaining(inv))
                        : form.amount,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih tagihan belum lunas" />
                </SelectTrigger>
                <SelectContent>
                  {(invoice && !unpaid.find((i) => i.id === invoice.id)
                    ? [invoice, ...unpaid]
                    : unpaid
                  ).map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {periodLabel(i.period)} -{" "}
                      {formatCurrency(invoiceRemaining(i))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
              />
            </div>
          </div>
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
          {preview && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-600 mb-2">
                Alokasi (FIFO - periode terlama dahulu):
              </p>
              <div className="space-y-1 text-xs">
                {preview.allocations.map((a) => (
                  <div key={a.invoice_id} className="flex justify-between">
                    <span>{periodLabel(a.period)}</span>
                    <span className="font-medium text-emerald-600">
                      {formatCurrency(a.amount)}
                    </span>
                  </div>
                ))}
                {preview.leftover > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Kelebihan</span>
                    <span>{formatCurrency(preview.leftover)}</span>
                  </div>
                )}
              </div>
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
            {saving ? "Menyimpan..." : "Simpan Pembayaran"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
