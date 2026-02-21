import React, { createContext, useCallback, useContext, useState } from "react";
import { postSync } from "@/lib/api-client";

type RefreshContextValue = {
  refreshKey: number;
  isRefreshing: boolean;
  doRefresh: () => Promise<void>;
};

const RefreshContext = createContext<RefreshContextValue | null>(null);

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const doRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await postSync();
      setRefreshKey((k) => k + 1);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return (
    <RefreshContext.Provider value={{ refreshKey, isRefreshing, doRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error("useRefresh must be used within RefreshProvider");
  return ctx;
}
