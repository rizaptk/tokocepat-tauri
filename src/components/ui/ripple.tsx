import * as React from "react";
import { cn } from "@/lib/utils";

type Ripple = {
  id: number;
  x: number;
  y: number;
  size: number;
};

type RippleProps = {
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  rippleClassName?: string; // allow theme override if needed
  duration?: number;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

export const Ripple = React.forwardRef<HTMLDivElement, RippleProps>(
  (
    {
      children,
      disabled = false,
      className,
      rippleClassName,
      duration = 400,
      onClick,
    },
    ref
  ) => {
    const [ripples, setRipples] = React.useState<Ripple[]>([]);

    const createRipple = (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;

      const rect = e.currentTarget.getBoundingClientRect();

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = Math.max(rect.width, rect.height) * 1.5;

      const newRipple: Ripple = {
        id: Date.now(),
        x,
        y,
        size,
      };

      setRipples([newRipple]);

      setTimeout(() => setRipples([]), duration);
    };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      createRipple(e);
      onClick?.(e);
    };

    return (
      <div
        ref={ref}
        className={cn("relative bg-transparent", className)}
        onClick={handleClick}
      >
        {/* Ripple layer */}
        <div className="w-full h-full absolute z-20 pointer-events-none overflow-hidden">
            <span className="absolute inset-0 pointer-events-none z-30">
            {ripples.map((ripple) => (
                <span
                key={ripple.id}
                className={cn(
                    "absolute rounded-full animate-[ripple_var(--ripple-duration)_ease-out]",
                    "bg-primary/30 dark:bg-primary/40", // 🔥 shadcn theme aware
                    rippleClassName
                )}
                style={
                    {
                    width: ripple.size,
                    height: ripple.size,
                    left: ripple.x - ripple.size / 2,
                    top: ripple.y - ripple.size / 2,
                    "--ripple-duration": `${duration}ms`,
                    } as React.CSSProperties
                }
                />
            ))}
            </span>
        </div>

        {children}
      </div>
    );
  }
);

Ripple.displayName = "Ripple";