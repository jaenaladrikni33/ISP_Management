import React from "react";
import { PageHeader } from "@/components/ui-bits";
import RapelPanel from "@/components/rapel/RapelPanel";

export default function Rapel() {
  return (
    <div>
      <PageHeader
        title="Rapel"
        subtitle="Pembayaran di muka untuk periode tagihan masa depan. Otomatis diterapkan saat tagihan periode tersebut dibuat."
      />
      <RapelPanel />
    </div>
  );
}
