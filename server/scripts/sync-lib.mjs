// ============================================================
// Sync logic bisnis dari functions/lib/* ke server/src/gen/*.
//
// functions/lib adalah SATU-SATUNYA sumber kebenaran. File-file di
// server/src/gen JANGAN diedit manual — selalu hasil generate.
// Yang di-rewrite hanya import './core.js' → './core-pg.js' supaya
// query DB lewat Postgres langsung (pg), bukan PostgREST/Supabase.
// core-pg.js sendiri ditulis tangan (ada di server/src/).
// ============================================================

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const srcDir = path.join(repoRoot, 'functions', 'lib')
const dstDir = path.join(repoRoot, 'server', 'src', 'gen')

await mkdir(dstDir, { recursive: true })

const files = (await readdir(srcDir)).filter((f) => f.endsWith('.js') && f !== 'core.js')
let count = 0
for (const f of files) {
  let code = await readFile(path.join(srcDir, f), 'utf8')
  code = code.replaceAll(`from './core.js'`, `from '../core-pg.js'`)
  const header =
    `// AUTO-GENERATED dari functions/lib/${f} — JANGAN edit manual.\n` +
    `// Regenerasi: npm run sync (di folder server/).\n`
  await writeFile(path.join(dstDir, f), header + code)
  count++
}
console.log(`[sync-lib] ${count} file di-sync ke server/src/gen/`)
