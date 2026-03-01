import * as React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const inputVariants = cva(
  // Base classes (removed h-10, px-3, border from here to avoid conflicts with variants)
  "flex w-full bg-background text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-colors",
  {
    variants: {
      variant: {
        default: "border-input bg-background text-foreground",
        destructive: "border-destructive text-destructive focus-visible:ring-destructive",
        secondary: "bg-secondary border-secondary text-secondary-foreground",
      },
      shape: {
        normal: "rounded-md",
        rectangle: "rounded-none",
        full: "rounded-full",
      },
      borderWidth: {
        default: "border",
        "0": "border-0",
        "1": "border",
        "2": "border-2",
      },
      size: {
        default: "h-10 px-3 py-2",
        sm: "h-8 px-2 py-1 text-xs",
        lg: "h-12 px-4 py-3 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      shape: "normal",
      borderWidth: "default",
      size: "default",
    },
  }
)

// We Omit 'size' from React.InputHTMLAttributes because CVA's 'size' (string) 
// conflicts with the native HTML 'size' attribute (number).
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, shape, borderWidth, size, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          inputVariants({ variant, shape, borderWidth, size, className })
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input, inputVariants }