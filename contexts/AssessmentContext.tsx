/**
 * 评估上下文 - 管理当前量表评估状态
 */

'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { ScaleDefinition } from '@/lib/schemas/core/types';

interface AssessmentContextType {
  currentScale: ScaleDefinition | null;
  setCurrentScale: (scale: ScaleDefinition | null) => void;
  resetAssessment: () => void;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export function AssessmentProvider({ children }: { children: ReactNode }) {
  const [currentScale, setCurrentScale] = useState<ScaleDefinition | null>(null);

  const resetAssessment = useCallback(() => {
    setCurrentScale(null);
  }, []);

  return (
    <AssessmentContext.Provider value={{ currentScale, setCurrentScale, resetAssessment }}>
      {children}
    </AssessmentContext.Provider>
  );
}

export function useAssessment() {
  const context = useContext(AssessmentContext);
  if (context === undefined) {
    throw new Error('useAssessment must be used within an AssessmentProvider');
  }
  return context;
}
