import React, { useState, useEffect } from "react";
import { localApi } from "@/api/localClient";
import { formatCurrency } from "@/lib/billing";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// customers: pelanggan CV terpilih.
// Hanya setoran CV dari tagihan yang sudah lunas yang bisa disetorkan.
export default function MassSetorCV({ open, onOpenChange, customers, onDone }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState(null);
  const [blocked, setBlocked] = useState(0);

  useEffect(() => {
    if (!open || !customers?.length) return;
    setResults(null);
    (async () => {
      const invs = await localApi.entities.Invoice.list("-period", 3000);
      const isLunas = (d) => {
        const inv =
          invs.find((i) => i.id === d.invoice_id) ||
          invs.find(
            (i) => i.customer_id === d.customer_id && i.period === d.period,
          );
        return (
          inv && (inv.status === "lunas" || inv.status === "dibayar_rapel")
        );
      };
      const out = [];
      let blockedCount = 0;
      for (const c of customers) {
        if (!c.uses_cv_deposit) continue;
        const cv = await localApi.entities.CVDeposit.filter(
          { customer_id: c.id },
          "-period",
          200,
        );
        const belumSetor = cv.filter((d) => d.status !== "sudah_setor");
        const belum = belumSetor.filter(isLunas);
        blockedCount += belumSetor.length - belum.length;
        if (belum.length === 0) continue;
        out.push({
          customer: c,
          belum,
          nominal: belum.reduce(
            (s, d) => s + Number(d.cv_deposit_amount || 0),
            0,
          ),
        });
      }
      setRows(out);
      setBlocked(blockedCount);
    })();
  }, [open, customers]);

  const total = rows.reduce((s, r) => s + r.nominal, 0);

  const save = async () => {
    if (!rows.length) return;
    if (
      !confirm(
        `Tandai Setoran CV ${rows.length} pelanggan sebagai DISETORKAN dengan total ${formatCurrency(total)}? Status pembayaran pelanggan tidak berubah.`,
      )
    )
      return;
    setSaving(true);
    let done = 0;
    try {
      for (const r of rows) {
        for (const d of r.belum) {
          await localApi.entities.CVDeposit.update(d.id, {
            status: "sudah_setor",
            deposit_date: date,
            deposit_amount: Number(d.cv_deposit_amount || 0),
          });
        }
        await localApi.entities.Customer.update(r.customer.id, {
          cv_status: "sudah_setor",
          cv_deposit_date: date,
        });
        done++;
      }
      setResults({ done, total });
      onDone?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Setor ke CV (Massal) — {customers?.length || 0} pelanggan
          </DialogTitle>
        </DialogHeader>
        {!results && (
          <div className="space-y-3 text-sm">
            <div>
              <Label>Tanggal Setoran</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="max-h-72 overflow-auto rounded-lg border border-slate-100">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Pelanggan</th>
                    <th className="px-3 py-2">Setoran Belum</th>
                    <th className="px-3 py-2 text-right">Nominal Setoran CV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-4 text-center text-slate-500"
                      >
                        Tidak ada setoran CV yang bisa diproses — tagihan
                        pelanggan belum lunas.
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <tr key={r.customer.id}>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {r.customer.name}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {r.belum.length} periode
                      </td>
                      <td className="px-3 py-2 text-right text-indigo-600">
                        {formatCurrency(r.nominal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-sm text-slate-600">
                {rows.length} pelanggan CV dipilih
              </span>
              <span className="font-bold text-slate-900">
                Total Setoran CV: {formatCurrency(total)}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Hanya tagihan pelanggan yang sudah lunas yang bisa disetorkan ke
              CV. Status lunas pelanggan tidak berubah.
              {blocked > 0 && ` ${blocked} setoran belum lunas dilewati.`}
            </p>
          </div>
        )}
        {results && (
          <div className="rounded-lg bg-emerald-50 p-3 text-emerald-700 text-sm font-medium">
            Penyetoran CV selesai: {results.done} pelanggan · Total{" "}
            {formatCurrency(results.total)}.
          </div>
        )}
        <DialogFooter>
          {results ? (
            <Button onClick={() => onOpenChange(false)}>Selesai</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Batal
              </Button>
              <Button onClick={save} disabled={saving || !rows.length}>
                {saving ? "Memproses..." : "Konfirmasi & Setor"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
