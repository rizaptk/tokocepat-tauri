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
import DashboardReportsInventory from './pages/Dashboard/reports/inventory/page'
import DashboardReportsShifts from './pages/Dashboard/reports/shifts/page'
import DashboardReportsStockMovement from './pages/Dashboard/reports/stock-movement/page'
import DashboardReportsConsumption from './pages/Dashboard/reports/consumption/page'
import DashboardReportsStockSummary from './pages/Dashboard/reports/stock-summary/page'
import DashboardReportsVoid from './pages/Dashboard/reports/void/page'
import DashboardSettings from './pages/Dashboard/settings/page'
import DashboardShiftDetail from './pages/Dashboard/shifts/[id]/page'

import LicensePage from './pages/Dashboard/settings/License'

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
          <Route path="dashboard/reports/inventory" element={<DashboardReportsInventory />} />
          <Route path="dashboard/reports/shifts" element={<DashboardReportsShifts />} />
          <Route path="dashboard/reports/stock-movement" element={<DashboardReportsStockMovement />} />
          <Route path="dashboard/reports/consumption" element={<DashboardReportsConsumption />} />
          <Route path="dashboard/reports/stock-summary" element={<DashboardReportsStockSummary />} />
          <Route path="dashboard/reports/void" element={<DashboardReportsVoid />} />
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