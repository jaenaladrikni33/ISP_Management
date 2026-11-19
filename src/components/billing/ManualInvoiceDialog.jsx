import React, { useState, useEffect } from "react";
import { localApi } from "@/api/localClient";
import {
  formatCurrency,
  periodLabel,
  currentPeriod,
  nextInvoiceNumber,
} from "@/lib/billing";
import { applyPendingRapel } from "@/lib/rapel";
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

export default function ManualInvoiceDialog({
  open,
  onOpenChange,
  customers,
  onSaved,
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    period: currentPeriod(),
    amount: "",
    due_date: "",
    description: "",
    is_rapel: false,
  });

  useEffect(() => {
    if (open)
      setForm({
        customer_id: "",
        period: currentPeriod(),
        amount: "",
        due_date: "",
        description: "",
        is_rapel: false,
      });
  }, [open]);

  const selected = customers.find((c) => c.id === form.customer_id);

  const onPickCustomer = (id) => {
    const c = customers.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      customer_id: id,
      amount: c && !f.amount ? String(c.monthly_price || "") : f.amount,
    }));
  };

  const save = async () => {
    if (!form.customer_id) {
      toast({ variant: "destructive", title: "Pilih pelanggan" });
      return;
    }
    if (!form.period) {
      toast({ variant: "destructive", title: "Periode wajib" });
      return;
    }
    const amount = Number(form.amount || 0);
    if (amount <= 0) {
      toast({ variant: "destructive", title: "Nominal harus > 0" });
      return;
    }
    const c = customers.find((x) => x.id === form.customer_id);
    // cegah ganda: sudah ada tagihan periode ini untuk pelanggan ini
    const existing = await localApi.entities.Invoice.filter({
      customer_id: c.id,
      period: form.period,
    });
    if (existing.length > 0) {
      toast({
        variant: "destructive",
        title: "Tagihan sudah ada",
        description: `${c.name} sudah memiliki tagihan periode ${periodLabel(form.period)}.`,
      });
      return;
    }
    setSaving(true);
    try {
      const [y, m] = form.period.split("-").map(Number);
      const dueDate =
        form.due_date || new Date(y, m, 10).toISOString().slice(0, 10);
      const invNum = await nextInvoiceNumber();
      const created = await localApi.entities.Invoice.create({
        invoice_number: invNum,
        customer_id: c.id,
        customer_name: c.name,
        customer_phone: c.phone,
        period: form.period,
        package_name: c.package_name,
        amount,
        due_date: dueDate,
        total_paid: 0,
        remaining: amount,
        status: "belum_bayar",
        is_rapel: !!form.is_rapel,
      });
      if (c.uses_cv_deposit && c.cv_deposit_amount > 0) {
        // Setoran CV tidak boleh ganda: bila sudah ada untuk pelanggan + periode ini, cukup ditautkan
        const cvExisting = await localApi.entities.CVDeposit.filter({
          customer_id: c.id,
          period: form.period,
        });
        if (cvExisting.length === 0) {
          await localApi.entities.CVDeposit.create({
            invoice_id: created.id,
            customer_id: c.id,
            customer_name: c.name,
            period: form.period,
            invoice_amount: amount,
            cv_deposit_amount: Number(c.cv_deposit_amount),
            status: "belum_setor",
            deposit_amount: 0,
          });
        } else if (!cvExisting[0].invoice_id) {
          await localApi.entities.CVDeposit.update(cvExisting[0].id, {
            invoice_id: created.id,
          });
        }
      }
      // Rapel untuk Customer ID + Periode ini otomatis dihubungkan ke tagihan (tanpa pembayaran baru)
      let rapel = null;
      try {
        rapel = await applyPendingRapel({
          customerId: c.id,
          period: form.period,
          knownInvoices: [created],
        });
      } catch {
        /* rapel tetap menunggu */
      }
      toast({
        title: "Tagihan manual dibuat",
        description: `${invNum} - ${formatCurrency(amount)}${rapel?.applied ? ` · Rapel ${formatCurrency(rapel.used)} diterapkan` : ""}`,
      });
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Gagal membuat tagihan",
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
          <DialogTitle>Tagihan Manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>Pelanggan *</Label>
            <Select value={form.customer_id} onValueChange={onPickCustomer}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih pelanggan" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.customer_id ? `(${c.customer_id})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <p className="mt-1 text-xs text-slate-500">
                Paket: {selected.package_name || "-"} · Harga:{" "}
                {formatCurrency(selected.monthly_price)}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Periode *</Label>
              <Input
                type="month"
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
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
            <Label>Jatuh Tempo</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_rapel}
              onChange={(e) => setForm({ ...form, is_rapel: e.target.checked })}
              className="h-4 w-4 rounded"
            />
            Tandai sebagai tagihan rapel (pembayaran sebelum tagihan bulan
            depan)
          </label>
          <div>
            <Label>Keterangan</Label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Menyimpan..." : "Buat Tagihan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
