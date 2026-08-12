import { useEffect } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useAuth } from '../contexts/AuthContext'

const TOUR_STORAGE_KEY = 'dit_onboarding_seen'

export default function OnboardingTour({ tourId, steps }) {
  const { currentUser } = useAuth()

  useEffect(() => {
    if (!currentUser) return
    if (typeof window === 'undefined') return

    const key = `${TOUR_STORAGE_KEY}_${currentUser.username}_${tourId}`
    let seen = false
    try {
      seen = localStorage.getItem(key) === '1'
    } catch {
      // storage unavailable — run the tour anyway
    }
    if (seen) return

    const driverObj = driver({
      showProgress: true,
      allowClose: true,
      steps: steps,
      nextBtnText: 'Lanjut →',
      prevBtnText: '← Kembali',
      doneBtnText: 'Selesai',
      onDestroyed: () => {
        try {
          localStorage.setItem(key, '1')
        } catch {
          // best-effort persistence
        }
      },
    })

    const timer = setTimeout(() => {
      try {
        driverObj.drive()
      } catch {
        // non-essential
      }
    }, 500)

    return () => {
      clearTimeout(timer)
      try {
        driverObj.destroy()
      } catch {
        // ignore
      }
    }
  }, [currentUser, tourId, steps])

  return null
}

export function resetOnboardingTour(username, tourId) {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(`${TOUR_STORAGE_KEY}_${username}_${tourId}`)
  } catch {
    // ignore
  }
}
