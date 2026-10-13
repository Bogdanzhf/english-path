import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { toString } from 'mdast-util-to-string'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'

// Каждая строка курса после разбора Markdown не должна показывать звёздочки как текст
// (например, «I**'m working**» — выделение вплотную к апострофу не срабатывает).

const DATA = join(__dirname, '..', '..', 'public', 'data')
const md = unified().use(remarkParse).use(remarkGfm)

function collect(o: unknown, path: string, out: { path: string; text: string }[]) {
  if (typeof o === 'string') {
    if (o.includes('*')) out.push({ path, text: o })
  } else if (Array.isArray(o)) o.forEach((v, i) => collect(v, `${path}[${i}]`, out))
  else if (o && typeof o === 'object')
    for (const [k, v] of Object.entries(o)) {
      if (k === 'text' && typeof v === 'string' && v.includes('[[')) continue // пропуски [[*верно/неверно]]
      collect(v, `${path}.${k}`, out)
    }
}

describe('markdown in course content', () => {
  it('renders without literal asterisks', () => {
    const strings: { path: string; text: string }[] = []
    for (const f of readdirSync(DATA)) collect(JSON.parse(readFileSync(join(DATA, f), 'utf8')), f, strings)
    expect(strings.length).toBeGreaterThan(1000)
    const broken = strings.filter((s) => toString(md.parse(s.text)).includes('*')).map((s) => `${s.path}: ${s.text.slice(0, 120)}`)
    expect(broken).toEqual([])
  })
})
