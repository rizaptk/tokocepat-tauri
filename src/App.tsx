import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import RootLayout from './layouts/RootLayout'
import HomePage from './pages/HomePage'
import CashierPage from './pages/CashierPage'
import InventoryPage from './pages/InventoryPage'

// Main POS route — the counter is where you arrive and must never wait.
// Dashboard/Product/auxiliary surfaces are lazy so the initial bundle stays lean.
const ActivationPage = lazy(() => import('./pages/ActivationPage'))
const DashboardHome = lazy(() => import('./pages/Dashboard/page'))
const DashboardReports = lazy(() => import('./pages/Dashboard/reports/page'))
const DashboardReportsSales = lazy(() => import('./pages/Dashboard/reports/sales/page'))
const DashboardReportsShifts = lazy(() => import('./pages/Dashboard/reports/shifts/page'))
const DashboardReportsStockMovement = lazy(() => import('./pages/Dashboard/reports/stock-movement/page'))
const DashboardReportsStockSummary = lazy(() => import('./pages/Dashboard/reports/stock-summary/page'))
const DashboardReportsVoid = lazy(() => import('./pages/Dashboard/reports/void/page'))
const DashboardSettings = lazy(() => import('./pages/Dashboard/settings/page'))
const DashboardShiftDetail = lazy(() => import('./pages/Dashboard/shifts/[id]/page'))
const AuditReportPage = lazy(() => import('./pages/Dashboard/reports/profits/page'))
const TaxReportPage = lazy(() => import('./pages/Dashboard/reports/tax/page'))
const ConsignmentReportPage = lazy(() => import('./pages/Dashboard/reports/consignments/page'))
const PromoReportPage = lazy(() => import('./pages/Dashboard/reports/promos/page'))
const LicensePage = lazy(() => import('./pages/Dashboard/settings/License'))
const PromosPage = lazy(() => import('./pages/Dashboard/promos/page'))
const CustomersPage = lazy(() => import('./pages/Dashboard/customers/page'))
const PiutangPage = lazy(() => import('./pages/Dashboard/piutang/page'))
const WholesaleCashierPage = lazy(() => import('./pages/WholesaleCashierPage'))
const ProductLayout = lazy(() => import('./pages/Product/layout'))
const ProductHome = lazy(() => import('./pages/Product/page'))

function App() {
  return (
    <Router>
      <Suspense fallback={<RootLoading />}>
        <Routes>
          {/* Main POS */}
          <Route path="/" element={<RootLayout />}>
            <Route index element={<HomePage />} />
            <Route path="aktivasi" element={<ActivationPage />} />
            <Route path="cashier" element={<CashierPage />} />
            <Route path="cashier/grosir" element={<WholesaleCashierPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="license" element={<LicensePage />} />

            {/* Dashboard routes */}
            <Route path="dashboard" element={<DashboardHome />} />
            <Route path="dashboard/reports" element={<DashboardReports />} />
            <Route path="dashboard/reports/sales" element={<DashboardReportsSales />} />
            <Route path="dashboard/reports/shifts" element={<DashboardReportsShifts />} />
            <Route path="dashboard/reports/stock-movement" element={<DashboardReportsStockMovement />} />
            <Route path="dashboard/reports/stock-summary" element={<DashboardReportsStockSummary />} />
            <Route path="dashboard/reports/void" element={<DashboardReportsVoid />} />
            <Route path="dashboard/reports/profit" element={<AuditReportPage />} />
            <Route path="dashboard/reports/tax" element={<TaxReportPage />} />
            <Route path="dashboard/reports/consignments" element={<ConsignmentReportPage />} />
            <Route path="dashboard/reports/promos" element={<PromoReportPage />} />
            <Route path="dashboard/promos" element={<PromosPage />} />
            <Route path="dashboard/customers" element={<CustomersPage />} />
            <Route path="dashboard/piutang" element={<PiutangPage />} />
            <Route path="dashboard/settings" element={<DashboardSettings />} />
            <Route path="dashboard/shifts/:id" element={<DashboardShiftDetail />} />

            {/* Product routes */}
            <Route path="product" element={<ProductLayout children={<ProductHome />} />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  )
}

function RootLoading() {
  return <div className="flex h-screen w-full items-center justify-center bg-background" />
}

export default App