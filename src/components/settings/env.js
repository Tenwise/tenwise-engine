import { createContext, useContext } from 'react';

/** What settings controls need from the app: { availableModels, onClose, showToast }. */
export const SettingsEnv = createContext({ availableModels: [], onClose: () => {}, showToast: () => {} });

export const useSettingsEnv = () => useContext(SettingsEnv);
