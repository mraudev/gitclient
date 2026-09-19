/** Initialen aus dem Namen: "Michael Rau" → "MR", "mraudev" → "M" */
function initials(name: string): string {
  const words = name.trim().split(/[\s._-]+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/** Feste Farbe je Person, abgeleitet aus der E-Mail (bzw. dem Namen, falls keine E-Mail) */
function hue(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return h % 360
}

interface Props {
  name: string
  email?: string
  size?: number
}

/** Lokaler Avatar (Initialen auf farbigem Kreis) – ohne Anfragen an externe Dienste */
export function Avatar({ name, email, size = 16 }: Props) {
  const key = (email || name).toLowerCase()
  return (
    <span
      className="avatar"
      title={email ? `${name} <${email}>` : name}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: `hsl(${hue(key)} 50% 42%)`
      }}
    >
      {initials(name)}
    </span>
  )
}
