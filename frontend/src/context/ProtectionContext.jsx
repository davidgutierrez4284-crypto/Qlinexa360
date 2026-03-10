import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';

const ProtectionContext = createContext({
  isProtected: true,
  setProtected: (_v) => {},
  isUnlocked: (_section) => false,
  requestUnlock: (_section, _minutes) => {},
});

const UNLOCKS_KEY = 'qlx_protection_unlocks_v1';

export function ProtectionProvider({ children }) {
  const [isProtected, setProtected] = useState(true);
  const [unlocks, setUnlocks] = useState({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(UNLOCKS_KEY);
      if (raw) setUnlocks(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(UNLOCKS_KEY, JSON.stringify(unlocks));
    } catch {}
  }, [unlocks]);

  const isUnlocked = (section) => {
    if (!section) return false;
    const exp = unlocks[section];
    if (!exp) return false;
    const now = Date.now();
    return now < exp;
  };

  const requestUnlock = (section, minutes = 30) => {
    const until = Date.now() + minutes * 60 * 1000;
    setUnlocks((prev) => ({ ...prev, [section]: until }));
  };

  const value = useMemo(
    () => ({ isProtected, setProtected, isUnlocked, requestUnlock }),
    [isProtected, unlocks]
  );

  return (
    <ProtectionContext.Provider value={value}>{children}</ProtectionContext.Provider>
  );
}

export function useProtection() {
  return useContext(ProtectionContext);
}


