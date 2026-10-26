// Plugins add features to the app without the app knowing them: a plugin is
// an object whose keys are slots, each a list of contributions. The list comes
// from `#tenwise-plugins`, which package.json maps to none.js (empty): a
// plain build, and Node tests, get no plugins (a test may set some with
// setPlugins). vite.config.js points it at another list when TENWISE_PLUGINS
// is set. Slots so far (docs/ARCHITECTURE.md lists them all):
//
//   addFeedTabs   { id, label, Icon, useTab(status), Panel({ tab, loading, adder }), open?(tab, request) }
//                 A tab in Add feeds. useTab is called once per dialog, so the
//                 tab keeps its state while others are shown.
//   searchOffers  { id, Offer({ query, openTab(id, request) }) }
//                 Shown under the Search tab's results for a query.
//   prompts       { id, group, label, defaultText, note? }
//                 More prompts in the registry (src/ai/promptRegistry.js), so
//                 Settings → Prompts can edit them; read with getPrompt(id).
//   aiLimits      { id, label, defaultValue, min, max }
//                 More text limits (src/ai/limits.js); read with getLimit(id).
//   voice         { id, instructions(), record?(), note?, Strip?, Chips?({ row, Chip }) }
//                 Text added after AI system prompts, such as a persona
//                 (src/ai/voice.js); the summaries-library fields recording
//                 it; a strip showing it; and its chips on a saved summary.
//   settingsSections { id, label, Icon, after, settings: [{ id, level, label, hint?, stacked?, Control }] }
//                 A section of Settings, placed after the section `after` names.
//   settings      { id, section, level, label, hint?, stacked?, Control }
//                 A setting in one of the app's sections, after the app's own.
//   railTabs      { id, label, useTab({ article, extractedContent, model }), busy(tab), Panel({ tab, canRun }) }
//                 A tab in the AI rail, after Summary. useTab is called on
//                 every render of the rail; while busy(tab) is true no other
//                 tab may start an AI run.
//   filterPills   { id, Pills({ available, active, onChange }) }
//                 Pills in the list's filter row; `available` and `active`
//                 are the server's filter values, by key.
//   listHeaderControls { id, Control() }
//                 A control in the list header, beside the filter button.
//   providers     { id, Provider({ children }) }
//                 Wraps the workspace, for state that lives while the app does.
//   railActions   { id, Control() }
//                 A control at the foot of the app rail, below Settings.
//   selectionOperations { id, label, min, max, hint, Panel({ articles, initialOperation, onClose, width, onResize }) }
//                 An entry in the selection bar's AI menu, for min–max
//                 selected articles; its Panel replaces the reader.
import built from '#tenwise-plugins';

let plugins = built;

/** Sets the plugins in use: for tests, which get none from the build. */
export function setPlugins(list) {
  plugins = list ?? built;
}

/** Every plugin's contributions to `slot`, in plugin order. */
export const pluginsOf = (slot) => plugins.flatMap((plugin) => plugin[slot] ?? []);
