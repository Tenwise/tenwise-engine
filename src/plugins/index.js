// Plugins add features to the app without the app knowing them: a plugin is
// an object whose keys are slots, each a list of contributions. The list comes
// from `#tenwise-plugins`, which package.json maps to none.js (empty): a
// plain build, and Node tests, get no plugins (a test may set some with
// setPlugins). vite.config.js points it at another list when TENWISE_PLUGINS
// is set. Slots so far (docs/ARCHITECTURE.md lists them all):
//
//   addFeedTabs   { id, label, Icon, useTab(status), Panel({ tab, loading, adder }), open?(tab, request) }
//                 (emit('open-add-feed', { tab: id }) opens Add feeds on it)
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
//   collectionMarks { id, useMarks() }
//                 Marks on the sidebar's collections: useMarks() returns a Map
//                 of collection id → { title, Icon } (Studio: has a brief).
//                 Called on every render of the collections list.
//   filterPills   { id, Pills({ available, active, onChange }) }
//                 Pills in the list's filter row; `available` and `active`
//                 are the server's filter values, by key.
//   listHeaderControls { id, Control() }
//                 A control in the list header, beside the filter button.
//   providers     { id, Provider({ children }) }
//                 Wraps the workspace, for state that lives while the app does.
//   railActions   { id, Control() }
//                 A control at the foot of the app rail, below Settings.
//   selectionOperations { id, label, min, max, hint, button?, Panel({ articles, initialOperation, onClose, width, onResize }) }
//                 An entry in the selection bar's AI menu, for min–max
//                 selected articles; its Panel replaces the reader. With
//                 button, it is also a button of its own beside AI.
//   selectionActions { id, label, title?, Icon, run(articleIds) }
//                 A button in the selection bar, after CSV: run gets the
//                 selected articles' ids, then the selection clears.
//   aiEngines     { id, models(), handles(name), streamChat(name, messages, signal, options) }
//                 An AI engine beside Gemini Nano and Ollama. models()
//                 resolves to the models it offers now ([{ name, label?,
//                 preferred? }], [] when it has none); a `preferred` model is
//                 what Auto picks. streamChat has the contract of the app's
//                 streamChat() (src/utils/api.js) for the names it handles;
//                 options.purpose says what the answer is for.
//   feedCatalog   { id, load() }
//                 The feed catalog in place of the built-in one (Add feeds →
//                 Popular and Search; src/components/add-feed/catalog.js).
//                 load() resolves to categories, the shape of
//                 src/catalog/popular-feeds.json's, or null to keep the
//                 built-in. Asked once per page load; the first that
//                 answers is used.
//   imageHosts    { id, hosts(origin) }
//                 Hosts on the app's own site whose images the reader may
//                 show anyway (src/utils/imageUrl.js, SEC-022): hosts(origin)
//                 returns hostnames, each trusted exactly (not its
//                 subdomains), never the app's own. Only for a host that
//                 serves nothing but images and gets no session cookie.
//   sidebarSections { id, Section({ activeView, onViewChange, feeds, counts, feedMenu }), hidesFeed?(feed) }
//                 A section of the sidebar, after Collections. A feed whose
//                 hidesFeed(feed) is true leaves Folders, for a section that
//                 shows it instead (the newsletter inbox); feedMenu(id) is an
//                 onMenu handler opening that feed's menu. A row may open a
//                 feed narrowed to one author: { type: 'feed', id, author, name }.
//   capabilities  { [name]: false }
//                 Turns off engine behaviour this deployment shouldn't have;
//                 read with capability(name). Every capability is on unless
//                 a plugin turns it off. Names so far:
//                   seedSettingsFromBrowser  a new settings file is seeded
//                                            from this browser (settings/sync.js)
//                   ollama                   Ollama is offered: its setup, its
//                                            models, and messages naming it
//                   pollWhenIdle             polling goes on while the tab is
//                                            hidden or idle (hooks/activity.js)
//                   settingsPowerFirst       Settings opens in Power, not Simple
//                                            (components/settings/modes.js)
//                   settingsFile             Settings offers the settings file
//                                            beside the databases
//                   backgroundAI             AI may summarize new articles in
//                                            the background (editorial-ai)
import built from '#tenwise-plugins';

let plugins = built;

/** Sets the plugins in use: for tests, which get none from the build. */
export function setPlugins(list) {
  plugins = list ?? built;
}

/** Every plugin's contributions to `slot`, in plugin order. */
export const pluginsOf = (slot) => plugins.flatMap((plugin) => plugin[slot] ?? []);

/** Whether a capability is on: true unless a plugin's `capabilities` turns it off. */
export const capability = (name) => !pluginsOf('capabilities').some((flags) => flags[name] === false);
