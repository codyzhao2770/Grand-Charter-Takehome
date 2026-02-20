"use client";

import { createContext, useContext, useCallback, useState } from "react";

const RefreshContext = createContext<{
  refreshKey: number;
  triggerRefresh: () => void;
}>({ refreshKey: 0, triggerRefresh: () => {} });

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  return (
    <RefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  return useContext(RefreshContext);
}
