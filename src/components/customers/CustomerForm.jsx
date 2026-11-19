import React, { useState, useEffect } from "react";
import { localApi } from "@/api/localClient";
import { normalizePhone, formatCurrency } from "@/lib/billing";
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
import { Contact, MessageCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

function computeIsolirDate(installDate) {
  if (!installDate) return "";
  const d = new Date(installDate);
  if (isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export default function CustomerForm({
  open,
  onOpenChange,
  editing,
  packages,
  onSaved,
}) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  function emptyForm() {
    return {
      customer_id: "",
      name: "",
      phone: "",
      address: "",
      area: "",
      package_id: "",
      package_name: "",
      monthly_price: "",
      install_date: "",
      status: "aktif",
      uses_cv_deposit: false,
      cv_deposit_amount: "",
      cv_status: "belum_setor",
      is_prepaid: false,
      isolir_date: "",
      notes: "",
    };
  }

  useEffect(() => {
    if (editing) {
      setForm({
        customer_id: editing.customer_id || "",
        name: editing.name || "",
        phone: editing.phone || "",
        address: editing.address || "",
        area: editing.area || "",
        package_id: editing.package_id || "",
        package_name: editing.package_name || "",
        monthly_price: editing.monthly_price || "",
        install_date: editing.install_date || "",
        status: editing.status || "aktif",
        uses_cv_deposit: editing.uses_cv_deposit || false,
        cv_deposit_amount: editing.cv_deposit_amount || "",
        cv_status: editing.cv_status || "belum_setor",
        is_prepaid: editing.is_prepaid || false,
        isolir_date: editing.isolir_date || "",
        notes: editing.notes || "",
      });
    } else {
      setForm(emptyForm());
    }
  }, [editing, open]);

  const onPackageChange = (pkgId) => {
    const pkg = packages.find((p) => p.id === pkgId);
    setForm((f) => ({
      ...f,
      package_id: pkgId,
      package_name: pkg?.name || "",
      monthly_price: pkg?.price || f.monthly_price,
    }));
  };

  const pickContact = async () => {
    if (!("contacts" in navigator && "select" in navigator.contacts)) {
      toast({
        title:
          "Akses kontak tidak didukung di perangkat/browser ini. Silakan isi manual.",
      });
      return;
    }
    try {
      const contacts = await navigator.contacts.select(["name", "tel"], {
        multiple: false,
      });
      if (contacts && contacts.length) {
        const c = contacts[0];
        const tel = (c.tel && c.tel[0]) || "";
        setForm((f) => ({
          ...f,
          phone: tel,
          name: f.name || (c.name && c.name[0]) || "",
        }));
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Gagal mengakses kontak" });
    }
  };

  const openWA = () => {
    const n = normalizePhone(form.phone);
    if (!n) return;
    window.open(`https://wa.me/${n}`, "_blank");
  };

  const save = async () => {
    if (!form.name || !form.phone) {
      toast({ variant: "destructive", title: "Nama dan nomor HP wajib diisi" });
      return;
    }
    if (form.uses_cv_deposit && !(Number(form.cv_deposit_amount) > 0)) {
      toast({
        variant: "destructive",
        title: "Nominal Setoran CV wajib diisi jika Menggunakan CV",
      });
      return;
    }
    setSaving(true);
    try {
      const phone = normalizePhone(form.phone);
      // cek duplikat ID / nomor WhatsApp
      const all = await localApi.entities.Customer.list();
      const dupId =
        form.customer_id &&
        all.find(
          (c) => c.customer_id === form.customer_id && c.id !== editing?.id,
        );
      const dupPhone = all.find(
        (c) => c.phone === phone && c.id !== editing?.id,
      );
      if (dupId) {
        toast({
          variant: "destructive",
          title: "ID Pelanggan sudah digunakan",
          description: `Terpakai oleh ${dupId.name}`,
        });
        return;
      }
      if (dupPhone) {
        toast({
          variant: "destructive",
          title: "No. WhatsApp sudah digunakan",
          description: `Terpakai oleh ${dupPhone.name}`,
        });
        return;
      }

      const payload = {
        ...form,
        phone,
        monthly_price: Number(form.monthly_price || 0),
        cv_deposit_amount: Number(form.cv_deposit_amount || 0),
        install_date:
          form.install_date || new Date().toISOString().slice(0, 10),
        is_prepaid: !!form.is_prepaid,
        isolir_date:
          form.isolir_date ||
          computeIsolirDate(
            form.install_date || new Date().toISOString().slice(0, 10),
          ),
      };
      // auto customer_id
      if (!payload.customer_id) {
        payload.customer_id = `CUST-${String(all.length + 1).padStart(4, "0")}`;
      }
      if (editing) await localApi.entities.Customer.update(editing.id, payload);
      else await localApi.entities.Customer.create(payload);
      toast({
        title: editing ? "Pelanggan diperbarui" : "Pelanggan ditambahkan",
      });
      onOpenChange(false);
      onSaved();
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
            {editing ? "Edit Pelanggan" : "Tambah Pelanggan"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>ID Pelanggan</Label>
              <Input
                value={form.customer_id}
                onChange={(e) =>
                  setForm({ ...form, customer_id: e.target.value })
                }
                placeholder="otomatis"
              />
            </div>
            <div>
              <Label>Nama Pelanggan *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Nomor HP / WhatsApp *</Label>
            <div className="flex gap-2">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="08123456789"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={pickContact}
                title="Pilih dari Kontak"
              >
                <Contact className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={openWA}
                title="Buka WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Otomatis dinormalisasi ke format 62xxxx
            </p>
          </div>
          <div>
            <Label>Alamat</Label>
            <Textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Area</Label>
              <Input
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
              />
            </div>
            <div>
              <Label>Tanggal Pemasangan</Label>
              <Input
                type="date"
                value={form.install_date}
                onChange={(e) =>
                  setForm({
                    ...form,
                    install_date: e.target.value,
                    isolir_date: computeIsolirDate(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sistem Pembayaran</Label>
              <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_prepaid}
                  onChange={(e) =>
                    setForm({ ...form, is_prepaid: e.target.checked })
                  }
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm font-medium text-slate-700">
                  Prabayar (bayar di awal)
                </span>
              </label>
            </div>
            <div>
              <Label>Tanggal Isolir Otomatis</Label>
              <Input
                type="date"
                value={form.isolir_date}
                onChange={(e) =>
                  setForm({ ...form, isolir_date: e.target.value })
                }
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Terisi otomatis = tgl pasang + 1 bulan, berulang tiap bulan.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Paket Internet</Label>
              <Select value={form.package_id} onValueChange={onPackageChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih paket" />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} - {formatCurrency(p.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Harga Tagihan / Bulan</Label>
              <Input
                type="number"
                value={form.monthly_price}
                onChange={(e) =>
                  setForm({ ...form, monthly_price: e.target.value })
                }
                placeholder="dapat diubah per pelanggan"
              />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aktif">Aktif</SelectItem>
                <SelectItem value="tidak_aktif">Tidak Aktif</SelectItem>
                <SelectItem value="isolir">Isolir</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.uses_cv_deposit}
                onChange={(e) =>
                  setForm({ ...form, uses_cv_deposit: e.target.checked })
                }
                className="h-4 w-4 rounded"
              />
              <span className="text-sm font-medium text-slate-700">
                Menggunakan Setoran CV?
              </span>
            </label>
            {form.uses_cv_deposit && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <Label>Nominal Setoran CV *</Label>
                  <Input
                    type="number"
                    value={form.cv_deposit_amount}
                    onChange={(e) =>
                      setForm({ ...form, cv_deposit_amount: e.target.value })
                    }
                    placeholder="contoh: 111000"
                  />
                </div>
                <div>
                  <Label>Status Setoran CV</Label>
                  <Select
                    value={form.cv_status}
                    onValueChange={(v) => setForm({ ...form, cv_status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="belum_setor">Belum Setor</SelectItem>
                      <SelectItem value="sudah_setor">Sudah Setor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="col-span-2 text-[11px] text-slate-500">
                  Nominal setoran bebas dan berbeda per pelanggan. Bukan
                  persentase. Dana CV dihitung dari pembayaran aktual.
                </p>
              </div>
            )}
          </div>

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
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
