import React, { createContext, useContext, useCallback, useMemo, useState, useRef } from 'react'
import ToastContainer from '../components/Toast'

const ToastContext = createContext(null)

function generateId() {
  return `tst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counterRef = useRef(0)

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = generateId()
    counterRef.current += 1
    const order = counterRef.current
    setToasts((prev) => [...prev, { id, type, message, duration, order }])
    return id
  }, [])

  const success = useCallback((message, duration) => showToast(message, 'success', duration), [showToast])
  const error = useCallback((message, duration) => showToast(message, 'error', duration), [showToast])
  const warning = useCallback((message, duration) => showToast(message, 'warning', duration), [showToast])
  const info = useCallback((message, duration) => showToast(message, 'info', duration), [showToast])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const value = useMemo(() => ({
    showToast,
    success,
    error,
    warning,
    info,
  }), [showToast, success, error, warning, info])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
