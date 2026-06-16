import { useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

let _addToast = null

export function useToast() {
  const toast = useCallback(({ message, variant = 'default' }) => {
    _addToast?.({ message, variant, id: Date.now() })
  }, [])
  return { toast }
}

export function Toaster() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    _addToast = (t) => {
      setToasts(prev => [...prev, t])
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3500)
    }
    return () => { _addToast = null }
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg',
            t.variant === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-green-200 bg-green-50 text-green-800',
          )}
        >
          <span>{t.message}</span>
          <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="ml-auto opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
