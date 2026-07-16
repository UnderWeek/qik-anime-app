import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Lightbox({ src, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="lightbox" onClick={onClose}>
      <img src={src} alt="изображение" onClick={(e) => e.stopPropagation()} />
    </div>,
    document.body
  )
}
