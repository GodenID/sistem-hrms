import { useEffect, useRef, useState } from 'react'
import { animate, useMotionValue } from 'framer-motion'

export default function AnimatedNumber({
  value,
  duration = 0.6,
  decimals = 0,
  className,
  format,
}) {
  const motionValue = useMotionValue(value)
  const [display, setDisplay] = useState(() =>
    formatVal(value, decimals, format)
  )
  const prevRef = useRef(value)

  useEffect(() => {
    const from = prevRef.current
    const to = value
    if (from === to) {
      setDisplay(formatVal(to, decimals, format))
      return
    }
    const controls = animate(motionValue, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        setDisplay(formatVal(latest, decimals, format))
      },
      onComplete: () => {
        setDisplay(formatVal(to, decimals, format))
      },
    })
    prevRef.current = to
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, decimals])

  return <span className={className}>{display}</span>
}

function formatVal(val, decimals, format) {
  const factor = Math.pow(10, decimals)
  const rounded = Math.round(val * factor) / factor
  if (format) return format(rounded)
  if (decimals === 0) return rounded.toLocaleString('id-ID')
  return rounded.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
