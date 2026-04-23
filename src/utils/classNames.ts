type ClassDictionary = Record<string, unknown>
export type ClassValue =
  | ClassDictionary
  | ClassValue[]
  | string
  | number
  | boolean
  | null
  | undefined

function parse (mix: ClassValue): string {
  if (mix == null || typeof mix === 'boolean') return ''
  if (typeof mix === 'string' || typeof mix === 'number') return String(mix)
  if (Array.isArray(mix)) {
    let str = ''
    for (const m of mix) {
      const v = parse(m)
      if (v.length > 0) str += (str.length > 0 ? ' ' : '') + v
    }
    return str
  }
  let str = ''
  for (const key of Object.keys(mix)) {
    const value = mix[key]
    if (value != null && value !== false && value !== 0 && value !== '') str += (str.length > 0 ? ' ' : '') + key
  }
  return str
}

export default function classNames (...args: ClassValue[]): string {
  let str = ''
  for (const a of args) {
    const v = parse(a)
    if (v.length > 0) str += (str.length > 0 ? ' ' : '') + v
  }
  return str
}
