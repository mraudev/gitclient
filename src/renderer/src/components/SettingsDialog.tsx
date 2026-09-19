import { useState } from 'react'
import type { Language } from '../../../shared/types'
import { getLanguage, LANGUAGES, setLanguage, t } from '../i18n'

/** Einstellungsdialog (Datei → Einstellungen…). Änderungen werden erst mit "Speichern" übernommen. */
export function SettingsDialog({ onClose }: { onClose(): void }) {
  const [language, setLanguageChoice] = useState<Language>(getLanguage())

  const save = () => {
    onClose()
    setLanguage(language)
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          if (e.key === 'Enter') save()
        }}
      >
        <h2>{t.settings.title}</h2>
        <label className="field">
          <span>{t.settings.language}</span>
          <select autoFocus value={language} onChange={(e) => setLanguageChoice(e.target.value as Language)}>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-actions">
          <button onClick={onClose}>{t.common.cancel}</button>
          <button className="primary" onClick={save}>
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  )
}
