import React, { useState, useEffect } from "react";
import { localApi } from "@/api/localClient";
import { getCached, setCached } from "@/lib/entityCache";
import { PageHeader, Loading, EmptyState, Badge } from "@/components/ui-bits";
import { formatCurrency } from "@/lib/billing";
import { Button } from "@/components/ui/button";
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
import { Wifi, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Packages() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    speed: "",
    price: "",
    description: "",
    status: "aktif",
  });

  const load = async () => {
    const cached = getCached("packages");
    if (cached) {
      setItems(cached);
      setLoading(false);
    } else setLoading(true);
    try {
      const data = await localApi.entities.Package.list("-created_date", 200);
      setItems(data);
      setCached("packages", data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({
      name: "",
      speed: "",
      price: "",
      description: "",
      status: "aktif",
    });
    setOpen(true);
  };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      speed: p.speed || "",
      price: p.price,
      description: p.description || "",
      status: p.status,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name || !form.price) {
      toast({ variant: "destructive", title: "Nama dan harga wajib diisi" });
      return;
    }
    const payload = { ...form, price: Number(form.price) };
    if (editing) await localApi.entities.Package.update(editing.id, payload);
    else await localApi.entities.Package.create(payload);
    toast({ title: editing ? "Paket diperbarui" : "Paket ditambahkan" });
    setOpen(false);
    load();
  };

  const remove = async (p) => {
    if (!confirm(`Hapus paket "${p.name}"?`)) return;
    await localApi.entities.Package.delete(p.id);
    toast({ title: "Paket dihapus" });
    load();
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Paket Internet"
        subtitle="Kelola paket dan harga langganan"
      >
        <Button onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Tambah Paket
        </Button>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          title="Belum ada paket"
          description="Tambahkan paket internet pertama Anda."
          icon={Wifi}
        >
          <Button onClick={openNew}>
            <Plus className="mr-1.5 h-4 w-4" /> Tambah Paket
          </Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                    <Wifi
                      className="h-4.5 w-4.5"
                      style={{ width: 18, height: 18 }}
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.speed || "-"}</p>
                  </div>
                </div>
                <Badge
                  className={
                    p.status === "aktif"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }
                >
                  {p.status === "aktif" ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>
              <p className="mt-3 font-heading text-xl font-bold text-slate-900">
                {formatCurrency(p.price)}
              </p>
              <p className="mt-1 text-xs text-slate-500 line-clamp-2 min-h-[2rem]">
                {p.description || "-"}
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => remove(p)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Paket" : "Tambah Paket"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama Paket</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="contoh: Home 10Mbps"
              />
            </div>
            <div>
              <Label>Kecepatan</Label>
              <Input
                value={form.speed}
                onChange={(e) => setForm({ ...form, speed: e.target.value })}
                placeholder="contoh: 10 Mbps"
              />
            </div>
            <div>
              <Label>Harga / Bulan</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="150000"
              />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
              />
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
                  <SelectItem value="nonaktif">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={save}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
