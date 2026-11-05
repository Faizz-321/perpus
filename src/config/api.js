// Gunakan relative path "/api" agar otomatis menyesuaikan dengan domain/host yang sedang dibuka:
// - Saat dibuka di localhost -> http://localhost:5173/api -> proxy ke port 5000
// - Saat dibuka di domain publik (perpusverse.ilkomith.web.id) baik dari HP maupun Laptop -> https://perpusverse.ilkomith.web.id/api -> proxy ke port 5000
export const API_URL = import.meta.env.VITE_API_URL || "/api";
export const BACKEND_URL = API_URL.startsWith("http") ? API_URL.replace(/\/api\/?$/, "") : "";
export const SITE_URL = import.meta.env.VITE_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "https://perpusverse.ilkomith.web.id");

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
