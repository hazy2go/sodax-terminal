'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import type { SpokeChainKey } from '@sodax/types';

/**
 * The route the user is currently composing, lit inside the detector so the
 * trade form and the event display are one surface rather than two.
 * `state` reflects the real quote lifecycle — nothing here is simulated.
 */
export type FocusRoute = {
  srcChainKey: SpokeChainKey;
  dstChainKey: SpokeChainKey;
  srcSymbol: string;
  dstSymbol: string;
  state: 'composing' | 'quoting' | 'quoted';
};

type Ctx = {
  route: FocusRoute | null;
  setRoute: (r: FocusRoute | null) => void;
};

const FocusContext = createContext<Ctx>({ route: null, setRoute: () => {} });

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<FocusRoute | null>(null);
  const value = useMemo(() => ({ route, setRoute }), [route]);
  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocus(): Ctx {
  return useContext(FocusContext);
}
