import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// WCAG 2.2 AA (1.4.3): normal-size text needs 4.5:1 against its background.
// These tests read the tokens straight from tokens.css, so a color change
// that breaks contrast in either theme fails here instead of in an audit.
const AA = 4.5;
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

const hexVars = (body) => Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]));
const DARK = hexVars(css.match(/^:root \{([^}]*)\}/m)[1]);
const LIGHT = { ...DARK, ...hexVars(css.match(/^\[data-theme="light"\] \{([^}]*)\}/m)[1]) };
const THEMES = { dark: DARK, light: LIGHT };

const accentPresets = (theme) => Object.fromEntries(
  [...css.matchAll(new RegExp(`\\[data-theme="${theme}"\\]\\[data-color="(\\w+)"\\] \\{ --accent: (#[0-9a-f]{6}); \\}`, 'g'))].map((m) => [m[1], m[2]]),
);

const rgb = (hex) => hex.slice(1).match(/../g).map((h) => parseInt(h, 16));
const luminance = (color) => {
  const [r, g, b] = color.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
// A color at `amount` opacity over the page; --accent-muted is the accent at 15% (selected rows).
const tint = (accent, page, amount = 0.15) => rgb(accent).map((v, i) => amount * v + (1 - amount) * rgb(page)[i]);

// Every surface text can sit on: page, panels, hovered, active and selected rows, dialogs.
const SURFACES = ['bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-hover', 'bg-active', 'bg-surface', 'bg-modal'];

// Dimmed toolbars and action rows rest on a pane (the page, a panel, the
// reader); hovered or focused, they're fully opaque again.
const DIMMED = Number(css.match(/--dimmed-opacity:\s*([\d.]+);/)?.[1]);
const PANES = ['bg-primary', 'bg-secondary', 'bg-surface'];

// "name on surface = ratio" for each pair below AA.
function failures(fg, tokens, extra = {}) {
  const backgrounds = { ...Object.fromEntries(SURFACES.map((s) => [s, rgb(tokens[s])])), ...extra };
  return Object.entries(backgrounds)
    .map(([name, bg]) => [name, contrast(rgb(fg), bg)])
    .filter(([, ratio]) => ratio < AA)
    .map(([name, ratio]) => `${name} ${ratio.toFixed(2)}:1`);
}

test('the token blocks parse', () => {
  for (const tokens of Object.values(THEMES)) for (const name of [...SURFACES, 'text-tertiary', 'danger']) assert.match(tokens[name], /^#/);
  assert.equal(Object.keys(accentPresets('dark')).length, 6);
  assert.equal(Object.keys(accentPresets('light')).length, 6);
  assert.ok(DIMMED > 0 && DIMMED <= 1, `--dimmed-opacity (${DIMMED})`);
});

for (const [theme, tokens] of Object.entries(THEMES)) {
  test(`${theme}: text tokens reach 4.5:1 on every surface`, () => {
    for (const name of ['text-primary', 'text-secondary', 'text-tertiary', 'danger']) {
      assert.deepEqual(failures(tokens[name], tokens), [], `--${name} (${tokens[name]})`);
    }
  });

  test(`${theme}: every accent preset reaches 4.5:1 as text and under its foreground`, () => {
    for (const [preset, accent] of Object.entries({ default: tokens.accent, ...accentPresets(theme) })) {
      const selected = { 'accent-muted': tint(accent, tokens['bg-primary']) };
      assert.deepEqual(failures(accent, tokens, selected), [], `${preset} accent ${accent}`);
      assert.ok(contrast(rgb(tokens['accent-foreground']), rgb(accent)) >= AA, `--accent-foreground on ${preset}`);
    }
  });

  test(`${theme}: dimmed text keeps 4.5:1 on the panes it rests on`, () => {
    for (const name of ['text-primary', 'text-secondary', 'text-tertiary', 'danger']) {
      for (const pane of PANES) {
        const ratio = contrast(tint(tokens[name], tokens[pane], DIMMED), rgb(tokens[pane]));
        assert.ok(ratio >= AA, `--${name} at ${DIMMED} on --${pane}: ${ratio.toFixed(2)}:1`);
      }
    }
  });

  test(`${theme}: destructive buttons reach 4.5:1`, () => {
    assert.ok(contrast(rgb(tokens['danger-foreground']), rgb(tokens.danger)) >= AA);
  });
}
