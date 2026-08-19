// Zero-dependency build: reads <slug>/meta.json for every talk folder,
// derives href, sorts by date desc, and stages everything (content +
// generated talks.json) into dist/ for the deploy workflow to sync.
//
// - type "html": folder has index.html + assets. href = /materiais/<slug>/
// - type "file": folder has exactly one non-meta file (PDF/PPTX). href points at it.
// - type "link": no local content. meta.json must set href directly.
import { readdirSync, statSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const SKIP_DIRS = new Set(['.git', '.github', 'scripts', 'dist', 'node_modules'])

rmSync(DIST, { recursive: true, force: true })
mkdirSync(DIST, { recursive: true })

const slugs = readdirSync(ROOT).filter((name) => {
  if (SKIP_DIRS.has(name) || name.startsWith('.')) return false
  return statSync(join(ROOT, name)).isDirectory()
})

const talks = []

for (const slug of slugs) {
  const dir = join(ROOT, slug)
  const metaPath = join(dir, 'meta.json')
  let meta
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf8'))
  } catch {
    console.warn(`skip ${slug}: no valid meta.json`)
    continue
  }

  let href = meta.href
  if (meta.type === 'html') {
    href = `/materiais/${slug}/`
    cpSync(dir, join(DIST, slug), { recursive: true, filter: (src) => !src.endsWith('meta.json') })
  } else if (meta.type === 'file') {
    const files = readdirSync(dir).filter((f) => f !== 'meta.json')
    if (files.length !== 1) {
      throw new Error(`${slug}: type "file" needs exactly one non-meta file, found ${files.length}`)
    }
    href = `/materiais/${slug}/${files[0]}`
    cpSync(dir, join(DIST, slug), { recursive: true, filter: (src) => !src.endsWith('meta.json') })
  } else if (meta.type === 'link') {
    if (!href) throw new Error(`${slug}: type "link" requires "href" in meta.json`)
  } else {
    throw new Error(`${slug}: unknown type "${meta.type}"`)
  }

  talks.push({
    title: meta.title,
    date: meta.dateLabel || meta.date,
    description: meta.description,
    href,
    sortDate: meta.date,
  })
}

talks.sort((a, b) => (a.sortDate < b.sortDate ? 1 : -1))
for (const t of talks) delete t.sortDate

writeFileSync(join(DIST, 'talks.json'), JSON.stringify(talks, null, 2) + '\n')
console.log(`Built dist/talks.json with ${talks.length} entries.`)
