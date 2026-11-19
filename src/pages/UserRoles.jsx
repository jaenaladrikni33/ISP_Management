import React, { useState, useEffect } from "react";
import { localApi } from "@/api/localClient";
import { useAuth } from "@/lib/AuthContext";
import { PageHeader, Loading } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import MenuAccessConfig from "@/components/users/MenuAccessConfig";

const ROLE_OPTS = [
  { value: "user", label: "Petugas (Penuh)" },
  { value: "biller", label: "Biller" },
  { value: "teknisi", label: "Teknisi" },
];
const STATUS_OPTS = [
  { value: "aktif", label: "Aktif" },
  { value: "nonaktif", label: "Nonaktif" },
];

export default function UserRoles() {
  const { toast } = useToast();
  const { user: me } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({});
  const [settingId, setSettingId] = useState(null);
  const [billerMenus, setBillerMenus] = useState([]);
  const [teknisiMenus, setTeknisiMenus] = useState([]);
  const [savingMenus, setSavingMenus] = useState(false);
  const [roles, setRoles] = useState({});
  const [statusMap, setStatusMap] = useState({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [deleteUser, setDeleteUser] = useState(null);

  const load = async () => {
    try {
      const [u, s] = await Promise.all([
        localApi.entities.User.list(),
        localApi.entities.AppSetting.list(),
      ]);
      setUsers(u);
      const st = s[0] || {};
      setSettings(st);
      setSettingId(st.id || null);
      setBillerMenus(st.biller_menus || ["/", "/pelanggan", "/tagihan"]);
      setTeknisiMenus(st.teknisi_menus || ["/", "/pelanggan"]);
      setRoles(st.user_roles || {});
      setStatusMap(st.user_status || {});
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const persist = async (nextRoles, nextStatus, nextBiller, nextTeknisi) => {
    const payload = {
      ...settings,
      user_roles: nextRoles,
      user_status: nextStatus,
      biller_menus: nextBiller,
      teknisi_menus: nextTeknisi,
    };
    try {
      if (settingId)
        await localApi.entities.AppSetting.update(settingId, payload);
      else {
        const c = await localApi.entities.AppSetting.create(payload);
        setSettingId(c.id);
        setSettings({ ...settings, id: c.id });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Gagal simpan",
        description: err.message,
      });
    }
  };

  const changeRole = (email, role) => {
    const next = { ...roles, [email]: role };
    setRoles(next);
    persist(next, statusMap, billerMenus, teknisiMenus);
  };

  const changeStatus = (email, status) => {
    const next = { ...statusMap, [email]: status };
    setStatusMap(next);
    persist(roles, next, billerMenus, teknisiMenus);
  };

  const saveMenus = async () => {
    setSavingMenus(true);
    try {
      await persist(roles, statusMap, billerMenus, teknisiMenus);
      toast({ title: "Akses menu disimpan" });
      load();
    } finally {
      setSavingMenus(false);
    }
  };

  const removeUser = async () => {
    if (!deleteUser) return;
    try {
      await localApi.entities.User.delete(deleteUser.id);
      const nextRoles = { ...roles };
      delete nextRoles[deleteUser.email];
      setRoles(nextRoles);
      const nextStatus = { ...statusMap };
      delete nextStatus[deleteUser.email];
      setStatusMap(nextStatus);
      await persist(nextRoles, nextStatus, billerMenus, teknisiMenus);
      toast({ title: "Pengguna dihapus", description: deleteUser.email });
      setDeleteUser(null);
      load();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Gagal menghapus",
        description: err.message,
      });
    }
  };

  const invite = async () => {
    if (!inviteEmail) {
      toast({ variant: "destructive", title: "Email wajib" });
      return;
    }
    setInviting(true);
    try {
      const invitation = await localApi.users.inviteUser(inviteEmail, "user");
      toast({
        title: "Akun berhasil dibuat",
        description: `${inviteEmail} · Kata sandi sementara: ${invitation.temporary_password}`,
      });
      setInviteEmail("");
      load();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Gagal mengundang",
        description: err.message,
      });
    } finally {
      setInviting(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="User & Peran"
        subtitle="Kelola biller/teknisi, akses menu & status aktif. Login tetap memakai email + kata sandi."
      />

      <div className="mb-4 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">Catatan</p>
        <p className="mt-1 text-xs">
          Biller & Teknisi login dengan email + kata sandi. Ubah peran & status
          langsung di tabel — tersimpan otomatis. Status Nonaktif membuat
          pengguna tidak bisa masuk aplikasi.
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="font-heading font-semibold text-slate-900">
          Undang Pengguna Baru
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Buat akun lokal. Kata sandi sementara akan ditampilkan setelah akun
          berhasil dibuat; berikan kepada pengguna secara aman.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            placeholder="email@contoh.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="sm:flex-1"
          />
          <Button onClick={invite} disabled={inviting}>
            <Plus className="mr-1.5 h-4 w-4" />{" "}
            {inviting ? "Mengundang..." : "Undang"}
          </Button>
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="font-heading font-semibold text-slate-900">
            Daftar Pengguna
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Peran</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isPlatformAdmin = u.role === "admin";
                const appRole = isPlatformAdmin
                  ? "admin"
                  : roles[u.email] || "user";
                const status = isPlatformAdmin
                  ? "aktif"
                  : statusMap[u.email] || "aktif";
                const isSelf = u.email === me?.email;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {u.full_name || "-"}
                      {isSelf && (
                        <span className="ml-1 text-[10px] text-slate-400">
                          (saya)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      {isPlatformAdmin ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <ShieldCheck className="h-4 w-4" /> Admin
                        </span>
                      ) : (
                        <Select
                          value={appRole}
                          onValueChange={(v) => changeRole(u.email, v)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isPlatformAdmin ? (
                        <span className="text-xs font-medium text-emerald-600">
                          Aktif
                        </span>
                      ) : (
                        <Select
                          value={status}
                          onValueChange={(v) => changeStatus(u.email, v)}
                          disabled={isSelf}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isPlatformAdmin || isSelf ? (
                        <span className="text-xs text-slate-300">—</span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteUser(u)}
                          title="Hapus pengguna"
                        >
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="font-heading font-semibold text-slate-900">
          Akses Menu — Biller
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Centang menu yang boleh diakses pengguna biller.
        </p>
        <div className="mt-3">
          <MenuAccessConfig menus={billerMenus} onChange={setBillerMenus} />
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="font-heading font-semibold text-slate-900">
          Akses Menu — Teknisi
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Centang menu yang boleh diakses pengguna teknisi.
        </p>
        <div className="mt-3">
          <MenuAccessConfig menus={teknisiMenus} onChange={setTeknisiMenus} />
        </div>
      </div>

      <div className="sticky bottom-4">
        <Button
          onClick={saveMenus}
          disabled={savingMenus}
          className="w-full sm:w-auto"
        >
          <Save className="mr-1.5 h-4 w-4" />{" "}
          {savingMenus ? "Menyimpan..." : "Simpan Akses Menu"}
        </Button>
      </div>

      <AlertDialog
        open={!!deleteUser}
        onOpenChange={(o) => !o && setDeleteUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengguna?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak bisa dibatalkan. Pengguna {deleteUser?.email}{" "}
              akan dihapus permanen dari aplikasi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeUser}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
