import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_LEFT = 200
const MAX_LEFT = 600
const MIN_RIGHT = 260
const MAX_RIGHT = 600

export function useResizablePanels() {
  const [leftW, setLeftW] = useState(320)
  const [rightW, setRightW] = useState(380)
  const resizingRef = useRef(null) // 'left' | 'right' | null
  const startRef = useRef({ x: 0, leftW: 0, rightW: 0 })

  const startResizeLeft = useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    resizingRef.current = 'left'
    startRef.current = { x: e.clientX, leftW, rightW }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [leftW, rightW])

  const startResizeRight = useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    resizingRef.current = 'right'
    startRef.current = { x: e.clientX, leftW, rightW }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [leftW, rightW])

  useEffect(() => {
    const onMove = (e) => {
      if (!resizingRef.current) return
      const dx = e.clientX - startRef.current.x
      if (resizingRef.current === 'left') {
        setLeftW(Math.max(MIN_LEFT, Math.min(MAX_LEFT, startRef.current.leftW + dx)))
      } else {
        setRightW(Math.max(MIN_RIGHT, Math.min(MAX_RIGHT, startRef.current.rightW - dx)))
      }
    }
    const onUp = () => {
      if (!resizingRef.current) return
      resizingRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  return { leftW, rightW, startResizeLeft, startResizeRight }
}
