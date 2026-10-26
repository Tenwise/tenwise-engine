// Shared by the browser (the article sanitizer keeps an iframe only if its
// host is listed) and the server (the page's Content-Security-Policy lets
// frames load only from these hosts): one list, so the two layers agree.

/** Hosts whose video and audio players may be embedded in an article. */
export const EMBED_HOSTS = Object.freeze([
  'www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com',
  'player.vimeo.com', 'w.soundcloud.com',
]);
