import React, { createContext, useContext } from 'react';

interface TooltipContextValue {
  delayDuration: number;
  skipDelayDuration: number;
}

const TooltipContext = createContext<TooltipContextValue>({
  delayDuration: 700,
  skipDelayDuration: 300,
});

interface TooltipProviderProps {
  children: React.ReactNode;
  delayDuration?: number;
  skipDelayDuration?: number;
}

export function TooltipProvider({
  children,
  delayDuration = 700,
  skipDelayDuration = 300,
}: TooltipProviderProps) {
  return (
    <TooltipContext.Provider value={{ delayDuration, skipDelayDuration }}>
      {children}
    </TooltipContext.Provider>
  );
}

export function useTooltipContext() {
  return useContext(TooltipContext);
}
