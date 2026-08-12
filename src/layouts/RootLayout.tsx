import { Outlet } from 'react-router-dom'
import '../globals.css'
import { Toaster } from "@/components/ui/toaster"
import { MobileChecker } from '@/components/MobileChecker'
import ClientLayout from '@/components/ClientLayout'
import PrinterDetector from '@/components/PrintChecker'
import { PrinterMonitor } from '@/components/PrinterMonitor'
import { useDbStore } from '@/lib/db-store'
import { useEffect } from 'react'


export default function RootLayout() {
  const isTauri = typeof window !== 'undefined' && "__TAURI_INTERNALS__" in window;
  const { isInitialized, initialize } = useDbStore();

  useEffect(() => {
    if (!isInitialized) {
      (async () => {
        await initialize();
      })();
    }
  }, [initialize, isInitialized]);

  if (!isInitialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-sm text-muted-foreground">Loading Configuration...</div>
      </div>
    )
  }

  return (
    <div className="font-body antialiased">
      <MobileChecker />
      <ClientLayout>
        <Outlet />
      </ClientLayout>
      <Toaster />
      {isTauri && isInitialized &&
        <>
          <PrinterDetector />
          <PrinterMonitor />
        </>
      }
    </div>
  )
}
