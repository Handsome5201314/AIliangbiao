import React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs) {
  return twMerge(clsx(inputs))
}

const buttonVariants = {
  default: 'bg-sage-500 text-white hover:bg-sage-600 active:scale-[0.98]',
  secondary: 'bg-cream-100 text-foreground hover:bg-cream-200',
  outline: 'border-2 border-cream-300 text-foreground hover:border-sage-200 hover:bg-sage-50',
  ghost: 'text-foreground hover:bg-cream-100',
  destructive: 'bg-destructive text-white hover:bg-red-400',
}

const sizes = {
  default: 'h-button px-5 text-base',
  sm: 'h-9 px-3 text-sm',
  lg: 'h-12 px-6 text-lg',
  icon: 'h-11 w-11',
}

export const Button = React.forwardRef(({
  className,
  variant = 'default',
  size = 'default',
  children,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-button font-medium transition-smooth min-h-touch disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-sage-500 focus-visible:outline-offset-2',
        buttonVariants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})
Button.displayName = 'Button'

export { buttonVariants, cn }
