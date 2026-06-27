import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/components/mobile-h5/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap transition-smooth focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-400 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-sage-400 text-white hover:bg-sage-500 shadow-sm',
        secondary:
          'bg-sage-50 text-sage-700 hover:bg-sage-100',
        outline:
          'border-2 border-sage-200 bg-transparent text-sage-600 hover:bg-sage-50',
        ghost:
          'bg-transparent text-foreground hover:bg-sage-50',
        destructive:
          'bg-red-500 text-white hover:bg-red-600 shadow-sm',
      },
      size: {
        default:
          'h-button px-6 rounded-button text-base font-medium',
        sm:
          'h-9 px-4 rounded-button text-sm',
        lg:
          'h-14 px-8 rounded-button text-lg',
        icon:
          'h-touch w-touch rounded-button',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';

export { Button, buttonVariants };
