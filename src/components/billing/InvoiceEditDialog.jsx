import React, { useState, useEffect } from "react";
import { localApi } from "@/api/localClient";
import {
  formatCurrency,
  recomputeInvoice,
  invoiceRemaining,
  removeUnsettledCVDeposits,
} from "@/lib/billing";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Trash2 } from "lucide-react";

export default function InvoiceEditDialog({
  open,
  onOpenChange,
  invoice,
  onSaved,
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    amount: "",
    due_date: "",
    package_name: "",
    is_rapel: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && invoice) {
      setForm({
        amount: String(invoice.amount || ""),
        due_date: invoice.due_date || "",
        package_name: invoice.package_name || "",
        is_rapel: !!invoice.is_rapel,
      });
    }
  }, [open, invoice]);

  if (!invoice) return null;

  const save = async () => {
    const amount = Number(form.amount || 0);
    if (amount <= 0) {
      toast({ variant: "destructive", title: "Nominal harus > 0" });
      return;
    }
    setSaving(true);
    try {
      await localApi.entities.Invoice.update(invoice.id, {
        amount,
        due_date: form.due_date || null,
        package_name: form.package_name,
        is_rapel: form.is_rapel,
      });
      await recomputeInvoice(invoice.id);
      toast({ title: "Tagihan diperbarui" });
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast({ variant: "destructive", title: "Gagal", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (
      !confirm(
        `Hapus tagihan ${invoice.invoice_number}? Setoran CV yang belum disetorkan ikut dihapus; yang sudah disetorkan tetap disimpan sebagai histori.`,
      )
    )
      return;
    setSaving(true);
    try {
      try {
        await removeUnsettledCVDeposits(invoice.id);
      } catch {
        /* lanjut hapus tagihan */
      }
      await localApi.entities.Invoice.delete(invoice.id);
      toast({ title: "Tagihan dihapus" });
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast({ variant: "destructive", title: "Gagal", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Tagihan</DialogTitle>
          <DialogDescription>
            {invoice.invoice_number} — {invoice.customer_name} · Sisa{" "}
            {formatCurrency(invoiceRemaining(invoice))}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nominal Tagihan</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <Label>Paket</Label>
            <Input
              value={form.package_name}
              onChange={(e) =>
                setForm({ ...form, package_name: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Jatuh Tempo</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_rapel}
              onChange={(e) => setForm({ ...form, is_rapel: e.target.checked })}
            />{" "}
            Tandai sebagai Rapel
          </label>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button
            variant="destructive"
            size="sm"
            onClick={del}
            disabled={saving}
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Hapus
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
