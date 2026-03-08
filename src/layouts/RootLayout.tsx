import { Outlet } from 'react-router-dom'
import '../globals.css'
import { Toaster } from "@/components/ui/toaster"
import { MobileChecker } from '@/components/MobileChecker'
import ClientLayout from '@/components/ClientLayout'

export default function RootLayout() {
  return (
    <div className="font-body antialiased">
      <MobileChecker />
      <ClientLayout>
        <Outlet />
      </ClientLayout>
      <Toaster />
    </div>
  )
}
