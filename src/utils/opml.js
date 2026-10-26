// Accept only http(s) URLs from an imported OPML file. Attribute values come
// from an untrusted file, so a `javascript:`/`data:` URL slipped into xmlUrl or
// htmlUrl must never be stored — it could later render as a link href. Returns
// the URL if it's http(s), otherwise ''.
export function safeHttpUrl(value) {
  if (!value) return '';
  try {
    const { protocol } = new URL(value);
    return (protocol === 'http:' || protocol === 'https:') ? value : '';
  } catch {
    return '';
  }
}

const outlineName = (node) => node.getAttribute('title') || node.getAttribute('text');
const isOutline = (node) => node?.tagName.toLowerCase() === 'outline';

// Feed entry for an outline node, or null when it has no usable xmlUrl.
function feedFromOutline(node, folderName) {
  const url = safeHttpUrl(node.getAttribute('xmlUrl'));
  if (!url) return null;
  return { title: outlineName(node) || url, url, siteUrl: safeHttpUrl(node.getAttribute('htmlUrl')), folderName };
}

// Top-level outlines: a folder (has child outlines) or a feed on its own.
function topLevelFeeds(outline) {
  const children = Array.from(outline.children).filter(isOutline);
  if (children.length === 0) return [feedFromOutline(outline, null)];
  const folderName = outlineName(outline) || 'Uncategorized';
  return children.map((child) => feedFromOutline(child, folderName));
}

// Any feed at any depth, filed under its parent outline when it has one.
function nestedFeed(node) {
  const parent = node.parentElement;
  return feedFromOutline(node, isOutline(parent) ? outlineName(parent) : null);
}

export function parseOPML(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Invalid XML format');
  }

  const feeds = Array.from(xmlDoc.querySelectorAll('body > outline')).flatMap(topLevelFeeds).filter(Boolean);

  // Also catch deeply nested feeds (some Feedly exports), without duplicates.
  const seen = new Set(feeds.map((f) => f.url));
  for (const node of xmlDoc.querySelectorAll('outline[xmlUrl]')) {
    const feed = nestedFeed(node);
    if (feed && !seen.has(feed.url)) {
      feeds.push(feed);
      seen.add(feed.url);
    }
  }
  return feeds;
}

const XML_ENTITIES = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' };

export function escapeXML(str) {
  return str ? str.replace(/[<>&'"]/g, (c) => XML_ENTITIES[c]) : '';
}

function feedLine(feed, indent) {
  const title = escapeXML(feed.title);
  return `${indent}<outline type="rss" text="${title}" title="${title}" xmlUrl="${escapeXML(feed.url)}" htmlUrl="${escapeXML(feed.siteUrl)}" />\n`;
}

function folderBlock(name, folderFeeds) {
  const folderName = escapeXML(name);
  const lines = folderFeeds.map((feed) => feedLine(feed, '      ')).join('');
  return `    <outline text="${folderName}" title="${folderName}">\n${lines}    </outline>\n`;
}

// Feeds grouped by folder id, plus the feeds with no (known) folder.
function groupByFolder(feeds, folders) {
  const byFolder = new Map(folders.map((f) => [f.id, []]));
  const uncategorized = [];
  for (const feed of feeds) {
    (byFolder.get(feed.folderId) || uncategorized).push(feed);
  }
  return { byFolder, uncategorized };
}

export function generateOPML(feeds, folders) {
  const { byFolder, uncategorized } = groupByFolder(feeds, folders);
  const ordered = [...folders].sort((a, b) => a.id - b.id);
  const folderXml = ordered
    .filter((f) => byFolder.get(f.id).length > 0)
    .map((f) => folderBlock(f.name, byFolder.get(f.id)))
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Tenwise Subscriptions</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
${folderXml}${uncategorized.map((feed) => feedLine(feed, '    ')).join('')}  </body>
</opml>`;
}
