"use client"

import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

export interface ScrollAreaHandle {
  getScrollTop(): number
  getScrollBottom(): number,
  subscribe: (cb: () => void) => () => void
}

const ScrollArea = React.forwardRef<
  ScrollAreaHandle,
  // React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => {

  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const listenersRef = React.useRef(new Set<() => void>())

  const tickingRef = React.useRef(false)

  const handleScroll = React.useCallback(() => {
    if (tickingRef.current) return

    tickingRef.current = true

    requestAnimationFrame(() => {
      listenersRef.current.forEach(cb => cb())
      tickingRef.current = false
    })
  }, [])

  React.useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  React.useImperativeHandle(ref, () => ({
    getScrollTop: () => {
      return viewportRef.current?.scrollTop ?? 0
    },
    getScrollBottom: () => {
      if (!viewportRef.current) return 0
      const el = viewportRef.current
      return el.scrollHeight - el.clientHeight - el.scrollTop
    },
    subscribe: (cb: () => void) => {
      listenersRef.current.add(cb)
      return () => {
        listenersRef.current.delete(cb)
      }
    }
  }))

  return (
    <ScrollAreaPrimitive.Root
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]" ref={viewportRef}>
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
})
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
      "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
      "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
