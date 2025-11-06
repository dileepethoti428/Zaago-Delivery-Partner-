import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Splash from './pages/Splash';
import Login from './pages/Login';
import Home from './pages/Home';
import OrderDetails from './pages/OrderDetails';
import ManageDelivery from './pages/ManageDelivery';
import DeliveryHistory from './pages/DeliveryHistory';
import Earnings from './pages/Earnings';
import Profile from './pages/Profile';
import UploadDocuments from './pages/UploadDocuments';
import PendingApproval from './pages/PendingApproval';
import Rejected from './pages/Rejected';
import { RequireAuth } from './components/auth/RequireAuth';
import { RequireApproval } from './components/auth/RequireApproval';

function App() {
  return (
    <BrowserRouter>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<Navigate to="/splash" replace />} />
          <Route path="/splash" element={<Splash />} />
          <Route path="/login" element={<Login />} />
          
          {/* Auth-required routes */}
          <Route element={<RequireAuth />}>
            <Route path="/upload-documents" element={<UploadDocuments />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/rejected" element={<Rejected />} />
            
            {/* Approval-required routes */}
            <Route element={<RequireApproval />}>
              <Route path="/home" element={<Home />} />
              <Route path="/history" element={<DeliveryHistory />} />
              <Route path="/order/:id" element={<OrderDetails />} />
              <Route path="/manage-delivery/:id" element={<ManageDelivery />} />
              <Route path="/earnings" element={<Earnings />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>
        </Routes>
      </AnimatePresence>
    </BrowserRouter>
  );
}

export default App;
