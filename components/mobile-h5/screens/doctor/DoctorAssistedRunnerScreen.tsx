import React from 'react';
import { Stethoscope } from 'lucide-react';
import AssessmentRunner from '@/components/mobile-h5/screens/shared/AssessmentRunner';
import type { Question, Scale, DoctorPatient, Answer } from '@/components/mobile-h5/types';

export interface DoctorAssistedRunnerScreenProps {
  questions: Question[];
  scale: Scale;
  patient: DoctorPatient;
  onComplete: (answers: Record<string, Answer>) => void;
  onBack: () => void;
  onOpenAi: () => void;
}

const DoctorAssistedRunnerScreen: React.FC<DoctorAssistedRunnerScreenProps> = ({
  questions,
  scale,
  patient,
  onComplete,
  onBack,
  onOpenAi,
}) => {
  return (
    <section data-component="doctor-assisted-runner" className="flex flex-col min-h-screen">
      {/* Doctor info bar */}
      <div
        data-hide-in-locked
        className="bg-sage-50 px-5 py-2 flex items-center gap-2"
      >
        <Stethoscope className="w-4 h-4 text-sage-500" />
        <span className="text-xs text-sage-600">医生辅助录入模式</span>
      </div>

      {/* Shared runner */}
      <AssessmentRunner
        questions={questions}
        scale={scale}
        mode="doctor_assisted"
        patientInfo={{ name: patient.name, ageLabel: patient.ageLabel }}
        showAi
        onOpenAi={onOpenAi}
        onComplete={onComplete}
        onBack={onBack}
      />
    </section>
  );
};

export default DoctorAssistedRunnerScreen;
