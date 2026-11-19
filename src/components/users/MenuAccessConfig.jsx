import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { MENU_ITEMS } from "@/lib/roleAccess";

export default function MenuAccessConfig({ menus, onChange }) {
  const toggle = (to) => {
    if (menus.includes(to)) onChange(menus.filter((m) => m !== to));
    else onChange([...menus, to]);
  };
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {MENU_ITEMS.map((m) => (
        <label
          key={m.to}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
        >
          <Checkbox
            checked={menus.includes(m.to)}
            onCheckedChange={() => toggle(m.to)}
          />
          <span className="text-slate-700">{m.label}</span>
        </label>
      ))}
    </div>
  );
}
