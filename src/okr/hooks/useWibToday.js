import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getTodayDateString, msUntilNextWibMidnight } from '../lib/dateUtils'

export function useWibToday() {
  const [today, setToday] = useState(() => getTodayDateString())
  const todayRef = useRef(today)
  todayRef.current = today

  useEffect(() => {
    let timeoutId = null

    const checkRollover = () => {
      const fresh = getTodayDateString()
      if (fresh !== todayRef.current) {
        setToday(fresh)
        toast.success('Selamat pagi! Hari baru sudah dimulai 🌅', {
          duration: 6000,
        })
      }
    }

    const scheduleNext = () => {
      const delay = msUntilNextWibMidnight() + 1500
      timeoutId = setTimeout(() => {
        checkRollover()
        scheduleNext()
      }, delay)
    }

    scheduleNext()

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkRollover()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', checkRollover)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', checkRollover)
    }
  }, [])

  return today
}
