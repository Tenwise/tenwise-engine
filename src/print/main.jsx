import { pluginsOf } from '../plugins/index.js';

// print.html: one page drawn for an export renderer, by the plugin that owns
// the page (src/plugins/index.js, printPages: { id, draw(root, params) }).
// <body data-ready> says when it is done ("1") or why it failed ("error" +
// data-error). Without a plugin there is nothing to print.

async function draw() {
  const [page] = pluginsOf('printPages');
  if (!page) throw new Error('Nothing to print');
  await page.draw(document.getElementById('root'), new URLSearchParams(location.search));
  document.body.dataset.ready = '1';
}

draw().catch((err) => {
  document.body.dataset.error = err.message;
  document.body.dataset.ready = 'error';
});
