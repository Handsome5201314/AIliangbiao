import React from 'react';
import { CheckCircle, Smartphone } from 'lucide-react';
import { cn } from '@/components/mobile-h5/lib/utils';

export interface CaregiverCompleteScreenProps {
  onReturnToDoctor: () => void;
}

const CaregiverCompleteScreen: React.FC<CaregiverCompleteScreenProps> = ({
  onReturnToDoctor,
}) => {
  return (
    <section
      data-component="caregiver-complete"
      className="px-5 py-8 flex flex-col items-center justify-center min-h-full"
    >
      {/* Success icon */}
      <div className="w-20 h-20 bg-sage-50 rounded-full flex items-center justify-center p-5">
        <CheckCircle className="w-10 h-10 text-sage-400" />
      </div>

      <h1 className="text-2xl font-semibold text-foreground mt-6">
        测评已完成
      </h1>
      <p className="text-base text-muted mt-3">
        请将手机交还医生。
      </p>

      {/* Return button */}
      <button
        onClick={onReturnToDoctor}
        className={cn(
          'mt-10 w-full max-w-[280px] h-button bg-sage-400 text-white rounded-button font-medium text-base',
          'flex items-center justify-center gap-2',
          'active:opacity-90 transition-smooth'
        )}
      >
        <Smartphone className="w-5 h-5" />
        返回医生端
      </button>
    </section>
  );
};

export default CaregiverCompleteScreen;
