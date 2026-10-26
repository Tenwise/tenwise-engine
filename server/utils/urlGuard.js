import dns from 'node:dns/promises';
import dnsCallback from 'node:dns';
import net from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';

/**
 * SSRF guard. Feed/discovery/extraction endpoints fetch user-supplied URLs
 * server-side, so we must refuse to reach loopback, private, link-local, or
 * cloud-metadata addresses — otherwise a crafted URL turns the server into a
 * proxy into the host's own network.
 *
 * Three checks, all in safeFetch:
 * 1. Before the request: only http(s), and every address the host resolves
 *    to must be public (clear errors for the common cases).
 * 2. At connect time: the request's own DNS lookup goes through
 *    guardedLookup, which refuses private addresses. Without this, a hostile
 *    DNS server could answer "public" for check 1 and "127.0.0.1" a moment
 *    later for the real connection (DNS rebinding).
 * 3. Every redirect hop is followed manually and re-checked.
 * Parsing libraries (rss-parser, @extractus) only receive text fetched here.
 */

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

function inCidr(ipInt, base, maskBits) {
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (ipInt & mask) === (ipv4ToInt(base) & mask);
}

const BLOCKED_V4 = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],   // CGNAT
  ['127.0.0.0', 8],     // loopback
  ['169.254.0.0', 16],  // link-local (incl. 169.254.169.254 metadata)
  ['172.16.0.0', 12],   // private
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],  // private
  ['198.18.0.0', 15],   // benchmarking
  ['224.0.0.0', 4],     // multicast
  ['240.0.0.0', 4],     // reserved, incl. 255.255.255.255 broadcast
];

function isBlockedIpv4Int(int) {
  return BLOCKED_V4.some(([base, bits]) => inCidr(int, base, bits));
}

const isBlockedIpv4 = (ip) => isBlockedIpv4Int(ipv4ToInt(ip));

// An IPv6 address as a 128-bit number. URL does the parsing, and writes a
// trailing a.b.c.d as hex groups (::ffff:127.0.0.1 → ::ffff:7f00:1), so every
// spelling of an address comes out the same.
function ipv6ToBigInt(ip) {
  const hex = new URL(`http://[${ip.split('%')[0]}]/`).hostname.slice(1, -1); // no zone id, no brackets
  const [head, tail] = hex.split('::');
  const groups = (part) => (part ? part.split(':') : []);
  const left = groups(head);
  const right = groups(tail);
  const all = [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
  return all.reduce((acc, group) => (acc << 16n) | BigInt(parseInt(group, 16)), 0n);
}

const v6Cidr = (base, bits) => ({ base: ipv6ToBigInt(base), shift: BigInt(128 - bits) });
const inV6Cidr = (value, { base, shift }) => (value >> shift) === (base >> shift);

// Prefixes that carry an IPv4 address (at bit `at` from the right): such an
// address is as public as that IPv4, whichever way it is written.
const V6_WITH_V4 = [
  { ...v6Cidr('::', 96), at: 0n },          // IPv4-compatible (also :: and ::1)
  { ...v6Cidr('::ffff:0:0', 96), at: 0n },  // IPv4-mapped
  { ...v6Cidr('64:ff9b::', 96), at: 0n },   // NAT64 (DNS64 networks reach IPv4-only sites this way)
  { ...v6Cidr('2002::', 16), at: 80n },     // 6to4
];
// Only 2000::/3 is global unicast. Outside it: loopback, link-local
// (fe80::/10), unique-local (fc00::/7), multicast, site-local and reserved space.
const GLOBAL_UNICAST = v6Cidr('2000::', 3);
const BLOCKED_V6 = [
  v6Cidr('2001::', 32),     // Teredo: the IPv4 inside is obscured, so it can't be checked
  v6Cidr('2001:2::', 48),   // benchmarking
  v6Cidr('2001:db8::', 32), // documentation
];

function isBlockedIpv6(ip) {
  let value;
  try {
    value = ipv6ToBigInt(ip);
  } catch {
    return true; // not an address URL can read — refuse
  }
  const withV4 = V6_WITH_V4.find((cidr) => inV6Cidr(value, cidr));
  if (withV4) return isBlockedIpv4Int(Number((value >> withV4.at) & 0xffffffffn));
  if (!inV6Cidr(value, GLOBAL_UNICAST)) return true;
  return BLOCKED_V6.some((cidr) => inV6Cidr(value, cidr));
}

function isBlockedIp(ip) {
  const kind = net.isIP(ip);
  if (kind === 4) return isBlockedIpv4(ip);
  if (kind === 6) return isBlockedIpv6(ip);
  return true; // not a recognizable IP — refuse
}

function parseHttpUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Blocked URL scheme: ${url.protocol}`);
  }
  return url;
}

// Addresses the host resolves to; a literal IP resolves to itself (no DNS).
async function resolveHost(rawHost) {
  const host = rawHost.replace(/^\[(.*)\]$/, '$1'); // URL keeps IPv6 literals in brackets
  if (net.isIP(host)) return [host];
  let records;
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new Error(`Could not resolve host: ${host}`);
  }
  if (records.length === 0) throw new Error(`Could not resolve host: ${host}`);
  return records.map((r) => r.address);
}

/**
 * Throw if the URL is not a safe, public http(s) target.
 * Returns the parsed URL on success.
 */
export async function assertPublicHttpUrl(rawUrl) {
  const url = parseHttpUrl(rawUrl);
  const addresses = await resolveHost(url.hostname);
  if (addresses.some(isBlockedIp)) throw new Error(BLOCKED_MESSAGE);
  return url;
}

const BLOCKED_MESSAGE = 'Blocked private or loopback address';

/**
 * dns.lookup for outgoing connections that refuses private addresses, so the
 * address actually connected to is the one that was checked (no rebinding
 * between the check and the connection).
 */
export function guardedLookup(hostname, options, callback) {
  dnsCallback.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    if (addresses.length === 0) return callback(new Error(`Could not resolve host: ${hostname}`));
    if (addresses.some((a) => isBlockedIp(a.address))) return callback(Object.assign(new Error(BLOCKED_MESSAGE), { code: 'EBLOCKED' }));
    if (options.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
}

// The connection pool for guarded fetches: every connect resolves through
// guardedLookup. undici's own fetch is used with it (not the global fetch),
// so the client and the pool always come from the same undici version.
const guardedAgent = new Agent({ connect: { lookup: guardedLookup } });

/** One HTTP request through the guarded pool (redirects are handled by safeFetch). */
export const guardedRequest = (url, options) => undiciFetch(url, { ...options, dispatcher: guardedAgent });

const MAX_REDIRECTS = 5;

/**
 * SSRF-safe fetch. Validates the initial URL, connects only through
 * guardedLookup (no DNS rebinding), and re-validates the target of every
 * redirect hop, so a public URL cannot 3xx-redirect the server into a
 * loopback/private/metadata address. Redirects are followed manually
 * (redirect: 'manual') precisely so each Location can be checked first.
 * `request` is the single-hop HTTP call (tests pass a stub).
 */
export async function safeFetch(rawUrl, options = {}, request = guardedRequest) {
  let current = (await assertPublicHttpUrl(rawUrl)).href;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await request(current, { ...options, redirect: 'manual' });
    const isRedirect = res.status >= 300 && res.status < 400 && res.headers.has('location');
    if (!isRedirect) return res;
    const next = new URL(res.headers.get('location'), current).href;
    await assertPublicHttpUrl(next); // re-validate before following
    current = next;
  }
  throw new Error('Too many redirects');
}
