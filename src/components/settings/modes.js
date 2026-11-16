// Which settings this deployment offers, and the mode Settings opens in.
// Both follow capabilities (src/plugins/index.js), so the hosted app can
// start in Simple and leave out what only a self-hosted install can use.
import { capability } from '../../plugins/index.js';

/** Power where `settingsPowerFirst` is on (self-hosted), else Simple. */
export const defaultSettingsMode = () => (capability('settingsPowerFirst') ? 'power' : 'simple');

/** A setting that names a capability shows only where that capability is on. */
export const offered = (setting) => !setting.capability || capability(setting.capability);
