import React from 'react';
import { ChevronLeft, ClipboardList, Clock } from 'lucide-react';
import { cn } from '@/components/mobile-h5/lib/utils';
import type { Scale } from '@/components/mobile-h5/types';

export interface DoctorScalePickerScreenProps {
  scales: Scale[];
  onSelectScale: (scale: Scale) => void;
  onBack: () => void;
}

const DoctorScalePickerScreen: React.FC<DoctorScalePickerScreenProps> = ({
  scales,
  onSelectScale,
  onBack,
}) => {
  const [loading] = React.useState(false);

  if (loading) {
    return (
      <section data-component="doctor-scale-picker" className="px-5 py-4">
        <div className="skeleton h-8 w-32 mb-4" />
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-card" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section data-component="doctor-scale-picker" className="px-5 py-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-11 h-11 flex items-center justify-center -ml-2 rounded-full active:bg-cream-200 transition-smooth"
          aria-label="返回"
        >
          <ChevronLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">选择量表</h1>
      </div>
      <p className="text-xs text-muted mt-2">仅显示儿童临床量表</p>

      {/* Scale list */}
      <div className="mt-4 flex flex-col gap-3">
        {scales.map((scale) => (
          <div
            key={scale.id}
            className="bg-white rounded-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium text-foreground">
                    {scale.name}
                  </span>
                  <span className="bg-cream-200 text-muted text-xs px-2 py-0.5 rounded-pill">
                    {scale.questionCount}题
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-sm text-muted">
                  <span className="flex items-center gap-1">
                    <ClipboardList className="w-3.5 h-3.5" />
                    {scale.ageRange}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {scale.duration}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => onSelectScale(scale)}
                className={cn(
                  'px-5 h-9 bg-sage-400 text-white text-sm font-medium rounded-button',
                  'active:opacity-90 transition-smooth'
                )}
              >
                选择
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default DoctorScalePickerScreen;
