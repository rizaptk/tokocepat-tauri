"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

// Create a context to share the active tab value
const TabsContext = React.createContext<{ activeTab?: string, layoutId?: string}>({
  activeTab: undefined,
  layoutId: undefined,
});

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> & { layoutId?: string }
>(({ value, defaultValue, layoutId = "unique_tab_indicator", onValueChange, ...props }, ref) => {
  // Determine if the component is controlled or uncontrolled
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState(defaultValue);

  const activeTab = isControlled ? value : internalValue;

  const handleValueChange = (val: string) => {
    if (!isControlled) {
      setInternalValue(val);
    }
    onValueChange?.(val);
  };

  return (
    <TabsContext.Provider value={{ activeTab, layoutId }}>
      <TabsPrimitive.Root
        ref={ref}
        value={isControlled ? activeTab : undefined}
        defaultValue={!isControlled ? activeTab : undefined}
        onValueChange={handleValueChange}
        {...props}
      />
    </TabsContext.Provider>
  );
});
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  // Ensure 'value' is part of the props type
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { value: string; "data-danger"?: boolean }
>(({ className, value, children, ...props }, ref) => {
  const { activeTab, layoutId} = React.useContext(TabsContext);
  const isActive = activeTab === value;

  const isDanger = props["data-danger"] ?? false;

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(
        "relative inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive ? "text-primary-foreground! [&_svg]:text-primary-foreground opacity-100" : "opacity-60 hover:opacity-100",
        className
      )}
      {...props}
    >
      <span className="relative z-10 flex items-center">{children}</span>
      {isActive && (
        <motion.div
          layoutId={layoutId}
          className={`absolute inset-0 z-0 rounded-sm ${isDanger ? 'bg-destructive' : 'bg-primary'} shadow-sm`}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent }
