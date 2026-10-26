// What the server prints when it starts, and what it says when it can't.

// Under `npm run dev`, Vite serves the app on this port (strictPort in vite.config.js).
export const VITE_PORT = 5173;

const LOOPBACK_OR_ANY = ['127.0.0.1', '::1', '0.0.0.0', '::'];

/** The address to open in a browser for a server on host:port. */
export function appUrl(host, port) {
  return `http://${LOOPBACK_OR_ANY.includes(host) ? 'localhost' : host}:${port}`;
}

/**
 * The line printed once the server listens. dev: started by `npm run dev`, so
 * Vite serves the app; built: this server serves dist/.
 */
export function readyMessage({ url, dev, built }) {
  if (dev) return `Tenwise API is up on ${url}. Open the app at http://localhost:${VITE_PORT}`;
  if (built) return `Tenwise is running. Open ${url}`;
  return `Tenwise API is up on ${url}, but there is no built app to serve. Use npm start (builds it) or npm run dev.`;
}

// The commands to suggest, in the shell people have: PowerShell on Windows.
const SHELL = {
  win32: { whoHas: (port) => `netstat -ano | findstr :${port}`, withPort: (port) => `$env:PORT=${port}; npm run dev` },
  other: { whoHas: (port) => `lsof -i :${port}`, withPort: (port) => `PORT=${port} npm run dev` },
};

/** Why the server couldn't listen on `port`, and what to do about it. */
export function listenFailure(err, port, platform = process.platform) {
  const shell = SHELL[platform] ?? SHELL.other;
  if (err.code === 'EADDRINUSE') {
    return `Port ${port} is already in use, so Tenwise can't start.\n`
      + `Quit whatever is using it (${shell.whoHas(port)} shows what), or use another port, for example: ${shell.withPort(port + 1)}`;
  }
  if (err.code === 'EACCES') return `Tenwise isn't allowed to use port ${port}. Use another port, for example: ${shell.withPort(3002)}`;
  return `Tenwise couldn't start: ${err.message}`;
}
