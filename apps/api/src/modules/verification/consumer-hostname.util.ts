import type { Request } from 'express';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const HOSTNAME_PATTERN = /^[a-z0-9.-]{1,253}$/;

function hostOnly(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const first = value.split(',')[0]!.trim().toLowerCase();
  const withoutPort = first.startsWith('[') ? first.slice(1, first.indexOf(']')) : first.split(':')[0];
  return withoutPort && (HOSTNAME_PATTERN.test(withoutPort) || withoutPort === '::1')
    ? withoutPort
    : undefined;
}

function originHost(origin: string | undefined): string | undefined {
  if (!origin) return undefined;
  try {
    return hostOnly(new URL(origin).host);
  } catch {
    return undefined;
  }
}

/**
 * Resolves which consumer hostname (and therefore tenant) a public request belongs to.
 *
 * The browser-controlled `Origin` header (or the proxy-set forwarded host) is authoritative.
 * A client-supplied hostname is only honoured when it matches that trusted host, or when the
 * request comes from a local development origin (e.g. localhost → verify.localhost mapping).
 */
export function resolveConsumerHostname(req: Request, claimed?: string): string {
  const trusted =
    originHost(req.headers.origin) ??
    hostOnly(req.headers['x-forwarded-host'] as string | undefined) ??
    hostOnly(req.headers.host);

  const claimedHost = hostOnly(claimed);
  if (!claimedHost) return trusted ?? '';
  if (!trusted || claimedHost === trusted || LOCAL_HOSTS.has(trusted)) return claimedHost;
  return trusted;
}
