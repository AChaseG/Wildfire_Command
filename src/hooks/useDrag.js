import { useCallback, useEffect, useRef, useState } from 'react'

export function useDrag(initialPos = { x: 100, y: 100 }) {
  const [pos, setPos] = useState(initialPos)
  const dragging = useRef(false)
  const origin = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    dragging.current = true
    origin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
  }, [pos])

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return
      const dx = e.clientX - origin.current.mx
      const dy = e.clientY - origin.current.my
      setPos({
        x: Math.max(0, origin.current.px + dx),
        y: Math.max(0, origin.current.py + dy),
      })
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  return { pos, setPos, handleMouseDown }
}
