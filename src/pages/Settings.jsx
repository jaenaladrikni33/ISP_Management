import React, { useState, useEffect } from "react";
import { appBasePath, localApi } from "@/api/localClient";
import { PageHeader, Loading } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Settings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [settingId, setSettingId] = useState(null);
  const [companyLogoFileId, setCompanyLogoFileId] = useState("");
  const [form, setForm] = useState({
    company_name: "ISP_Management",
    default_cv_percentage: 70,
    default_due_days: 10,
    cv_pusat_pct: 30,
    cv_mitra_pct: 70,
    cv_pph23_pct: 2,
  });

  useEffect(() => {
    (async () => {
      const list = await localApi.entities.AppSetting.list();
      if (list.length > 0) {
        const s = list[0];
        setSettingId(s.id);
        setCompanyLogoFileId(s.company_logo_file_id || "");
        setForm({
          company_name: s.company_name || "ISP_Management",
          default_cv_percentage: s.default_cv_percentage ?? 70,
          default_due_days: s.default_due_days ?? 10,
          cv_pusat_pct: s.cv_pusat_pct ?? 30,
          cv_mitra_pct: s.cv_mitra_pct ?? 70,
          cv_pph23_pct: s.cv_pph23_pct ?? 2,
        });
      }
      setLoading(false);
    })();
  }, []);

  const pusatMit = Number(form.cv_pusat_pct) + Number(form.cv_mitra_pct);
  const valid = pusatMit === 100;

  const save = async () => {
    if (!form.company_name.trim()) {
      toast({
        variant: "destructive",
        title: "Nama perusahaan wajib diisi",
      });
      return;
    }
    if (!valid) {
      toast({
        variant: "destructive",
        title: "Pusat + Mitra harus = 100%",
        description: `Saat ini ${pusatMit}%`,
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        company_name: form.company_name.trim(),
        default_cv_percentage: Number(form.default_cv_percentage),
        default_due_days: Number(form.default_due_days),
        cv_pusat_pct: Number(form.cv_pusat_pct),
        cv_mitra_pct: Number(form.cv_mitra_pct),
        cv_pph23_pct: Number(form.cv_pph23_pct),
      };
      if (settingId)
        await localApi.entities.AppSetting.update(settingId, payload);
      else {
        const created = await localApi.entities.AppSetting.create(payload);
        setSettingId(created.id);
      }
      window.dispatchEvent(new Event("app-branding-updated"));
      toast({ title: "Pengaturan disimpan" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan pengaturan",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const uploadCompanyLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Format logo tidak didukung",
        description: "Pilih gambar JPG, PNG, atau WebP.",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Ukuran logo terlalu besar",
        description: "Ukuran maksimal 5 MB.",
      });
      return;
    }

    setUploadingLogo(true);
    try {
      const result = await localApi.app.uploadCompanyLogo(file);
      setCompanyLogoFileId(result.company_logo_file_id);
      window.dispatchEvent(new Event("app-branding-updated"));
      toast({ title: "Logo berhasil diperbarui" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal mengunggah logo",
        description: error.message,
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) return <Loading />;

  const logoSrc = companyLogoFileId
    ? localApi.app.companyLogoUrl(companyLogoFileId)
    : `${appBasePath}favicon.svg`;

  return (
    <div>
      <PageHeader title="Pengaturan" subtitle="Konfigurasi aplikasi ISP_Management" />
      <div className="max-w-lg rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-slate-400" />
          <h3 className="font-heading font-semibold text-slate-900">Umum</h3>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Nama Aplikasi / Perusahaan</Label>
            <Input
              value={form.company_name}
              onChange={(e) =>
                setForm({ ...form, company_name: e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="company-logo">Logo Aplikasi</Label>
            <div className="mt-2 flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1">
                <img
                  key={companyLogoFileId}
                  src={logoSrc}
                  alt="Pratinjau logo aplikasi"
                  className="h-full w-full object-contain"
                  onError={(event) => {
                    event.currentTarget.src = `${appBasePath}favicon.svg`;
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <Input
                  id="company-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={uploadCompanyLogo}
                  disabled={uploadingLogo}
                />
                <p className="mt-1 text-xs text-slate-500">
                  JPG, PNG, atau WebP. Maksimal 5 MB.
                  {uploadingLogo ? " Mengunggah..." : ""}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Logo tersimpan saat diunggah. Nama akan diterapkan setelah
              pengaturan disimpan.
            </p>
          </div>
          <div>
            <Label>Jatuh Tempo Default (hari)</Label>
            <Input
              type="number"
              value={form.default_due_days}
              onChange={(e) =>
                setForm({ ...form, default_due_days: e.target.value })
              }
            />
          </div>
        </div>
      </div>

      <div className="mt-4 max-w-lg rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="font-heading font-semibold text-slate-900">
          Pengaturan CV — Pembagian Hasil
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Persentase ini hanya untuk Level 2 (Pembagian Hasil CV). Tidak dipakai
          untuk menentukan Nominal Setoran CV pelanggan.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <Label>Pusat (%)</Label>
            <Input
              type="number"
              value={form.cv_pusat_pct}
              onChange={(e) =>
                setForm({ ...form, cv_pusat_pct: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Mitra (%)</Label>
            <Input
              type="number"
              value={form.cv_mitra_pct}
              onChange={(e) =>
                setForm({ ...form, cv_mitra_pct: e.target.value })
              }
            />
          </div>
          <div>
            <Label>PPh 23 (%)</Label>
            <Input
              type="number"
              value={form.cv_pph23_pct}
              onChange={(e) =>
                setForm({ ...form, cv_pph23_pct: e.target.value })
              }
            />
          </div>
        </div>
        <p
          className={`mt-2 text-xs ${valid ? "text-emerald-600" : "text-rose-600"}`}
        >
          Pusat + Mitra = {pusatMit}% {valid ? "✓ valid" : "(harus 100%)"}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Rumus: Keuntungan = Omset - Pajak · Pusat = Keuntungan×
          {form.cv_pusat_pct}% · Mitra = Keuntungan×{form.cv_mitra_pct}% · PPh23
          = Mitra×{form.cv_pph23_pct}% · Bersih Mitra = Mitra - PPh23
        </p>
      </div>

      <div className="mt-4 max-w-lg">
        <Button onClick={save} disabled={saving}>
          <Save className="mr-1.5 h-4 w-4" />{" "}
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>

      <div className="mt-4 max-w-lg rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="font-heading font-semibold text-slate-900">
          Keamanan & Role
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Aplikasi menggunakan login bawaan platform. Role tersedia:
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
          <li>
            <b>Admin</b> — akses seluruh menu dan data, dapat menghapus.
          </li>
          <li>
            <b>Petugas</b> — mengelola pelanggan, tagihan, pembayaran, WhatsApp.
            Tidak menghapus transaksi keuangan (gunakan Void).
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          Kelola pengguna & role melalui menu App Users di dashboard aplikasi
          (luar kode).
        </p>
      </div>
    </div>
  );
}
