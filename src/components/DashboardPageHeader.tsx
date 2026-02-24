import React from "react";

interface DashboardPageHeaderProps {
    title: string;
    description: string;
    children?: React.ReactNode;
}

export function DashboardPageHeader({ title, description, children }: DashboardPageHeaderProps) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                <p className="text-muted-foreground">{description}</p>
            </div>
            {children && (
                <div className="flex items-center shrink-0 gap-2">
                    {children}
                </div>
            )}
        </div>
    )
}
