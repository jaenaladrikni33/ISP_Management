import React from "react";
import { StatCard } from "@/components/ui-bits";
import { InfoIcon } from "@/components/InfoIcon";
import { formatCurrency } from "@/lib/billing";

// Kotak nominal laporan + ⓘ (klik untuk sumber, rumus, dan transaksi pembentuk).
export default function ReportStatCard({
  label,
  amount,
  text,
  icon,
  tone,
  sub,
  period,
  source,
  formula,
  items,
  note,
  children,
}) {
  const value = text ?? formatCurrency(amount);
  return (
    <StatCard
      label={label}
      value={value}
      icon={icon}
      tone={tone}
      sub={sub}
      info={
        <InfoIcon
          title={label}
          value={value}
          period={period}
          source={source}
          formula={formula}
          items={items}
          note={note}
        >
          {children}
        </InfoIcon>
      }
    />
  );
}
