"use client";

import { createContext, type ReactNode, useContext } from "react";

const CspNonceContext = createContext<string | undefined>(undefined);

export function CspNonceProvider({
  children,
  nonce,
}: Readonly<{ children: ReactNode; nonce?: string }>) {
  return (
    <CspNonceContext.Provider value={nonce}>
      {children}
    </CspNonceContext.Provider>
  );
}

export function useCspNonce() {
  return useContext(CspNonceContext);
}
