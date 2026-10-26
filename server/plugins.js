// Server plugins add routes and hooks without the server knowing them. The
// list is loaded once at startup from the module named by
// TENWISE_SERVER_PLUGINS (none by default). A plugin is an object with any of:
//
//   routes               [[path, expressRouter], ...], mounted at each path
//                        (/api/...); or a function of the app's context
//                        { db, localOrigin, publicOrigin, port } returning them
//   resolveArticleUrl    async (url, fetchPage) => the URL to extract from, or
//                        '' to leave the link alone. Throw an Error with a
//                        `reason` (and `site`) to say why it can't be read.
//   feedTitle            (feedUrl) => a title for that feed, or ''
//   publicOrigin         the one public address a hosted install is served
//                        from ("https://app.example.com"), behind a proxy that
//                        signs people in. The engine alone is local only.
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

let active = [];

/** Sets the plugins in use (startup, and tests). */
export function setPlugins(plugins) {
  active = plugins ?? [];
}

/** The plugins exported by the module at `spec` (absolute, or relative to the working directory). */
export async function loadPlugins(spec) {
  if (!spec) return [];
  const path = isAbsolute(spec) ? spec : resolve(process.cwd(), spec);
  const { default: plugins } = await import(pathToFileURL(path).href);
  if (!Array.isArray(plugins)) throw new Error(`${spec} must export a list of plugins`);
  return plugins;
}

/** [path, router] pairs from every plugin, given the app's context (see routes above). */
export const pluginRoutes = (context) => active.flatMap((plugin) => (typeof plugin.routes === 'function' ? plugin.routes(context) : plugin.routes ?? []));

/** The URL to extract for an article link: the first plugin that rewrites it, else the link. */
export async function resolveArticleUrl(url, fetchPage) {
  for (const plugin of active) {
    const target = await plugin.resolveArticleUrl?.(url, fetchPage);
    if (target) return target;
  }
  return url;
}

/** A plugin's title for a feed, or ''. */
export function pluginFeedTitle(feedUrl) {
  for (const plugin of active) {
    const title = plugin.feedTitle?.(feedUrl);
    if (title) return title;
  }
  return '';
}

/** The public origin a plugin names (unchecked), or ''. */
export const pluginPublicOrigin = () => active.find((plugin) => plugin.publicOrigin)?.publicOrigin ?? '';
