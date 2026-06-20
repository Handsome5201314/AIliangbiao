import React from 'react';
import { ChevronLeft, Stethoscope, Smartphone, Lock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type FillMode = 'doctor_assisted' | 'caregiver_handoff_locked';

export interface FillModeSelectorScreenProps {
  onSelectMode: (mode: FillMode) => void;
  onBack: () => void;
  patientName: string;
  scaleName: string;
}

const FillModeSelectorScreen: React.FC<FillModeSelectorScreenProps> = ({
  onSelectMode,
  onBack,
  patientName,
  scaleName,
}) => {
  const [selectedMode, setSelectedMode] = React.useState<FillMode>('doctor_assisted');

  const handleConfirm = () => {
    onSelectMode(selectedMode);
  };

  return (
    <section data-component="fill-mode-selector" className="px-5 py-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="w-11 h-11 -ml-2 rounded-full active:bg-cream-200 transition-smooth"
          aria-label="返回"
        >
          <ChevronLeft className="w-6 h-6 text-foreground" />
        </Button>
        <h1 className="text-xl font-semibold text-foreground">选择填写方式</h1>
      </div>

      {/* Context card */}
      <div className="mt-4 bg-sage-50 rounded-card p-3">
        <p className="text-sm text-foreground">
          患者: {patientName} · 量表: {scaleName}
        </p>
      </div>

      {/* Mode cards */}
      <div className="mt-5 flex flex-col gap-4">
        {/* Card A – Doctor Assisted */}
        <Button
          onClick={() => setSelectedMode('doctor_assisted')}
          className={cn(
            'relative bg-white rounded-card p-5 text-left transition-smooth w-full',
            selectedMode === 'doctor_assisted'
              ? 'border-2 border-sage-400 shadow-sm'
              : 'border-2 border-cream-200'
          )}
        >
          {selectedMode === 'doctor_assisted' && (
            <span className="absolute top-3 right-3 bg-sage-400 text-white text-xs px-2 py-0.5 rounded-pill">
              推荐
            </span>
          )}
          <Stethoscope className="w-8 h-8 text-sage-400" />
          <h3 className="text-lg font-semibold text-foreground mt-3">
            医生辅助录入
          </h3>
          <p className="text-sm text-muted mt-2">
            医生边询问家长边录入答案，适合门诊问诊场景。
          </p>
          {selectedMode === 'doctor_assisted' && (
            <div className="mt-3 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-sage-500" />
              <span className="text-sm text-sage-600 font-medium">已选择</span>
            </div>
          )}
        </Button>

        {/* Card B – Caregiver Handoff */}
        <Button
          onClick={() => setSelectedMode('caregiver_handoff_locked')}
          className={cn(
            'relative bg-white rounded-card p-5 text-left transition-smooth w-full',
            selectedMode === 'caregiver_handoff_locked'
              ? 'border-2 border-sage-400 shadow-sm'
              : 'border-2 border-cream-200'
          )}
        >
          <div className="flex items-start justify-between">
            <Smartphone className="w-8 h-8 text-sky-400" />
            <Lock className="w-4 h-4 text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mt-3">
            家长接过手机填写
          </h3>
          <p className="text-sm text-muted mt-2">
            进入锁定模式，家长只能完成当前测评，填写完毕后需医生PIN确认。
          </p>
          {selectedMode === 'caregiver_handoff_locked' && (
            <div className="mt-3 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-sage-500" />
              <span className="text-sm text-sage-600 font-medium">已选择</span>
            </div>
          )}
        </Button>
      </div>

      {/* Confirm */}
      <Button
        onClick={handleConfirm}
        className={cn(
          'mt-6 w-full h-button bg-sage-400 text-white rounded-button font-medium text-base',
          'active:opacity-90 transition-smooth'
        )}
      >
        确认并开始
      </Button>
    </section>
  );
};

export default FillModeSelectorScreen;
