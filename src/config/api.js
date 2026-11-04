const REMOTE_API_URL = import.meta.env.VITE_API_URL || "https://db.ilkomith.web.id/api";

function isLocalHostOrLan() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.startsWith("192.168.") ||
    h.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)
  );
}

// Otomatis gunakan proxy lokal (/api -> localhost:5000) saat dibuka via localhost/Wi-Fi lokal,
// dan gunakan subdomain publik (https://db.ilkomith.web.id/api) saat dibuka via domain publik.
export const API_URL = isLocalHostOrLan() ? "/api" : REMOTE_API_URL;
export const BACKEND_URL = API_URL.startsWith("http") ? API_URL.replace(/\/api\/?$/, "") : "";
export const SITE_URL = import.meta.env.VITE_SITE_URL || "https://perpusverse.ilkomith.web.id";

export function resolveMediaUrl(url) {
  if (!url || typeof url !== "string") return url;
  if (
    url.startsWith("/covers/") ||
    url.startsWith("/original/") ||
    url.startsWith("/ebooks/")
  ) {
    return BACKEND_URL ? `${BACKEND_URL}${url}` : url;
  }
  return url;
}
