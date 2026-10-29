export const API_URL = import.meta.env.VITE_API_URL || "https://db.ilkomith.web.id/api";
export const BACKEND_URL = API_URL.replace(/\/api\/?$/, "");
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
