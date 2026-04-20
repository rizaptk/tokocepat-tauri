import { ReactNode } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface SplitPanelLayoutProps {
    header?: ReactNode
    children: ReactNode
    footer?: ReactNode
    className?: string
    bodyClassName?: string
    scroll?: boolean
}

export function SplitPanelLayout({
    header,
    children,
    footer,
    className,
    bodyClassName,
    scroll = true,
}: SplitPanelLayoutProps) {
    return (
        <div className={cn("flex flex-col h-full", className)}>
            {/* Header */}
            {header && (
                <div className="shrink-0 border-b">
                    {header}
                </div>
            )}

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {scroll ? (
                    <ScrollArea className="h-full">
                        <div className={cn("p-6", bodyClassName)}>
                            {children}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className={cn("h-full p-4", bodyClassName)}>
                        {children}
                    </div>
                )}
            </div>

            {/* Footer */}
            {footer && (
                <div className="shrink-0 border-t p-4 bg-background">
                    {footer}
                </div>
            )}
        </div>
    )
}