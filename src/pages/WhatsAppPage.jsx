import React, { useState, useEffect, useMemo } from "react";
import { localApi } from "@/api/localClient";
import { getCached, setCached } from "@/lib/entityCache";
import { PageHeader, Loading, EmptyState, Badge } from "@/components/ui-bits";
import { formatDate, isValidWhatsApp } from "@/lib/billing";
import {
  BROADCAST_VARIABLES,
  buildBroadcastContext,
  personalizeMessage,
  broadcastWhatsAppCustom,
} from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageCircle, Send, History } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function WhatsAppPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [target, setTarget] = useState("all");
  const [areaSel, setAreaSel] = useState("");
  const [pkgSel, setPkgSel] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [packages, setPackages] = useState([]);
  const [invoicesByCust, setInvoicesByCust] = useState({});

  const load = async () => {
    const cached = getCached("whatsapp");
    if (cached) {
      setCustomers(cached.c);
      setPackages(cached.p);
      setLogs(cached.l);
      setBroadcasts(cached.b);
      setLoading(false);
    } else setLoading(true);
    try {
      const [c, p, l, b] = await Promise.all([
        localApi.entities.Customer.list(),
        localApi.entities.Package.list(),
        localApi.entities.WhatsAppLog.list("-date", 50),
        localApi.entities.BroadcastLog.list("-date", 30),
      ]);
      setCustomers(c);
      setPackages(p);
      setLogs(l);
      setBroadcasts(b);
      setCached("whatsapp", { c, p, l, b });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const areas = useMemo(
    () => [...new Set(customers.map((c) => c.area).filter(Boolean))],
    [customers],
  );

  const recipients = useMemo(() => {
    let list = customers.filter((c) => c.phone);
    if (target === "active") list = list.filter((c) => c.status === "aktif");
    else if (target === "area") list = list.filter((c) => c.area === areaSel);
    else if (target === "package")
      list = list.filter((c) => c.package_id === pkgSel);
    else if (target === "cv") list = list.filter((c) => c.uses_cv_deposit);
    return list;
  }, [customers, target, areaSel, pkgSel]);

  // preload invoices for variable context
  useEffect(() => {
    (async () => {
      const map = {};
      for (const r of recipients.slice(0, 200)) {
        const invs = await localApi.entities.Invoice.filter(
          { customer_id: r.id },
          "-period",
          50,
        );
        map[r.id] = invs;
      }
      setInvoicesByCust(map);
    })();
  }, [recipients]);

  const ctxFor = (r) => buildBroadcastContext(r, invoicesByCust[r.id] || []);
  const valid = recipients.filter((r) => isValidWhatsApp(r.phone));
  const invalid = recipients.filter((r) => !isValidWhatsApp(r.phone));
  const sample = valid[0]
    ? personalizeMessage(message || "", ctxFor(valid[0]))
    : "";

  const send = async () => {
    if (valid.length === 0) {
      toast({ variant: "destructive", title: "Tidak ada penerima valid" });
      return;
    }
    if (!message.trim()) {
      toast({ variant: "destructive", title: "Pesan kosong" });
      return;
    }
    if (
      !confirm(
        `Anda akan membagikan pesan kepada ${valid.length} pelanggan. Lanjutkan?`,
      )
    )
      return;
    setSending(true);
    try {
      const res = await broadcastWhatsAppCustom(
        recipients,
        message,
        ctxFor,
        "broadcast",
      );
      toast({
        title: `${res.opened} chat WhatsApp dibuka`,
        description: `${res.invalidCount} nomor tidak valid`,
      });
      load();
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="WhatsApp"
        subtitle="Broadcast custom dengan variable otomatis & riwayat"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="font-heading font-semibold text-slate-900">
            Broadcast Pesan Custom
          </h3>
          <div className="mt-3 space-y-3">
            <div>
              <Label>Pilih Penerima</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Pelanggan</SelectItem>
                  <SelectItem value="active">Pelanggan Aktif</SelectItem>
                  <SelectItem value="cv">Pelanggan CV</SelectItem>
                  <SelectItem value="area">Berdasarkan Area</SelectItem>
                  <SelectItem value="package">Berdasarkan Paket</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {target === "area" && (
              <div>
                <Label>Area</Label>
                <Select value={areaSel} onValueChange={setAreaSel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih area" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {target === "package" && (
              <div>
                <Label>Paket</Label>
                <Select value={pkgSel} onValueChange={setPkgSel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih paket" />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Template Pesan (klik untuk pakai)</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setMessage(
                      "Halo {nama}, kami dari ISP_Management informasikan tagihan {paket} periode {periode} sebesar {tagihan}. Sisa tagihan: {sisa}. Mohon segera lakukan pembayaran. Terima kasih.",
                    )
                  }
                  className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  Template Tagihan
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMessage(
                      "Yth {nama}, kami informasikan adanya gangguan layanan internet di area Anda saat ini. Tim teknisi sedang menangani dan diperkirakan segera normal kembali. Mohon maaf atas ketidaknyamanannya. - ISP_Management",
                    )
                  }
                  className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
                >
                  Template Gangguan
                </button>
              </div>
            </div>

            <div>
              <Label>Variable (klik untuk sisipkan)</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {BROADCAST_VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMessage((m) => m + v)}
                    className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Isi Pesan</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="Halo {nama}, tagihan {paket} periode {periode} sebesar {tagihan}. Sisa: {sisa}. Terima kasih."
              />
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-700">
                Penerima: <b>{valid.length}</b> valid ·{" "}
                <span className="text-rose-600">
                  {invalid.length} tidak valid
                </span>
              </p>
              {sample && (
                <div className="mt-2 rounded-md bg-white p-2 text-xs text-slate-600">
                  <b>Preview ({valid[0]?.name}):</b>
                  <p className="mt-1 whitespace-pre-wrap">{sample}</p>
                </div>
              )}
            </div>
            <Button onClick={send} disabled={sending} className="w-full">
              <Send className="mr-1.5 h-4 w-4" />{" "}
              {sending
                ? "Memproses..."
                : `Share / Kirim ke ${valid.length} Penerima`}
            </Button>
            <p className="text-[11px] text-slate-400">
              Sistem hanya membuka percakapan WhatsApp per penerima dan mencatat
              sebagai "Dibuka WhatsApp". Pengiriman aktual tergantung Anda
              menekan kirim di WhatsApp. Broadcast tidak mengubah data keuangan.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="font-heading font-semibold text-slate-900 flex items-center gap-2">
              <History className="h-4 w-4 text-slate-400" /> Riwayat Broadcast
            </h3>
            {broadcasts.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="Belum ada riwayat broadcast"
                  icon={MessageCircle}
                />
              </div>
            ) : (
              <div className="mt-3 space-y-2 max-h-[260px] overflow-y-auto">
                {broadcasts.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-lg border border-slate-100 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-indigo-100 text-indigo-700">
                          {b.valid_count} valid
                        </Badge>
                        {b.invalid_count > 0 && (
                          <Badge className="bg-rose-100 text-rose-700">
                            {b.invalid_count} invalid
                          </Badge>
                        )}
                        <Badge className="bg-slate-100 text-slate-600">
                          {b.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-slate-400">
                        {formatDate(b.date)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Admin: {b.admin || "-"} · {b.recipient_count} penerima
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-600 line-clamp-3">
                      {b.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="font-heading font-semibold text-slate-900">
              Riwayat Pesan Per Pelanggan
            </h3>
            {logs.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="Belum ada riwayat" icon={MessageCircle} />
              </div>
            ) : (
              <div className="mt-3 space-y-2 max-h-[260px] overflow-y-auto">
                {logs.map((w) => (
                  <div
                    key={w.id}
                    className="rounded-lg border border-slate-100 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-100 text-emerald-700">
                          {w.message_type}
                        </Badge>
                        <span className="text-xs font-medium text-slate-700">
                          {w.customer_name || "-"}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {formatDate(w.date)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{w.phone}</p>
                    <p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-600 line-clamp-2">
                      {w.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
