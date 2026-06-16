import React from 'react'
import { MessageCircleQuestion } from 'lucide-react'

export default function AiAssistantFab({ onClick, visible = true }) {
  if (!visible) return null

  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-24 right-4 z-40 flex items-center gap-2 px-4 py-3 rounded-pill bg-sage-500 text-white shadow-lg hover:bg-sage-600 active:scale-95 transition-smooth min-h-touch safe-bottom"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <MessageCircleQuestion className="w-5 h-5" />
      <span className="text-sm font-medium">问问AI</span>
    </button>
  )
}
