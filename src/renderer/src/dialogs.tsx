import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'
import { t } from './i18n'
import { errorMessage } from './lib/format'

function createStore<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next: T) {
      value = next
      listeners.forEach((l) => l())
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    }
  }
}

// ---------- Eingabedialog ----------

export interface PromptOptions {
  title: string
  label: string
  defaultValue?: string
  placeholder?: string
  confirmLabel: string
  checkbox?: { label: string; defaultChecked: boolean }
  validate?: (value: string) => string | null
}

export interface PromptResult {
  value: string
  checked: boolean
}

type PromptRequest = PromptOptions & { resolve: (r: PromptResult | null) => void }

const promptStore = createStore<PromptRequest | null>(null)

export function prompt(options: PromptOptions): Promise<PromptResult | null> {
  return new Promise((resolve) => promptStore.set({ ...options, resolve }))
}

export const validateBranchName = (v: string): string | null =>
  !v.trim() ? t.dialogs.enterName : /[\s~^:?*[\\]|\.\.|@\{|\/$|\.lock$|^-/.test(v) ? t.dialogs.invalidBranchName : null

function PromptDialog({ request }: { request: PromptRequest }) {
  const [value, setValue] = useState(request.defaultValue ?? '')
  const [checked, setChecked] = useState(request.checkbox?.defaultChecked ?? false)
  const inputRef = useRef<HTMLInputElement>(null)
  const error = request.validate?.(value) ?? null

  useEffect(() => inputRef.current?.select(), [])

  const close = (result: PromptResult | null) => {
    promptStore.set(null)
    request.resolve(result)
  }
  const submit = () => {
    if (!error) close({ value: value.trim(), checked })
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => close(null)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{request.title}</h2>
        <label className="field">
          <span>{request.label}</span>
          <input
            ref={inputRef}
            value={value}
            placeholder={request.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') close(null)
            }}
          />
        </label>
        {value && error && <div className="field-error">{error}</div>}
        {request.checkbox && (
          <label className="checkbox">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            {request.checkbox.label}
          </label>
        )}
        <div className="modal-actions">
          <button onClick={() => close(null)}>{t.common.cancel}</button>
          <button className="primary" disabled={!!error} onClick={submit}>
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DialogHost() {
  const request = useSyncExternalStore(promptStore.subscribe, promptStore.get)
  return request ? <PromptDialog key={request.title + request.label} request={request} /> : null
}

// ---------- Benachrichtigungen ----------

interface Toast {
  id: number
  kind: 'error' | 'info'
  text: string
}

const toastStore = createStore<Toast[]>([])
let toastId = 0

function removeToast(id: number) {
  toastStore.set(toastStore.get().filter((t) => t.id !== id))
}

export function notifyError(e: unknown) {
  toastStore.set([...toastStore.get(), { id: ++toastId, kind: 'error', text: errorMessage(e) }])
}

export function notify(text: string) {
  const id = ++toastId
  toastStore.set([...toastStore.get(), { id, kind: 'info', text }])
  setTimeout(() => removeToast(id), 3000)
}

export function ToastHost() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.get)
  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.kind}`}>
          <pre>{toast.text}</pre>
          <button className="icon" title={t.common.close} onClick={() => removeToast(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
