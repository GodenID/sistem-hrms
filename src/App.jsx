import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { UsersProvider } from './context/UsersContext'
import { LeaveProvider } from './context/LeaveContext'
import { ClockProvider } from './context/ClockContext'
import { EventsProvider } from './context/EventsContext'
import { PengajuanProvider } from './context/PengajuanContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { AnnouncementsProvider } from './context/AnnouncementsContext'
import { HolidaysProvider } from './context/HolidaysContext'
import { LocationProvider } from './context/LocationContext'
import { ToastProvider } from './context/ToastContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import DashboardPage from './pages/DashboardPage'
import AbsensiPage from './pages/AbsensiPage'
import EventsPage from './pages/EventsPage'
import EventDetailPage from './pages/EventDetailPage'
import PengajuanPage from './pages/PengajuanPage'
import SettingsPage from './pages/SettingsPage'
import AdminPage from './pages/AdminPage'
import DirectoryPage from './pages/DirectoryPage'
import CalendarPage from './pages/CalendarPage'
import JobDashboardPage from './jobs/DashboardPage'
import JobHistoryPage from './jobs/HistoryPage'
import NotFoundPage from './pages/NotFoundPage'
import ErrorBoundary from './components/ErrorBoundary'
import PWAUpdatePrompt from './components/PWAUpdatePrompt'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Navigate to="/" replace /> : children
}

function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { isLoading } = useAuth()
  // Saat bootstrap sesi masih berjalan, jangan render route sama sekali —
  // kalau tidak, PublicRoute/ProtectedRoute sempat me-redirect ke /login
  // lalu melompat balik (layar login berkedip) padahal sudah login.
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Memuat…</p>
        </div>
      </div>
    )
  }
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/absensi"
        element={
          <ProtectedRoute>
            <AbsensiPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events"
        element={
          <ProtectedRoute>
            <EventsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:id"
        element={
          <ProtectedRoute>
            <EventDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pengajuan"
        element={
          <ProtectedRoute>
            <PengajuanPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
      <Route
        path="/directory"
        element={
          <ProtectedRoute>
            <DirectoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/okr"
        element={
          <ProtectedRoute>
            <JobDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/okr/history"
        element={
          <ProtectedRoute>
            <JobHistoryPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
      <AuthProvider>
        <UsersProvider>
          <LeaveProvider>
            <ClockProvider>
              <EventsProvider>
                <PengajuanProvider>
                  <AnnouncementsProvider>
                    <HolidaysProvider>
                      <LocationProvider>
                      <NotificationsProvider>
                        <BrowserRouter>
                          <AppRoutes />
                          <PWAUpdatePrompt />
                        </BrowserRouter>
                      </NotificationsProvider>
                      </LocationProvider>
                    </HolidaysProvider>
                  </AnnouncementsProvider>
                </PengajuanProvider>
              </EventsProvider>
            </ClockProvider>
          </LeaveProvider>
        </UsersProvider>
      </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
