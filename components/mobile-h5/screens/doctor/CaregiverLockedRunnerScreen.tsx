import React from 'react';
import { Smartphone } from 'lucide-react';
import AssessmentRunner from '@/components/mobile-h5/screens/shared/AssessmentRunner';
import type { Question, Scale, Answer } from '@/components/mobile-h5/types';

export interface CaregiverLockedRunnerScreenProps {
  questions: Question[];
  scale: Scale;
  onComplete: (answers: Record<string, Answer>) => void;
}

/** No-op back handler – locked mode does not allow navigation. */
const noop = () => {};

const CaregiverLockedRunnerScreen: React.FC<CaregiverLockedRunnerScreenProps> = ({
  questions,
  scale,
  onComplete,
}) => {
  return (
    <section
      data-component="caregiver-locked-runner"
      className="locked-mode flex flex-col min-h-screen"
    >
      {/* Top banner */}
      <div className="bg-sky-50 px-5 py-3 text-center flex items-center justify-center gap-2">
        <Smartphone className="w-4 h-4 text-sky-600" />
        <span className="text-sm text-sky-600">家长填写模式</span>
      </div>

      {/* Shared runner – locked mode, no AI */}
      <AssessmentRunner
        questions={questions}
        scale={scale}
        mode="caregiver_handoff_locked"
        patientInfo={{ name: '孩子', ageLabel: '' }}
        showAi={false}
        onComplete={onComplete}
        onBack={noop}
      />
    </section>
  );
};

export default CaregiverLockedRunnerScreen;
