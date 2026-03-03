'use client'

import React from "react"
import { ScrollAreaHandle } from "./scroll-area"
import { cn } from "@/lib/utils"

interface ScrollShadowProps {
  scrollRef: React.RefObject<ScrollAreaHandle | null>
  side: "top" | "bottom" | "both"
  className?: string
}

const ScrollShadow = React.memo(({ scrollRef, side, className }: ScrollShadowProps) => {
  const topRef = React.useRef<HTMLDivElement>(null)
  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!scrollRef.current) return

    return scrollRef.current.subscribe(() => {
      if (!scrollRef.current) return

      if (topRef.current && (side === "top" || side === "both")) {
        topRef.current.style.opacity = scrollRef.current.getScrollTop() > 0 ? "1" : "0"
      }

      if (bottomRef.current && (side === "bottom" || side === "both")) {
        bottomRef.current.style.opacity = scrollRef.current.getScrollBottom() > 0 ? "1" : "0"
      }
    })
  }, [scrollRef, side])

  const shadowClass = "absolute z-10 left-2 right-2 h-0 border-b shadow transition-opacity duration-150 pointer-events-none opacity-0"

  return (
    <>
      {(side === "top" || side === "both") && (
        <div
          ref={topRef}
          className={cn(shadowClass, "top-0", className)}
        />
      )}
      {(side === "bottom" || side === "both") && (
        <div
          ref={bottomRef}
          className={cn(shadowClass, "bottom-0", className)}
        />
      )}
    </>
  )
})
ScrollShadow.displayName = "ScrollShadow"

export { ScrollShadow }