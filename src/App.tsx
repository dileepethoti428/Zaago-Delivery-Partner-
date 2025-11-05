import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Splash from './pages/Splash';
import Login from './pages/Login';
import Home from './pages/Home';
import OrderDetails from './pages/OrderDetails';
import Earnings from './pages/Earnings';
import Profile from './pages/Profile';

function App() {
  return (
    <BrowserRouter>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<Navigate to="/splash" replace />} />
          <Route path="/splash" element={<Splash />} />
          <Route path="/login" element={<Login />} />
          <Route path="/home" element={<Home />} />
          <Route path="/order/:id" element={<OrderDetails />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </AnimatePresence>
    </BrowserRouter>
  );
}

export default App;
