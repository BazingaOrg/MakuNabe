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
      if (v) str += (str ? ' ' : '') + v
    }
    return str
  }
  let str = ''
  for (const key of Object.keys(mix)) {
    if ((mix as ClassDictionary)[key]) str += (str ? ' ' : '') + key
  }
  return str
}

export default function classNames (...args: ClassValue[]): string {
  let str = ''
  for (const a of args) {
    const v = parse(a)
    if (v) str += (str ? ' ' : '') + v
  }
  return str
}
