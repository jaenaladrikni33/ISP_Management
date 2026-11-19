import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui-bits";
import { RAPEL_STATE_LABEL } from "@/lib/rapel";
import { Ban, Trash2, Link2 } from "lucide-react";

const STATE_CLASS = {
  menunggu: "bg-amber-100 text-amber-700",
  teraplikasi: "bg-emerald-100 text-emerald-700",
  void: "bg-slate-100 text-slate-500",
};

export function RapelStatusBadge({ state }) {
  return (
    <Badge className={STATE_CLASS[state]}>
      {RAPEL_STATE_LABEL[state].toUpperCase()}
    </Badge>
  );
}

export function RapelRowActions({ row, busy, onApply, onVoid, onDelete }) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {row.canApply && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 text-emerald-700"
          disabled={busy}
          onClick={() => onApply(row)}
          title="Tagihan periode ini sudah ada — hubungkan rapel"
        >
          <Link2 className="mr-1 h-3.5 w-3.5" /> Terapkan
        </Button>
      )}
      {row.state !== "void" && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-amber-600"
          disabled={busy}
          onClick={() => onVoid(row)}
          title="Batalkan (void)"
        >
          <Ban className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-red-600"
        disabled={busy}
        onClick={() => onDelete(row)}
        title="Hapus"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
