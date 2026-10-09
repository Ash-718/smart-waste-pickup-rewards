import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import PickupQueuePage from "./pages/PickupQueuePage";
import PickupDetailPage from "./pages/PickupDetailPage";
import ImpactDashboardPage from "./pages/ImpactDashboardPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import UsersPage from "./pages/UsersPage";
import RewardsBadgesPage from "./pages/RewardsBadgesPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<ImpactDashboardPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/queue" element={<PickupQueuePage />} />
              <Route path="/queue/:id" element={<PickupDetailPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/rewards-badges" element={<RewardsBadgesPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
