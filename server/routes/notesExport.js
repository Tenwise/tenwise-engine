import { Router } from 'express';
import { notesHtml, notesMarkdown, notesOf } from '../db/notesExport.js';

const router = Router();

// A file name from a title: letters, digits and dashes.
const fileNameOf = (title, ext) => `${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'notes'}-notes.${ext}`;
const FORMATS = {
  md: { ext: 'md', type: 'text/markdown; charset=utf-8', render: notesMarkdown },
  html: { ext: 'html', type: 'text/html; charset=utf-8', render: notesHtml },
};

/**
 * GET /api/export/notes.md|html?collection=<id> — your saves (or that
 * collection) with your notes and highlights, as a download (PR-14).
 */
router.get('/notes.:format', (req, res) => {
  // nosemgrep: ajinabraham.njsscan.xss.xss_node.express_xss -- an attachment; notesHtml escapes every value, served with a no-script CSP
  const format = Object.hasOwn(FORMATS, req.params.format) ? FORMATS[req.params.format] : null;
  if (!format) return res.status(404).json({ error: 'Not found' });
  const raw = req.query.collection;
  const collectionId = raw === undefined ? undefined : Number(raw);
  if (collectionId !== undefined && !Number.isInteger(collectionId)) return res.status(400).json({ error: 'invalid collection' });
  try {
    const notes = notesOf({ collectionId });
    if (!notes) return res.status(404).json({ error: 'Not found' });
    res.set('Content-Type', format.type);
    res.set('Content-Disposition', `attachment; filename="${fileNameOf(notes.title, format.ext)}"`);
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    return res.send(format.render(notes));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
