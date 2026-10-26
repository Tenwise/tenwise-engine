import { useSyncExternalStore } from 'react';
import { serverStatus } from './serverStatus.js';

/** Whether the local server has stopped answering (see serverStatus.js). */
export const useServerDown = () => useSyncExternalStore(serverStatus.subscribe, serverStatus.isDown);
