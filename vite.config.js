import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The API's port: PORT if set (`PORT=3002 npm run dev` reaches both processes), else 3001.
const API = { target: `http://127.0.0.1:${Number(process.env.PORT) || 3001}`, changeOrigin: true };

// Under `npm run dev` and `npm run preview`, Vite serves the page, so it refuses
// framing too. The full policy for the built app is in server/utils/securityHeaders.js;
// a script policy here would break Vite's hot reload.
const PAGE_HEADERS = {
  'Content-Security-Policy': "frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
};

// Plugins (src/plugins/index.js): none in a plain build. TENWISE_PLUGINS names
// another list (absolute, or relative to the working directory), as an app
// built on the engine does.
const PLUGINS = process.env.TENWISE_PLUGINS
  ? resolve(process.env.TENWISE_PLUGINS)
  : fileURLToPath(new URL('./src/plugins/none.js', import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // `@/…` imports from src/ (shadcn/ui components use this alias).
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)), '#tenwise-plugins': PLUGINS },
  },
  build: {
    // print.html draws one Studio page for the export renderer (server/utils/pageRenderer.js).
    rollupOptions: { input: { main: fileURLToPath(new URL('./index.html', import.meta.url)), print: fileURLToPath(new URL('./print.html', import.meta.url)) } },
  },
  server: {
    port: 5173,
    // Stop if 5173 is taken rather than moving to another port: the docs and
    // the server's startup line say 5173 (server/utils/startup.js).
    strictPort: true,
    // Plugin files outside the engine (a monorepo's packages/) are readable
    // because Vite allows the whole npm workspace by default.
    headers: PAGE_HEADERS,
    proxy: { '/api': API },
  },
  // `npm run preview` serves dist/; the API must be running too (npm run dev:server).
  preview: { headers: PAGE_HEADERS, proxy: { '/api': API } },
})
