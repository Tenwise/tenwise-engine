// Shared by the browser (src/) and the server (server/): both must split a
// search query into the same terms.

/** Splits a query into lowercase terms; "quoted phrases" stay together. */
export function tokenizeQuery(query) {
  const tokens = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m;
  while ((m = re.exec(query || '')) !== null) tokens.push((m[1] || m[2]).toLowerCase());
  return tokens;
}
