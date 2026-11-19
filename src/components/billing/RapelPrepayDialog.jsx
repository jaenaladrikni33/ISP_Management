import React, { useState, useEffect } from "react";
import { localApi } from "@/api/localClient";
import {
  formatCurrency,
  periodLabel,
  currentPeriod,
  addMonths,
  invoiceRemaining,
} from "@/lib/billing";
import { createRapel, planRapelUse } from "@/lib/rapel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Info, CheckCircle2 } from "lucide-react";

const today = () => new Date().toLocaleDateString("en-CA");
const emptyForm = () => ({
  customer_id: "",
  period: addMonths(currentPeriod(), 1),
  amount: "",
  date: today(),
  method: "cash",
  notes: "",
});
// Periode masa depan boleh dipilih walau tagihannya belum dibuat (1 bulan lalu s/d 12 bulan ke depan)
const periodOptions = () =>
  Array.from({ length: 14 }, (_, i) => addMonths(currentPeriod(), i - 1));

export default function RapelPrepayDialog({
  open,
  onOpenChange,
  customers,
  onSaved,
}) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm());
  const [existing, setExisting] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setExisting(null);
    }
  }, [open]);

  // Cek apakah tagihan Customer ID + Periode ini sudah ada
  useEffect(() => {
    if (!open || !form.customer_id || !form.period) {
      setExisting(null);
      return;
    }
    let cancelled = false;
    localApi.entities.Invoice.filter({
      customer_id: form.customer_id,
      period: form.period,
    })
      .then((res) => {
        if (!cancelled) setExisting(res?.[0] || null);
      })
      .catch(() => {
        if (!cancelled) setExisting(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, form.customer_id, form.period]);

  const customer = customers.find((c) => c.id === form.customer_id);
  const amount = Number(form.amount || 0);
  const price = existing
    ? Number(existing.amount || 0)
    : Number(customer?.monthly_price || 0);
  const sim =
    price > 0 && amount > 0
      ? planRapelUse(
          amount,
          price,
          existing ? Number(existing.total_paid || 0) : 0,
        )
      : null;
  const sisa = sim
    ? Math.max(
        0,
        price - (existing ? Number(existing.total_paid || 0) : 0) - sim.used,
      )
    : 0;

  const save = async () => {
    if (!customer) {
      toast({ variant: "destructive", title: "Pilih pelanggan dari daftar" });
      return;
    }
    if (!form.period) {
      toast({ variant: "destructive", title: "Pilih periode tujuan" });
      return;
    }
    if (amount <= 0) {
      toast({
        variant: "destructive",
        title: "Nominal rapel harus lebih dari 0",
      });
      return;
    }
    if (!form.date) {
      toast({
        variant: "destructive",
        title: "Tanggal pembayaran wajib diisi",
      });
      return;
    }
    setSaving(true);
    try {
      const { applied } = await createRapel({
        customer,
        period: form.period,
        amount,
        date: form.date,
        method: form.method,
        notes: form.notes,
      });
      toast({
        title: "Rapel tersimpan",
        description: applied
          ? `${customer.name} · ${periodLabel(form.period)} · diterapkan ke tagihan ${applied.invoice_number} (${formatCurrency(applied.used)})`
          : `${customer.name} · ${periodLabel(form.period)} · ${formatCurrency(amount)} · MENUNGGU TAGIHAN`,
      });
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan rapel",
        description: e.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Input Rapel</DialogTitle>
          <DialogDescription>
            Pembayaran di muka untuk periode tagihan masa depan. Rapel bukan
            cicilan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Cari Pelanggan *</Label>
            <CustomerPicker
              value={form.customer_id}
              onChange={(id) => setForm({ ...form, customer_id: id })}
              customers={customers}
              placeholder="Ketik nama / Customer ID..."
            />
          </div>
          <div>
            <Label>Customer ID</Label>
            <Input
              readOnly
              value={customer?.customer_id || ""}
              placeholder="Terisi otomatis setelah pelanggan dipilih"
              className="bg-slate-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Periode Tujuan *</Label>
              <Select
                value={form.period}
                onValueChange={(v) => setForm({ ...form, period: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions().map((p) => (
                    <SelectItem key={p} value={p}>
                      {periodLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nominal Rapel *</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="150000"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tanggal Pembayaran *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
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
          </div>
          <div>
            <Label>Keterangan</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Opsional"
            />
          </div>

          {customer && (
            <div className="space-y-1.5 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
              <p className="flex items-start gap-1.5">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {existing ? (
                  <span>
                    Tagihan {periodLabel(form.period)} sudah ada (
                    {existing.invoice_number}, sisa{" "}
                    {formatCurrency(invoiceRemaining(existing))}). Rapel
                    langsung diterapkan ke tagihan tersebut.
                  </span>
                ) : (
                  <span>
                    Tagihan {periodLabel(form.period)} belum dibuat. Rapel
                    disimpan dengan status <b>MENUNGGU TAGIHAN</b> dan otomatis
                    diterapkan saat tagihan dibuat.
                  </span>
                )}
              </p>
              {sim && (
                <p className="flex items-start gap-1.5">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Perkiraan: tagihan {formatCurrency(price)} − rapel{" "}
                    {formatCurrency(sim.used)} = sisa {formatCurrency(sisa)}
                    {sisa === 0 ? " (LUNAS)" : " (BELUM LUNAS)"}
                    {sim.surplus > 0
                      ? `. Kelebihan ${formatCurrency(sim.surplus)} masuk saldo pelanggan.`
                      : "."}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Menyimpan..." : "SIMPAN RAPEL"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
