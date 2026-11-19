import React from "react";
import { Link } from "react-router-dom";

// Kerangka setiap bagian laporan: judul, sumber data, rumus, dan tautan ke menu asal.
export default function ReportSection({
  title,
  source,
  formula,
  link,
  children,
}) {
  return (
    <section>
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-base font-semibold text-slate-900">
            {title}
          </h2>
          {source && (
            <p className="text-xs text-slate-500">
              <b className="text-slate-600">Sumber data:</b> {source}
            </p>
          )}
          {formula && (
            <p className="text-xs text-slate-500">
              <b className="text-slate-600">Perhitungan:</b> {formula}
            </p>
          )}
        </div>
        {link && (
          <Link
            to={link.to}
            className="shrink-0 text-xs font-medium text-sky-600 hover:underline"
          >
            {link.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
