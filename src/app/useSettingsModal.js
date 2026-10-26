import { useEffect, useState } from 'react';
import { on } from '../lib/appEvents.js';

/**
 * Opens Settings on the 'open-settings' app event, at the section it names
 * (e.g. the AI rail's "Change voice" opens 'assistant'). Returns that section.
 */
export function useSettingsModal(setModal) {
  const [section, setSection] = useState(null);
  useEffect(() => on('open-settings', (name) => {
    setSection(name ?? null);
    setModal('settings');
  }), [setModal]);
  return section;
}
