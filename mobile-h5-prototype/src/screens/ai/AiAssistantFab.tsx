import React from 'react';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiAssistantFabProps {
  onClick: () => void;
  visible: boolean;
}

const AiAssistantFab: React.FC<AiAssistantFabProps> = ({ onClick, visible }) => {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-24 right-4 z-40',
        'flex flex-col items-center justify-center',
        'w-14 h-14 rounded-full',
        'bg-sage-400 shadow-lg',
        'text-white',
        'animate-fade-in',
        'active:scale-95 transition-transform',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="问问AI"
      data-component="ai-fab"
    >
      <MessageCircle className="w-5 h-5 text-white" />
      <span className="text-xs font-medium text-white leading-none mt-0.5">
        问问AI
      </span>
    </button>
  );
};

export default AiAssistantFab;
