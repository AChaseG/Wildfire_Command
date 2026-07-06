// Shared SSRF guard for edge functions that fetch caller- or DB-supplied URLs.
// A "public" URL field must never be usable to reach loopback, private,
// link-local, or cloud-metadata addresses, so every outbound scrape/probe is
// validated against the resolved IPs before we connect, and again on each
// redirect hop.
//
// Note: the WHATWG URL parser already canonicalizes shorthand IPv4 forms
// (decimal "2130706433", hex "0x7f000001", "127.1") into dotted-quad and puts
// IPv6 in brackets, so checking url.hostname covers those encodings.

function ipv4ToLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const b = Number(p);
    if (b > 255) return null;
    n = n * 256 + b;
  }
  return n >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToLong(ip);
  if (n === null) return false;
  const inRange = (base: string, bits: number) => {
    const b = ipv4ToLong(base)!;
    const mask = bits === 0 ? 0 : (~((1 << (32 - bits)) - 1)) >>> 0;
    return (n & mask) === (b & mask);
  };
  return (
    inRange("0.0.0.0", 8) ||        // "this" network
    inRange("10.0.0.0", 8) ||       // private
    inRange("100.64.0.0", 10) ||    // carrier-grade NAT
    inRange("127.0.0.0", 8) ||      // loopback
    inRange("169.254.0.0", 16) ||   // link-local incl. cloud metadata (169.254.169.254)
    inRange("172.16.0.0", 12) ||    // private
    inRange("192.0.0.0", 24) ||     // IETF protocol assignments
    inRange("192.168.0.0", 16) ||   // private
    inRange("198.18.0.0", 15) ||    // benchmarking
    inRange("224.0.0.0", 4) ||      // multicast
    inRange("240.0.0.0", 4)         // reserved
  );
}

function isPrivateIpv6(ip: string): boolean {
  const a = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (a === "::1" || a === "::") return true;
  if (a.startsWith("fe80") || a.startsWith("fc") || a.startsWith("fd")) return true;
  // IPv4-mapped/-compatible addresses (e.g. ::ffff:127.0.0.1).
  const m = a.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (m) return isPrivateIpv4(m[1]);
  return false;
}

const BLOCKED_HOST_RE = /(^|\.)(localhost|local|internal|intranet|corp|home|lan)$/i;

function ipLiteralKind(host: string): "v4" | "v6" | null {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return "v4";
  if (host.includes(":")) return "v6";
  return null;
}

async function hostResolvesPrivate(host: string): Promise<boolean> {
  for (const kind of ["A", "AAAA"] as const) {
    try {
      const addrs = await Deno.resolveDns(host, kind);
      for (const a of addrs) {
        if (kind === "A" ? isPrivateIpv4(a) : isPrivateIpv6(a)) return true;
      }
    } catch {
      // No record of this type; nothing to reject on.
    }
  }
  return false;
}

// Validates a URL for outbound fetching. Throws with a caller-safe message when
// the target must not be reached. Returns the parsed URL on success.
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Malformed URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL must use http or https.");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || BLOCKED_HOST_RE.test(host)) {
    throw new Error("Refusing to fetch an internal host.");
  }
  const kind = ipLiteralKind(host);
  if (kind === "v4" && isPrivateIpv4(host)) throw new Error("Refusing to fetch a private address.");
  if (kind === "v6" && isPrivateIpv6(host)) throw new Error("Refusing to fetch a private address.");
  if (!kind && await hostResolvesPrivate(host)) {
    throw new Error("Refusing to fetch a host that resolves to a private address.");
  }
  return url;
}

// fetch() that validates the initial URL and every redirect hop against the
// SSRF guard, so a public URL can't 30x-redirect into the internal network.
// Drop-in for fetch() where redirects were previously followed automatically.
export async function safeFetch(
  raw: string,
  init: RequestInit = {},
  maxRedirects = 5,
): Promise<Response> {
  let current = (await assertPublicUrl(raw)).toString();
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(current, { ...init, redirect: "manual" });
    const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!location) return res;
    // Consume the redirect body so the connection can be reused/closed.
    await res.body?.cancel();
    const next = new URL(location, current).toString();
    await assertPublicUrl(next);
    current = next;
  }
  throw new Error("Too many redirects.");
}
