import React, { useState } from "react";
import { localApi } from "@/api/localClient";
import { Button } from "@/components/ui/button";
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
import { ImagePlus, Send, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export const REPORT_TYPES = [
  { value: "perbaikan", label: "Perbaikan" },
  { value: "pasang_baru", label: "Pasang Baru" },
  { value: "ganti_alat", label: "Ganti Alat" },
];

export default function TechnicianReportForm({ customers = [], onSubmit }) {
  const { toast } = useToast();
  const today = () => new Date().toISOString().slice(0, 10);
  const [type, setType] = useState("perbaikan");
  const [date, setDate] = useState(today());
  const [customerId, setCustomerId] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    e.target.value = "";
  };

  const clearPhoto = () => {
    setFile(null);
    setPreview("");
  };

  const submit = async () => {
    if (!description.trim()) {
      toast({
        variant: "destructive",
        title: "Keterangan pekerjaan wajib diisi",
      });
      return;
    }
    setBusy(true);
    try {
      let photo_uri = "";
      if (file) {
        const res = await localApi.integrations.Core.UploadPrivateFile({ file });
        photo_uri = res.file_uri;
      }
      const cust = customers.find((c) => c.id === customerId);
      await onSubmit({
        date,
        type,
        customer_id: cust?.id || "",
        customer_name: cust?.name || "",
        description: description.trim(),
        photo_uri,
      });
      setType("perbaikan");
      setDate(today());
      setCustomerId("");
      setDescription("");
      clearPhoto();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Gagal mengirim laporan",
        description: e?.message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="font-heading font-semibold text-slate-900">
        Kirim Laporan Pekerjaan
      </h3>
      <p className="mt-0.5 text-xs text-slate-500">
        Pilih jenis pekerjaan, isi keterangan, dan lampirkan foto bila ada.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {REPORT_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              type === t.value
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Tanggal</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <Label>Pelanggan (opsional)</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih pelanggan" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.customer_id ? ` · ${c.customer_id}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3">
        <Label>Keterangan Pekerjaan</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Contoh: ganti kabel drop core, redaman normal kembali"
        />
      </div>

      <div className="mt-3">
        <Label>Foto</Label>
        {preview ? (
          <div className="mt-1 flex items-center gap-3">
            <img
              src={preview}
              alt="Foto laporan"
              className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
            />
            <Button variant="outline" size="sm" onClick={clearPhoto}>
              <X className="mr-1.5 h-4 w-4" /> Hapus Foto
            </Button>
          </div>
        ) : (
          <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 hover:bg-slate-50">
            <ImagePlus className="h-5 w-5" />
            <span>Pilih / ambil foto</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={pickFile}
            />
          </label>
        )}
      </div>

      <Button className="mt-4 w-full" onClick={submit} disabled={busy}>
        <Send className="mr-1.5 h-4 w-4" />{" "}
        {busy ? "Mengirim..." : "Kirim Laporan"}
      </Button>
    </div>
  );
}
