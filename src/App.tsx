import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ExpenseListPage from "./pages/ExpenseListPage";
import ExpenseFormPage from "./pages/ExpenseFormPage";
import CreateGroupPage from "./pages/CreateGroupPage";
import RelationshipDrillPage from "./pages/RelationshipDrillPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <p>Loading…</p>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.displayName || user.displayName.trim() === "") {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />

        {/* ── dashboard (home) ── */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* ── level 2: friend drill ── */}
        <Route
          path="/friend/:userId"
          element={
            <ProtectedRoute>
              <RelationshipDrillPage mode="friend" />
            </ProtectedRoute>
          }
        />

        {/* ── level 2: group drill ── */}
        <Route
          path="/group/:groupId"
          element={
            <ProtectedRoute>
              <RelationshipDrillPage mode="group" />
            </ProtectedRoute>
          }
        />

        {/* ── expense form ── */}
        <Route
          path="/expense/new"
          element={
            <ProtectedRoute>
              <ExpenseFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expense/:id/edit"
          element={
            <ProtectedRoute>
              <ExpenseFormPage />
            </ProtectedRoute>
          }
        />

        {/* ── create group ── */}
        <Route
          path="/group/new"
          element={
            <ProtectedRoute>
              <CreateGroupPage />
            </ProtectedRoute>
          }
        />

        {/* ── expense list (fallback) ── */}
        <Route
          path="/expenses"
          element={
            <ProtectedRoute>
              <ExpenseListPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;