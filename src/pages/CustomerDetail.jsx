import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { localApi } from "@/api/localClient";
import { getCached, setCached } from "@/lib/entityCache";
import { Loading, Badge, EmptyState } from "@/components/ui-bits";
import {
  formatCurrency,
  periodLabel,
  formatDate,
  STATUS_LABELS,
  STATUS_COLORS,
  CV_STATUS_LABELS,
  CV_STATUS_COLORS,
  invoiceDanaCV,
} from "@/lib/billing";
import {
  buildInvoiceMessage,
  buildReminderMessage,
  sendWhatsApp,
} from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  MessageCircle,
  FileText,
  Bell,
  Phone,
  MapPin,
  Wifi,
  Calendar,
  CreditCard,
  Landmark,
  TrendingUp,
  History,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const TABS = [
  { key: "info", label: "Informasi", icon: Phone },
  { key: "tagihan", label: "Tagihan", icon: FileText },
  { key: "pembayaran", label: "Pembayaran", icon: CreditCard },
  { key: "piutang", label: "Piutang", icon: TrendingUp },
  { key: "cv", label: "Setoran CV", icon: Landmark },
  { key: "wa", label: "Riwayat WhatsApp", icon: History },
];

export default function CustomerDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [cvDeposits, setCvDeposits] = useState([]);
  const [waLogs, setWaLogs] = useState([]);
  const [tab, setTab] = useState("info");

  const load = async () => {
    const key = `cust:${id}`;
    const cached = getCached(key);
    if (cached) {
      setCustomer(cached.c);
      setInvoices((cached.inv || []).filter((i) => i.status !== "void"));
      setPayments(cached.pay);
      setCvDeposits((cached.cv || []).filter((d) => d.status !== "void"));
      setWaLogs(cached.wa);
      setLoading(false);
    } else setLoading(true);
    try {
      const c = await localApi.entities.Customer.get(id);
      setCustomer(c);
      const [inv, pay, cv, wa] = await Promise.all([
        localApi.entities.Invoice.filter({ customer_id: id }, "-period", 200),
        localApi.entities.Payment.filter({ customer_id: id }, "-date", 200),
        localApi.entities.CVDeposit.filter({ customer_id: id }, "-period", 200),
        localApi.entities.WhatsAppLog.filter({ customer_id: id }, "-date", 50),
      ]);
      const invA = inv.filter((i) => i.status !== "void");
      const cvA = cv.filter((d) => d.status !== "void");
      const payActive = pay.filter((p) => p.status === "active");
      setInvoices(invA);
      setPayments(payActive);
      setCvDeposits(cvA);
      setWaLogs(wa);
      setCached(key, { c, inv: invA, pay: payActive, cv: cvA, wa });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <Loading />;
  if (!customer) return <EmptyState title="Pelanggan tidak ditemukan" />;

  const unpaid = invoices.filter(
    (i) => i.status !== "lunas" && i.status !== "dibayar_rapel",
  );
  const totalPiutang = unpaid.reduce(
    (s, i) => s + Number(i.remaining ?? i.amount - (i.total_paid || 0)),
    0,
  );
  const totalPembayaran = payments.reduce(
    (s, p) => s + Number(p.amount || 0),
    0,
  );
  const cvRows = cvDeposits.map((c) => {
    const inv = invoices.find(
      (i) =>
        i.id === c.invoice_id ||
        (i.customer_id === c.customer_id && i.period === c.period),
    );
    const totalPaid = Number(inv?.total_paid || 0);
    return {
      ...c,
      danaCV: invoiceDanaCV(totalPaid, c.cv_deposit_amount),
      sisaSetor: Math.max(
        0,
        c.cv_deposit_amount - invoiceDanaCV(totalPaid, c.cv_deposit_amount),
      ),
    };
  });
  const totalDanaCV = cvRows.reduce((s, c) => s + c.danaCV, 0);
  const totalPendapatan = customer.uses_cv_deposit
    ? totalDanaCV
    : totalPembayaran;

  const sendInvoice = (inv) =>
    sendWhatsApp(customer, buildInvoiceMessage(customer, inv), "tagihan").then(
      () => {
        toast({ title: "Tagihan dikirim via WhatsApp" });
        load();
      },
    );
  const sendReminder = () => {
    if (unpaid.length === 0) {
      toast({ title: "Tidak ada tunggakan" });
      return;
    }
    sendWhatsApp(
      customer,
      buildReminderMessage(customer, unpaid),
      "pengingat",
    ).then(() => {
      toast({ title: "Pengingat dikirim" });
      load();
    });
  };
  const chatWA = () => window.open(`https://wa.me/${customer.phone}`, "_blank");

  return (
    <div>
      <Link
        to="/pelanggan"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke daftar pelanggan
      </Link>

      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-lg font-bold text-white">
              {customer.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold text-slate-900">
                {customer.name}
              </h1>
              <p className="text-sm text-slate-500">
                {customer.customer_id || "-"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge
                  className={
                    customer.status === "aktif"
                      ? "bg-emerald-100 text-emerald-700"
                      : customer.status === "isolir"
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-600"
                  }
                >
                  {customer.status === "aktif"
                    ? "Aktif"
                    : customer.status === "isolir"
                      ? "Isolir"
                      : "Tidak Aktif"}
                </Badge>
                {customer.uses_cv_deposit && (
                  <Badge className="bg-indigo-100 text-indigo-700">
                    Setoran CV
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={chatWA}>
              <MessageCircle className="mr-1.5 h-4 w-4" /> Chat WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={sendReminder}>
              <Bell className="mr-1.5 h-4 w-4" /> Kirim Pengingat
            </Button>
          </div>
        </div>
      </div>

      {/* quick stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Total Tagihan</p>
          <p className="font-bold text-slate-900">
            {formatCurrency(
              invoices.reduce((s, i) => s + Number(i.amount || 0), 0),
            )}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Total Pembayaran</p>
          <p className="font-bold text-emerald-600">
            {formatCurrency(totalPembayaran)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Piutang</p>
          <p className="font-bold text-amber-600">
            {formatCurrency(totalPiutang)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Pendapatan</p>
          <p className="font-bold text-sky-600">
            {formatCurrency(totalPendapatan)}
          </p>
        </div>
      </div>

      {/* tabs */}
      <div className="mt-5 flex gap-1 overflow-x-auto rounded-lg bg-white p-1 shadow-sm border border-slate-100">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${tab === t.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        {tab === "info" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow
              icon={Phone}
              label="Nomor HP / WhatsApp"
              value={customer.phone}
            />
            <InfoRow icon={MapPin} label="Alamat" value={customer.address} />
            <InfoRow icon={MapPin} label="Area" value={customer.area} />
            <InfoRow
              icon={Wifi}
              label="Paket Internet"
              value={`${customer.package_name || "-"} - ${formatCurrency(customer.monthly_price)}/bln`}
            />
            <InfoRow
              icon={Calendar}
              label="Tanggal Pemasangan"
              value={formatDate(customer.install_date)}
            />
            <InfoRow
              icon={Landmark}
              label="Setoran CV"
              value={
                customer.uses_cv_deposit
                  ? `${formatCurrency(customer.cv_deposit_amount)} · ${CV_STATUS_LABELS[customer.cv_status] || "Belum Setor"}`
                  : "Tidak menggunakan CV"
              }
            />
            <div className="sm:col-span-2">
              <InfoRow
                icon={FileText}
                label="Catatan"
                value={customer.notes || "-"}
              />
            </div>
          </div>
        )}

        {tab === "tagihan" &&
          (invoices.length === 0 ? (
            <EmptyState title="Belum ada tagihan" icon={FileText} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">No</th>
                    <th className="px-3 py-2">Periode</th>
                    <th className="px-3 py-2 text-right">Tagihan</th>
                    <th className="px-3 py-2 text-right">Dibayar</th>
                    <th className="px-3 py-2 text-right">Sisa</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((i) => (
                    <tr key={i.id}>
                      <td className="px-3 py-2 font-mono text-xs">
                        {i.invoice_number}
                      </td>
                      <td className="px-3 py-2">{periodLabel(i.period)}</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(i.amount)}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-600">
                        {formatCurrency(i.total_paid || 0)}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-600">
                        {formatCurrency(
                          i.remaining ?? i.amount - (i.total_paid || 0),
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={STATUS_COLORS[i.status]}>
                          {STATUS_LABELS[i.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => sendInvoice(i)}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === "pembayaran" &&
          (payments.length === 0 ? (
            <EmptyState title="Belum ada pembayaran" icon={CreditCard} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">No Transaksi</th>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2 text-right">Nominal</th>
                    <th className="px-3 py-2">Metode</th>
                    <th className="px-3 py-2">Jenis</th>
                    <th className="px-3 py-2">Alokasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 font-mono text-xs">
                        {p.transaction_number}
                      </td>
                      <td className="px-3 py-2">{formatDate(p.date)}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-3 py-2 capitalize">{p.method}</td>
                      <td className="px-3 py-2 capitalize">{p.payment_type}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {(p.allocations || [])
                          .map(
                            (a) =>
                              `${periodLabel(a.period)}: ${formatCurrency(a.amount)}`,
                          )
                          .join(", ") || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === "piutang" &&
          (unpaid.length === 0 ? (
            <EmptyState title="Tidak ada piutang 🎉" icon={TrendingUp} />
          ) : (
            <div>
              <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Total Piutang: <b>{formatCurrency(totalPiutang)}</b> (
                {unpaid.length} periode)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Periode</th>
                      <th className="px-3 py-2 text-right">Tagihan</th>
                      <th className="px-3 py-2 text-right">Dibayar</th>
                      <th className="px-3 py-2 text-right">Sisa</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {unpaid.map((i) => (
                      <tr key={i.id}>
                        <td className="px-3 py-2">{periodLabel(i.period)}</td>
                        <td className="px-3 py-2 text-right">
                          {formatCurrency(i.amount)}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-600">
                          {formatCurrency(i.total_paid || 0)}
                        </td>
                        <td className="px-3 py-2 text-right text-amber-600 font-medium">
                          {formatCurrency(
                            i.remaining ?? i.amount - (i.total_paid || 0),
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={STATUS_COLORS[i.status]}>
                            {STATUS_LABELS[i.status]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

        {tab === "cv" &&
          (!customer.uses_cv_deposit ? (
            <EmptyState
              title="Pelanggan ini tidak menggunakan Setoran CV"
              icon={Landmark}
            />
          ) : cvRows.length === 0 ? (
            <EmptyState title="Belum ada data setoran CV" icon={Landmark} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Periode</th>
                    <th className="px-3 py-2 text-right">Tagihan</th>
                    <th className="px-3 py-2 text-right">Setoran CV</th>
                    <th className="px-3 py-2 text-right">Bayar</th>
                    <th className="px-3 py-2 text-right">Dana CV</th>
                    <th className="px-3 py-2 text-right">Sisa Setor</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cvRows.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2">{periodLabel(c.period)}</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(c.invoice_amount)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(c.cv_deposit_amount)}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-600">
                        {formatCurrency(c.deposit_amount || 0)}
                      </td>
                      <td className="px-3 py-2 text-right text-indigo-600 font-medium">
                        {formatCurrency(c.danaCV)}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-600">
                        {formatCurrency(c.sisaSetor)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={CV_STATUS_COLORS[c.status]}>
                          {CV_STATUS_LABELS[c.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === "wa" &&
          (waLogs.length === 0 ? (
            <EmptyState title="Belum ada riwayat WhatsApp" icon={History} />
          ) : (
            <div className="space-y-2">
              {waLogs.map((w) => (
                <div
                  key={w.id}
                  className="rounded-lg border border-slate-100 p-3"
                >
                  <div className="flex items-center justify-between">
                    <Badge className="bg-emerald-100 text-emerald-700">
                      {w.message_type}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {formatDate(w.date)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                    {w.content}
                  </p>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value || "-"}</p>
      </div>
    </div>
  );
}
