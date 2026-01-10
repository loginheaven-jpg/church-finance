'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface YearContextType {
  year: number;
  setYear: (year: number) => void;
}

const YearContext = createContext<YearContextType | null>(null);

export function YearProvider({ children }: { children: ReactNode }) {
  const [year, setYearState] = useState(() => {
    // 클라이언트 사이드에서만 localStorage에서 읽기
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedYear');
      return saved ? parseInt(saved) : new Date().getFullYear();
    }
    return new Date().getFullYear();
  });

  const setYear = (newYear: number) => {
    setYearState(newYear);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedYear', String(newYear));
    }
  };

  // 초기 렌더링 후 localStorage에서 값 읽기
  useEffect(() => {
    const saved = localStorage.getItem('selectedYear');
    if (saved) {
      setYearState(parseInt(saved));
    }
  }, []);

  return (
    <YearContext.Provider value={{ year, setYear }}>
      {children}
    </YearContext.Provider>
  );
}

export function useYear() {
  const context = useContext(YearContext);
  if (!context) {
    throw new Error('useYear must be used within a YearProvider');
  }
  return context;
}
