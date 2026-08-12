import React from 'react'
import { OkrAuthProvider } from './contexts/AuthContext'
import { UserProvider } from './contexts/UserContext'
import { InputProvider } from './contexts/InputContext'
import { Toaster } from './components/ui/sonner'
import MobileBottomNav from './components/MobileBottomNav'
import ErrorBoundary from './components/ErrorBoundary'
import Footer from './components/Footer'

export default function OkrLayout({ children }) {
  return (
    <div className="okr-root min-h-screen bg-background">
      <OkrAuthProvider>
        <UserProvider>
          <InputProvider>
            <ErrorBoundary>{children}</ErrorBoundary>
            <Footer />
            <MobileBottomNav />
          </InputProvider>
        </UserProvider>
      </OkrAuthProvider>
      <Toaster />
    </div>
  )
}
