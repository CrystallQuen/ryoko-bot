import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Moderation from './pages/Moderation';
import Welcome from './pages/Welcome';
import Roles from './pages/Roles';
import Events from './pages/Events';
import Games from './pages/Games';
import Settings from './pages/Settings';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-discord-darkest">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-discord-blurple border-t-transparent rounded-full animate-spin" />
          <p className="text-discord-light">Chargement...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-discord-darkest">
        <div className="w-12 h-12 border-4 border-discord-blurple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path=":guildId/moderation" element={<Moderation />} />
        <Route path=":guildId/welcome" element={<Welcome />} />
        <Route path=":guildId/roles" element={<Roles />} />
        <Route path=":guildId/events" element={<Events />} />
        <Route path=":guildId/games" element={<Games />} />
        <Route path=":guildId/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
