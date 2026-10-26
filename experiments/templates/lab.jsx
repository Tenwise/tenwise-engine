/* eslint-disable react-refresh/only-export-components -- a dev-only page, not a module */
// Template lab (dev only, served by `npm run dev` at /experiments/templates/lab.html):
// every Studio newsletter in every design, side by side, with the presentation
// checks (pageChecks.js). window.checkPages() checks them all.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchStudioItem, fetchStudioItems } from '../../src/utils/api.js';
import NewsletterPage from '../../src/components/studio/templates/NewsletterPage.jsx';
import { DESIGNS } from '../../src/components/studio/templates/designs/index.js';
import { checkPage } from '../../src/components/studio/templates/pageChecks.js';
import { pageMeta } from '../../src/components/studio/templates/pageMeta.js';
import { parseIssue } from '../../src/components/studio/templates/parseIssue.js';
import { presentation } from '../../src/components/studio/templates/rules.js';

async function loadAll() {
  const list = await fetchStudioItems();
  const items = await Promise.all(list.map((i) => fetchStudioItem(i.id)));
  return items.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true })).map((item) => {
    const issue = parseIssue(item.bodyMd, item.title.replace(/^\[c\d+\]\s*/, ''));
    return { item, issue, presentation: presentation(issue), meta: pageMeta(item, issue) };
  });
}

const pause = () => new Promise((r) => setTimeout(r, 350));

// Checks every newsletter in every design at full size; returns the failures.
window.checkPages = async () => {
  const small = document.querySelector('.bar button[aria-pressed="true"]');
  if (small) { small.click(); await pause(); }
  const select = document.querySelector('select');
  const report = [];
  for (let i = 0; i < select.options.length; i += 1) {
    select.value = String(i);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await pause();
    document.querySelectorAll('.page').forEach((page) => {
      report.push({ newsletter: select.options[i].text.slice(0, 50), design: page.dataset.design, problems: checkPage(page.querySelector('.nl')) });
    });
  }
  return { pages: report.length, failing: report.filter((r) => r.problems.length) };
};

function Lab() {
  const [corpus, setCorpus] = useState(null);
  const [index, setIndex] = useState(0);
  const [small, setSmall] = useState(true);
  useEffect(() => { loadAll().then(setCorpus); }, []);
  if (!corpus) return <p style={{ padding: 24 }}>Loading…</p>;
  const current = corpus[index];
  return (
    <>
      <div className="bar">
        <button onClick={() => setIndex((i) => Math.max(0, i - 1))}>← Prev</button>
        <select value={index} onChange={(e) => setIndex(Number(e.target.value))}>
          {corpus.map((c, i) => <option key={c.item.id} value={i}>{c.item.title.slice(0, 70)}</option>)}
        </select>
        <button onClick={() => setIndex((i) => Math.min(corpus.length - 1, i + 1))}>Next →</button>
        <button aria-pressed={small} onClick={() => setSmall((s) => !s)}>Small</button>
      </div>
      <div className={small ? 'pages small' : 'pages'}>
        {DESIGNS.map((design) => (
          <div key={design.id} className="page" data-design={design.id}>
            <div className="label">{design.label}</div>
            <NewsletterPage design={design} issue={current.issue} presentation={current.presentation} meta={current.meta} sources={current.item.sources} />
          </div>
        ))}
      </div>
    </>
  );
}

createRoot(document.getElementById('root')).render(<Lab />);
