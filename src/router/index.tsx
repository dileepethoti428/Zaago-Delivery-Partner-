import { createBrowserRouter, Navigate } from 'react-router-dom';
import Splash from '@/pages/Splash';
import Login from '@/pages/Login';
import Home from '@/pages/Home';
import OrderDetails from '@/pages/OrderDetails';
import ManageDelivery from '@/pages/ManageDelivery';
import DeliveryHistory from '@/pages/DeliveryHistory';
import Earnings from '@/pages/Earnings';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import UploadDocuments from '@/pages/UploadDocuments';
import PendingApproval from '@/pages/PendingApproval';
import Rejected from '@/pages/Rejected';
import MyDeliveries from '@/pages/MyDeliveries';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { RequireApproval } from '@/components/auth/RequireApproval';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/splash" replace />,
  },
  {
    path: '/splash',
    element: <Splash />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/upload-documents',
        element: <UploadDocuments />,
      },
      {
        path: '/pending-approval',
        element: <PendingApproval />,
      },
      {
        path: '/rejected',
        element: <Rejected />,
      },
      {
        element: <RequireApproval />,
        children: [
          {
            path: '/my-deliveries',
            element: <MyDeliveries />,
            // Keep this route alive - preload and maintain state (default landing)
            loader: async () => {
              return { keepAlive: true, preload: true };
            },
          },
          {
            path: '/home',
            element: <Home />,
          },
          {
            path: '/history',
            element: <DeliveryHistory />,
          },
          {
            path: '/order/:id',
            element: <OrderDetails />,
          },
          {
            path: '/manage-delivery/:id',
            element: <ManageDelivery />,
          },
          {
            path: '/earnings',
            element: <Earnings />,
          },
          {
            path: '/profile',
            element: <Profile />,
          },
          {
            path: '/settings',
            element: <Settings />,
          },
        ],
      },
    ],
  },
]);
