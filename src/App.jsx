import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
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
import OkrLayout from './okr/OkrLayout'
import OkrDashboardPage from './okr/pages/DashboardPage'
import OkrTeamPage from './okr/pages/TeamPage'
import OkrStatsPage from './okr/pages/StatsPage'
import OkrHistoryPage from './okr/pages/HistoryPage'
import OkrAdminPage from './okr/pages/admin/AdminPage'
import OkrUsersPage from './okr/pages/admin/UsersPage'
import OkrMonitoringPage from './okr/pages/admin/MonitoringPage'
import OkrAdminInputPage from './okr/pages/admin/AdminInputPage'
import OkrEmployeeDetailPage from './okr/pages/admin/EmployeeDetailPage'

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
            <OkrLayout>
              <OkrDashboardPage />
            </OkrLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/okr/team"
        element={
          <ProtectedRoute>
            <OkrLayout>
              <OkrTeamPage />
            </OkrLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/okr/stats"
        element={
          <ProtectedRoute>
            <OkrLayout>
              <OkrStatsPage />
            </OkrLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/okr/history"
        element={
          <ProtectedRoute>
            <OkrLayout>
              <OkrHistoryPage />
            </OkrLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/okr/admin"
        element={
          <ProtectedRoute>
            <OkrLayout>
              <OkrAdminPage />
            </OkrLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/okr/admin/users"
        element={
          <ProtectedRoute>
            <OkrLayout>
              <OkrUsersPage />
            </OkrLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/okr/admin/monitoring"
        element={
          <ProtectedRoute>
            <OkrLayout>
              <OkrMonitoringPage />
            </OkrLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/okr/admin/input"
        element={
          <ProtectedRoute>
            <OkrLayout>
              <OkrAdminInputPage />
            </OkrLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/okr/admin/employee/:username"
        element={
          <ProtectedRoute>
            <OkrLayout>
              <OkrEmployeeDetailPage />
            </OkrLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ClockProvider>
          <EventsProvider>
            <PengajuanProvider>
              <AnnouncementsProvider>
                <HolidaysProvider>
                  <LocationProvider>
                  <NotificationsProvider>
                    <BrowserRouter>
                      <AppRoutes />
                    </BrowserRouter>
                  </NotificationsProvider>
                  </LocationProvider>
                </HolidaysProvider>
              </AnnouncementsProvider>
            </PengajuanProvider>
          </EventsProvider>
        </ClockProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
