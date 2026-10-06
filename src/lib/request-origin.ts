/** The browser's Host can differ from Next.js's internal listening address. */
export function isAllowedRequestOrigin(origin: string | null, requestUrl: string, host: string | null, siteUrl?: string) {
  if (!origin) return true;
  const allowed = new Set<string>();
  const add = (value: string) => {
    try {
      const url = new URL(value);
      if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) allowed.add(url.origin);
    } catch { /* Ignore invalid configured addresses. */ }
  };
  add(requestUrl);
  if (siteUrl) add(siteUrl);
  if (host && /^[a-z0-9.:[\]-]+$/i.test(host)) {
    // Host is the destination of this request, not a caller-supplied forwarded host.
    add(`${new URL(requestUrl).protocol}//${host}`);
  }
  return allowed.has(origin);
}
