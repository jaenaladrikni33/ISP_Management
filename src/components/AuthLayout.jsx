import React from "react";
import { appBasePath, localApi } from "@/api/localClient";
import { useAuth } from "@/lib/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";

export default function AuthLayout({
  icon: Icon,
  title,
  subtitle,
  footer,
  children,
}) {
  const { appPublicSettings } = useAuth();
  const settings = appPublicSettings?.public_settings || {};
  const companyName = settings.company_name?.trim() || "ISP_Management";
  const hasCompanyLogo = Boolean(settings.company_logo_file_id);
  const logoSrc = hasCompanyLogo
    ? localApi.app.companyLogoUrl(settings.company_logo_file_id)
    : null;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-5 flex items-center justify-center gap-3">
            {hasCompanyLogo ? (
              <img
                src={logoSrc}
                alt={companyName}
                className="h-12 w-12 rounded-xl border border-slate-100 bg-white object-contain p-1 shadow-sm"
                onError={(event) => {
                  event.currentTarget.src = `${appBasePath}favicon.svg`;
                }}
              />
            ) : (
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 shadow-sm">
                <Icon
                  className="h-6 w-6 text-white"
                  aria-hidden="true"
                />
              </div>
            )}
            <div className="text-left">
              <p className="font-heading text-base font-bold tracking-tight text-slate-900">
                {companyName}
              </p>
              <p className="text-xs text-slate-500">Billing & ISP Manager</p>
            </div>
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </div>
        {footer && (
          <p className="mt-6 text-center text-sm text-slate-500">
            {footer}
          </p>
        )}
      </div>
    </div>
  );
}
