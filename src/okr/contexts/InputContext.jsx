import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { toast } from 'sonner'
import { api } from '../../services/api'
import { getTodayDateString } from '../lib/dateUtils'
import { useWibToday } from '../hooks/useWibToday'
import { useAuth } from './AuthContext'

const InputContext = createContext(undefined)

export function InputProvider({ children }) {
  const [inputList, setInputListState] = useState([])
  const [storageError, setStorageError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const { currentUser } = useAuth()

  const todayDate = useWibToday()

  const loadItems = useCallback(async () => {
    if (!currentUser) return
    try {
      const res = await api(`/okr/inputs?username=${encodeURIComponent(currentUser.username)}&date=${todayDate}`)
      setInputListState(res.inputs || [])
    } catch (err) {
      setStorageError('Gagal memuat data')
      console.error('Gagal memuat input OKR:', err.message)
    }
  }, [currentUser, todayDate])

  useEffect(() => {
    if (!currentUser) {
      setInputListState([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setStorageError(null)
    loadItems().finally(() => setIsLoading(false))
  }, [currentUser, todayDate, loadItems])

  const addItem = useCallback(
    async (data) => {
      const todayAtSubmit = getTodayDateString()
      if (todayAtSubmit !== todayDate) {
        toast.error('Hari telah berganti. Silakan refresh untuk melanjutkan.')
        return false
      }

      const payload = {
        username: currentUser?.username,
        workDate: todayDate,
        title: data.title,
        description: data.description || '',
        jobId: data.jobId || null,
        jobLabel: data.jobLabel || null,
        nominalIDR: data.nominalIDR ?? null,
        customerKind: data.customerKind ?? null,
      }

      try {
        const res = await api('/okr/inputs', { method: 'POST', body: payload })
        setInputListState((prev) => [res.item, ...(prev || [])])
        toast.success('Input berhasil ditambahkan')
        return true
      } catch (err) {
        setStorageError('Gagal menyimpan data')
        toast.error(err.message || 'Gagal menyimpan data')
        return false
      }
    },
    [currentUser, todayDate]
  )

  const updateItem = useCallback(
    async (id, data) => {
      try {
        const res = await api(`/okr/inputs/${id}`, {
          method: 'PUT',
          body: {
            title: data.title,
            description: data.description || '',
            jobId: data.jobId || null,
            jobLabel: data.jobLabel || null,
            nominalIDR: data.nominalIDR ?? null,
            customerKind: data.customerKind ?? null,
          },
        })
        setInputListState((prev) =>
          prev.map((item) => (item.id === id ? res.item : item))
        )
        toast.success('Input berhasil diperbarui')
        return true
      } catch (err) {
        setStorageError('Gagal menyimpan data')
        toast.error(err.message || 'Gagal menyimpan data')
        return false
      }
    },
    []
  )

  const deleteItem = useCallback(
    async (id) => {
      try {
        await api(`/okr/inputs/${id}`, { method: 'DELETE' })
        setInputListState((prev) => prev.filter((item) => item.id !== id))
        toast.success('Input berhasil dihapus')
        return true
      } catch (err) {
        setStorageError('Gagal menghapus data')
        toast.error(err.message || 'Gagal menghapus data')
        return false
      }
    },
    []
  )

  const clearStorageError = useCallback(() => {
    setStorageError(null)
  }, [])

  const value = {
    inputList,
    storageError,
    isLoading,
    addItem,
    updateItem,
    deleteItem,
    clearStorageError,
  }

  return (
    <InputContext.Provider value={value}>{children}</InputContext.Provider>
  )
}

export function useInput() {
  const context = useContext(InputContext)
  if (context === undefined) {
    throw new Error('useInput must be used within an InputProvider')
  }
  return context
}