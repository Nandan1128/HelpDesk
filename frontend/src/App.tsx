import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, AdminRoute, PublicRoute } from '@/components/auth';
import { Layout } from '@/components/layout';
import {
  HomePage,
  LoginPage,
  TicketsPage,
  TicketDetailPage,
  UsersPage,
} from '@/pages';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes (accessible only when not logged in) */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Protected routes (require valid Better Auth session) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />

            {/* Admin-only routes */}
            <Route element={<AdminRoute />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>
          </Route>
        </Route>

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
