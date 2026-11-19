import React, { useState, useEffect } from "react";
import { localApi } from "@/api/localClient";
import { normalizePhone, isValidWhatsApp } from "@/lib/billing";
import {
  BROADCAST_VARIABLES,
  buildBroadcastContext,
  personalizeMessage,
  broadcastWhatsAppCustom,
} from "@/lib/whatsapp";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

// recipients: array of selected customers
export default function BroadcastDialog({
  open,
  onOpenChange,
  recipients,
  onDone,
}) {
  const { toast } = useToast();
  const [step, setStep] = useState("compose"); // compose | preview | sending | done
  const [message, setMessage] = useState("");
  const [invoicesByCust, setInvoicesByCust] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("compose");
      setMessage("");
      setResult(null);
      return;
    }
    (async () => {
      const map = {};
      for (const r of recipients) {
        const invs = await localApi.entities.Invoice.filter(
          { customer_id: r.id },
          "-period",
          50,
        );
        map[r.id] = invs;
      }
      setInvoicesByCust(map);
    })();
  }, [open, recipients]);

  const ctxFor = (r) => buildBroadcastContext(r, invoicesByCust[r.id] || []);
  const valid = recipients.filter((r) => isValidWhatsApp(r.phone));
  const invalid = recipients.filter((r) => !isValidWhatsApp(r.phone));

  const sample = valid[0]
    ? personalizeMessage(message || "", ctxFor(valid[0]))
    : "";

  const doSend = async () => {
    if (
      !confirm(
        `Anda akan membagikan pesan kepada ${valid.length} pelanggan. Lanjutkan?`,
      )
    )
      return;
    setBusy(true);
    try {
      const res = await broadcastWhatsAppCustom(
        recipients,
        message,
        ctxFor,
        "broadcast",
      );
      setResult(res);
      setStep("done");
      onDone?.();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Gagal broadcast",
        description: e.message,
      });
    } finally {
      setBusy(false);
    }
  };

  const insertVar = (v) => {
    setMessage((m) => m + v);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Broadcast WhatsApp Custom — {recipients.length} pelanggan
          </DialogTitle>
        </DialogHeader>

        {step === "compose" && (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <b>{recipients.length}</b> pelanggan dipilih ·{" "}
              <b className="text-emerald-600">{valid.length}</b> nomor valid ·{" "}
              {invalid.length > 0 && (
                <b className="text-rose-600">
                  {invalid.length} nomor tidak valid
                </b>
              )}
            </div>
            <div>
              <Label>Variable (klik untuk sisipkan)</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {BROADCAST_VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVar(v)}
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
                rows={8}
                placeholder="Halo {nama}, tagihan {paket} periode {periode} sebesar {tagihan}. Sisa: {sisa}. Terima kasih."
              />
            </div>
            {invalid.length > 0 && (
              <div className="rounded-lg border border-rose-200 p-3">
                <p className="text-xs font-medium text-rose-700 mb-1">
                  Nomor tidak valid (tidak akan dikirimi):
                </p>
                <div className="max-h-24 overflow-auto text-xs text-slate-600">
                  {invalid.map((r) => (
                    <div key={r.id}>
                      {r.name} — {r.phone || "(kosong)"} —{" "}
                      {r.customer_id || "-"}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="font-medium text-slate-700">
                Jumlah Penerima Valid: <b>{valid.length}</b>
              </p>
            </div>
            <div className="max-h-72 overflow-auto rounded-lg border border-slate-100 divide-y divide-slate-100">
              {valid.map((r) => (
                <div key={r.id} className="p-3">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-800">{r.name}</span>
                    <span>{normalizePhone(r.phone)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600 line-clamp-4">
                    {personalizeMessage(message, ctxFor(r))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-emerald-50 p-3 text-emerald-700 font-medium">
              Broadcast disiapkan: {result.opened} chat WhatsApp dibuka.
            </div>
            {result.invalid.length > 0 && (
              <div className="rounded-lg border border-amber-200 p-3">
                <p className="text-xs font-medium text-amber-700 mb-1">
                  {result.invalid.length} nomor tidak valid:
                </p>
                <div className="max-h-24 overflow-auto text-xs text-slate-600">
                  {result.invalid.map((r) => (
                    <div key={r.id}>
                      {r.name} — {r.phone || "(kosong)"}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-400">
              Catatan: sistem hanya membuka percakapan WhatsApp dan mencatat
              sebagai "Dibuka WhatsApp". Pengiriman aktual tergantung Anda
              menekan tombol kirim di WhatsApp. Data keuangan tidak berubah.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "compose" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={!message.trim() || valid.length === 0}
              >
                Lihat Preview
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("compose")}>
                Kembali Edit
              </Button>
              <Button onClick={doSend} disabled={busy}>
                {busy ? "Memproses..." : `Share / Kirim (${valid.length})`}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => onOpenChange(false)}>Selesai</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
