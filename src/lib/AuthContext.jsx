import React, { createContext, useState, useContext, useEffect } from "react";
import { appBasePath, localApi } from "@/api/localClient";

function applyPublicBranding(response) {
  const settings = response?.public_settings || {};
  const companyName = settings.company_name?.trim() || "ISP_Management";
  const logoUrl = settings.company_logo_file_id
    ? localApi.app.companyLogoUrl(settings.company_logo_file_id)
    : `${appBasePath}favicon.svg`;

  document.title = `${companyName} — Billing & ISP Manager`;
  document
    .querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')
    .forEach((link) => {
      link.href = logoUrl;
    });
}

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const refreshPublicSettings = async () => {
    const publicSettings = await localApi.app.getPublicSettings();
    setAppPublicSettings(publicSettings);
    applyPublicBranding(publicSettings);
  };

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      await refreshPublicSettings();
      await checkUserAuth();
    } catch (error) {
      setAuthError({
        type: "unknown",
        message: error.message || "Tidak dapat terhubung ke server lokal.",
      });
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } finally {
      setIsLoadingPublicSettings(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await localApi.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setAuthChecked(true);
    } catch (error) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      setUser(null);
      setAuthError(
        error.status === 401 || error.status === 403
          ? null
          : { type: "unknown", message: error.message },
      );
    } finally {
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    const handleBrandingUpdate = () => {
      refreshPublicSettings().catch((error) => {
        console.error("Gagal memuat ulang identitas aplikasi.", error);
      });
    };
    window.addEventListener("app-branding-updated", handleBrandingUpdate);
    checkAppState();
    return () =>
      window.removeEventListener("app-branding-updated", handleBrandingUpdate);
  }, []);

  const logout = async (shouldRedirect = true) => {
    await localApi.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
    setAuthChecked(true);
    if (shouldRedirect) {
      window.location.assign("/login");
    }
  };

  const navigateToLogin = () => {
    const returnTo = window.location.pathname + window.location.search;
    window.location.assign(
      `/login?returnTo=${encodeURIComponent(returnTo)}`,
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
