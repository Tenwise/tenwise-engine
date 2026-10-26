// Runs after `c8 node --test` in `npm run test:coverage`. Totals statement
// coverage per area from c8's coverage/coverage-summary.json and
// compares it with the 80% that the OpenSSF Best Practices Silver badge asks
// for. c8 runs with `all: true` (.c8rc.json), so files no test loads, such as
// the .jsx components, count as 0% instead of being left out. In GitHub
// Actions the table also goes to the job summary.
import { appendFileSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const TARGET = 80;

function percent(covered, total) {
  return total ? (covered / total) * 100 : 100;
}

// Monorepo folders that hold projects: an area is the folder inside a project
// (packages/studio/server/), not the container itself (packages/). The engine
// is a project at the top (engine/server/); on its own, its areas are server/ and src/.
const CONTAINERS = new Set(['apps', 'infrastructure', 'packages']);
const PROJECTS = new Set(['engine']);

function depthOf(parts) {
  if (CONTAINERS.has(parts[0]) && parts.length > 2) return parts.length > 3 ? 3 : 2;
  if (PROJECTS.has(parts[0]) && parts.length > 2) return 2;
  return 1;
}

function areaOf(relative) {
  const parts = relative.split(path.sep);
  const depth = depthOf(parts);
  return `${parts.slice(0, depth).join('/')}/`;
}

// c8's summary maps absolute file paths (plus "total") to their counts.
// → one row per area (see areaOf), then a total row.
export function byArea(summary, root) {
  const areas = new Map();
  for (const [file, { statements }] of Object.entries(summary)) {
    if (file === 'total') continue;
    const area = areaOf(path.relative(root, file));
    const row = areas.get(area) ?? { area, files: 0, untested: 0, covered: 0, total: 0 };
    row.files += 1;
    if (statements.covered === 0) row.untested += 1;
    row.covered += statements.covered;
    row.total += statements.total;
    areas.set(area, row);
  }
  const rows = [...areas.values()].sort((a, b) => a.area.localeCompare(b.area));
  const total = rows.reduce((sum, row) => ({
    area: 'Total',
    files: sum.files + row.files,
    untested: sum.untested + row.untested,
    covered: sum.covered + row.covered,
    total: sum.total + row.total,
  }), { area: 'Total', files: 0, untested: 0, covered: 0, total: 0 });
  return [...rows, total];
}

export function toMarkdown(rows) {
  const total = rows.at(-1);
  const pct = percent(total.covered, total.total);
  const verdict = pct >= TARGET
    ? `Meets the ${TARGET}% that OpenSSF Silver asks for.`
    : `${(TARGET - pct).toFixed(1)} points under the ${TARGET}% that OpenSSF Silver asks for.`;
  return [
    '### Statement coverage',
    '',
    '| Area | Files | Untested files | Statements | Coverage |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...rows.map((row) => `| ${row.area} | ${row.files} | ${row.untested} | ${row.covered} / ${row.total} | ${percent(row.covered, row.total).toFixed(1)}% |`),
    '',
    `${verdict} Files no test loads count as 0%.`,
    '',
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
  const markdown = toMarkdown(byArea(summary, process.cwd()));
  console.log(`\n${markdown}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
}
