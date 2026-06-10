import variables from "@/configs/env";

const PRODUCTION_DASHBOARD_URL = "https://ums.ypfafrica.org";
const PRODUCTION_WEBSITE_URL = "https://ypfafrica.org";
const DEVELOPMENT_DASHBOARD_URL = "http://localhost:3000";
const DEVELOPMENT_WEBSITE_URL = "http://localhost:5173";
const DEFAULT_LOGO_PATH = "/logo.png";

function defaultDashboardUrl(): string {
  return variables.app.isProduction
    ? PRODUCTION_DASHBOARD_URL
    : DEVELOPMENT_DASHBOARD_URL;
}

function defaultWebsiteUrl(): string {
  return variables.app.isProduction
    ? PRODUCTION_WEBSITE_URL
    : DEVELOPMENT_WEBSITE_URL;
}

function withProtocol(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w.-]+\.[a-z]{2,}(?::\d+)?(?:\/.*)?$/i.test(value)) {
    return `https://${value}`;
  }
  return value;
}

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const candidate = withProtocol((value ?? fallback).trim());

  try {
    const url = new URL(candidate);
    return url.toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

function absoluteUrl(value: string | undefined, baseUrl: string, path: string): string {
  const candidate = value?.trim() || path;

  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return new URL(path, baseUrl).toString();
  }
}

export function getDashboardUrl(): string {
  return normalizeBaseUrl(variables.app.dashboardUrl, defaultDashboardUrl());
}

export function getWebsiteUrl(): string {
  return normalizeBaseUrl(variables.app.websiteUrl, defaultWebsiteUrl());
}

export function getEmailLogoUrl(): string {
  const dashboardUrl = getDashboardUrl();
  const logoUrl = absoluteUrl(variables.app.logoUrl, dashboardUrl, DEFAULT_LOGO_PATH);

  try {
    const parsed = new URL(logoUrl);
    const publicSiteHosts = new Set(["ypfafrica.org", "www.ypfafrica.org"]);

    if (
      publicSiteHosts.has(parsed.hostname.toLowerCase()) &&
      parsed.pathname === DEFAULT_LOGO_PATH
    ) {
      return new URL(DEFAULT_LOGO_PATH, dashboardUrl).toString();
    }
  } catch {
    return new URL(DEFAULT_LOGO_PATH, dashboardUrl).toString();
  }

  return logoUrl;
}
