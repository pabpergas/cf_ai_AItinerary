import { useSyncExternalStore } from 'react';
import { windowState } from '@/lib/window-state';

export function useWindowState() {
  const state = useSyncExternalStore(
    windowState.subscribe,
    windowState.getSnapshot,
    windowState.getSnapshot
  );

  return state;
}
