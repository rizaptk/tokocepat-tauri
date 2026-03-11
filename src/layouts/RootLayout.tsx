import { Outlet } from 'react-router-dom'
import '../globals.css'
import { Toaster } from "@/components/ui/toaster"
import { MobileChecker } from '@/components/MobileChecker'
import ClientLayout from '@/components/ClientLayout'
import PrinterDetector from '@/components/PrintChecker'

export default function RootLayout() {
  const isTauri = typeof window !== 'undefined' && "__TAURI_INTERNALS__" in window;
  return (
    <div className="font-body antialiased">
      <MobileChecker />
      <ClientLayout>
        <Outlet />
      </ClientLayout>
      <Toaster />
      { isTauri &&  <PrinterDetector />}
    </div>
  )
}
