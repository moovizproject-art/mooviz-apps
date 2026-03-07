import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, useAuthProvider, AuthProvider } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import UserDetailPage from './pages/UserDetailPage';
import DeliveriesPage from './pages/DeliveriesPage';
import DeliveryDetailPage from './pages/DeliveryDetailPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import EmailPage from './pages/EmailPage';
import MigrationPage from './pages/MigrationPage';
import ChatsPage from './pages/ChatsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:userId" element={<UserDetailPage />} />
        <Route path="deliveries" element={<DeliveriesPage />} />
        <Route path="deliveries/:deliveryId" element={<DeliveryDetailPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="chats" element={<ChatsPage />} />
        <Route path="email" element={<EmailPage />} />
        <Route path="migration" element={<MigrationPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const authState = useAuthProvider();

  return (
    <AuthProvider value={authState}>
      <AppRoutes />
    </AuthProvider>
  );
}
