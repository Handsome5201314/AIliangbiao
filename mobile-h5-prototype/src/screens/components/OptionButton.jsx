import React from 'react'
import { Check } from 'lucide-react'

export default function OptionButton({ option, selected, onSelect, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(option)}
      disabled={disabled}
      className={`
        w-full flex items-center gap-3 px-4 py-3.5 min-h-option
        rounded-button border-2 text-left text-base
        transition-smooth active:option-press
        disabled:opacity-50 disabled:cursor-not-allowed
        ${selected
          ? 'border-sage-400 bg-sage-50 text-sage-700'
          : 'border-cream-300 bg-white text-foreground hover:border-sage-200'
        }
      `}
    >
      <span
        className={`
          flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
          transition-smooth
          ${selected ? 'border-sage-500 bg-sage-500' : 'border-cream-400 bg-cream-50'}
        `}
      >
        {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      </span>
      <span className="flex-1" style={{ wordBreak: 'break-word' }}>{option.label}</span>
    </button>
  )
}
