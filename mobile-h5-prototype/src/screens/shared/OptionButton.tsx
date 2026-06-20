import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Option } from '@/types';

export interface OptionButtonProps {
  option: Option;
  selected: boolean;
  onSelect: (option: Option) => void;
  disabled?: boolean;
}

const OptionButton: React.FC<OptionButtonProps> = ({
  option,
  selected,
  onSelect,
  disabled = false,
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(option)}
      className={cn(
        'option-press min-h-option w-full flex items-center gap-4 px-4 py-3 rounded-button border-2 transition-smooth text-left',
        selected
          ? 'bg-sage-50 border-sage-300'
          : 'bg-white border-cream-200',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {/* Circular radio indicator */}
      <span
        className={cn(
          'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-smooth',
          selected
            ? 'border-sage-400 bg-sage-400'
            : 'border-cream-300 bg-transparent',
        )}
      >
        {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      </span>

      {/* Option label */}
      <span className="text-base text-foreground">{option.label}</span>
    </button>
  );
};

export default OptionButton;
