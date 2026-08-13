import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import RootLayout from './layouts/RootLayout'
import HomePage from './pages/HomePage'
import ActivationPage from './pages/ActivationPage'
import CashierPage from './pages/CashierPage'
import InventoryPage from './pages/InventoryPage'

// Dashboard pages
import DashboardHome from './pages/Dashboard/page'
import DashboardReports from './pages/Dashboard/reports/page'
import DashboardReportsSales from './pages/Dashboard/reports/sales/page'
import DashboardReportsShifts from './pages/Dashboard/reports/shifts/page'
import DashboardReportsStockMovement from './pages/Dashboard/reports/stock-movement/page'
import DashboardReportsStockSummary from './pages/Dashboard/reports/stock-summary/page'
import DashboardReportsVoid from './pages/Dashboard/reports/void/page'
import DashboardSettings from './pages/Dashboard/settings/page'
import DashboardShiftDetail from './pages/Dashboard/shifts/[id]/page'
import AuditReportPage from './pages/Dashboard/reports/profits/page'
import TaxReportPage from './pages/Dashboard/reports/tax/page'
import ConsignmentReportPage from './pages/Dashboard/reports/consignments/page'

import LicensePage from './pages/Dashboard/settings/License'
import PromosPage from './pages/Dashboard/promos/page'

// Product pages
import ProductLayout from './pages/Product/layout'
import ProductHome from './pages/Product/page'

function App() {
  return (
    <Router>
      <Routes>
        {/* Main POS */}
        <Route path="/" element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="aktivasi" element={<ActivationPage />} /> 
          <Route path="cashier" element={<CashierPage />} />
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
          <Route path="dashboard/promos" element={<PromosPage />} />
          <Route path="dashboard/settings" element={<DashboardSettings />} />
          <Route path="dashboard/shifts/:id" element={<DashboardShiftDetail />} />

          {/* Product routes */}
          <Route path="product" element={<ProductLayout children={<ProductHome />} />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App