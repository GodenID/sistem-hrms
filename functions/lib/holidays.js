import * as core from './core.js'
const { json, ApiError, toCamel, toCamelList, makeId, normalizeTime, countDays, publicUser, isAdminUser, isSuperadminUser, b64uEncode, b64uDecode, hmacKey, signToken, verifyToken, pgReq, buildParams, selectRows, insertRow, updateRows, upsertRows, deleteRows, notify, requireAuth, requireAdmin, requireSuperadmin, isActorSuperadmin, clientIp, countRecentFailures, recordLoginAttempt, enforceLoginRateLimit, writeAudit, auditCtxStrict, auditCtx, s3Client, s3Base, parsePhotoDataUrl, s3UploadAvatar, s3DeleteAvatar, envOf, PUBLIC_FIELDS, haversine, assertClockLocation } = core
async function fetchApiHolidays(year) {
  const sources = [
    {
      url: `https://api-hari-libur.vercel.app/api?year=${year}`,
      map: (h) => ({ date: h?.date, name: h?.description }),
    },
  ]
  for (const src of sources) {
    try {
      const res = await fetch(src.url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const body = await res.json()
      const data = Array.isArray(body) ? body : body?.data
      if (!Array.isArray(data) || data.length === 0) continue
      return data
        .filter((h) => typeof src.map(h).date === 'string' && src.map(h).date.startsWith(`${year}-`))
        .map((h) => ({
          id: makeId('hol'),
          date: src.map(h).date,
          name: src.map(h).name || 'Hari Libur Nasional',
          category: 'nasional',
          isGlobal: true,
        }))
    } catch {
      continue
    }
  }
  try {
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/ID`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`Nager API ${res.status}`)
    const data = await res.json()
    if (!Array.isArray(data)) throw new Error('Respons tidak valid')
    return data.map((h) => ({
      id: makeId('hol'),
      date: h.date,
      name: h.localName || h.name,
      category: 'nasional',
      isGlobal: h.global !== false,
    }))
  } catch {
    return []
  }
}

async function ensureApiHolidays(env, year) {
  const existing = await selectRows(env, 'holidays', {
    select: 'id',
    filter: [
      { col: 'source', value: 'api' },
      { col: 'date', op: 'gte', value: `${year}-01-01` },
      { col: 'date', op: 'lte', value: `${year}-12-31` },
    ],
  })
  if (existing.length > 0) return
  const api = await fetchApiHolidays(year)
  const inserted = new Set()
  for (const h of api) {
    await insertRow(env, 'holidays', {
      id: h.id,
      date: h.date,
      name: h.name,
      category: h.category,
      source: 'api',
      is_custom: false,
      is_global: h.isGlobal,
    })
    inserted.add(h.date)
  }
  for (const [monthday, name] of Object.entries(FALLBACK_HOLIDAYS)) {
    const [mm, dd] = monthday.split('-')
    const date = `${year}-${mm}-${dd}`
    if (inserted.has(date)) continue
    await insertRow(env, 'holidays', {
      id: makeId('hol'),
      date,
      name,
      category: 'nasional',
      source: 'fallback',
      is_custom: false,
      is_global: true,
    })
  }
}

async function holidaysList(context, query) {
  const { from, to, year } = query
  const y = Number(year || new Date().getFullYear())
  // Auto-sync: selalu pastikan data API untuk tahun yang diminta tersedia (tanpa perlu refresh manual)
  // ensureApiHolidays akan no-op jika sudah ada data untuk tahun tersebut.
  try {
    await ensureApiHolidays(envOf(context), y)
  } catch {}
  const rows = await selectRows(envOf(context), 'holidays', {
    select: '*',
    filter: [
      { col: 'date', op: 'gte', value: from || `${y}-01-01` },
      { col: 'date', op: 'lte', value: to || `${y}-12-31` },
    ],
    order: 'date.asc',
  })
  return json({ holidays: toCamelList(rows) })
}

async function holidaysCreate(context, body) {
  const { date, name, category } = body
  if (!date || !name?.trim()) throw new ApiError('Tanggal dan nama wajib diisi', 400)
  const base = await selectRows(envOf(context), 'holidays', {
    select: 'id',
    filter: [{ col: 'is_custom', value: 'false' }, { col: 'date', value: date }],
  })
  if (base.length > 0) throw new ApiError('Tanggal sudah ada di libur nasional', 400)
  const existing = await selectRows(envOf(context), 'holidays', {
    select: 'id',
    filter: [{ col: 'is_custom', value: 'true' }, { col: 'date', value: date }],
  })
  if (existing.length > 0) throw new ApiError('Tanggal ini sudah dibuat sebagai custom', 400)
  const id = makeId('hol')
  const created = await insertRow(envOf(context), 'holidays', {
    id,
    date,
    name: name.trim(),
    category: category || 'nasional',
    source: 'custom',
    is_custom: true,
    is_global: true,
  })
  await auditCtx(context, 'holidays.create', 'holiday', id, { date, name: name.trim() })
  return json({ holiday: toCamel(created) }, 201)
}

async function holidaysUpdate(context, id, body) {
  const { name, category } = body
  const rows = await selectRows(envOf(context), 'holidays', {
    select: '*',
    filter: [{ col: 'id', value: id }, { col: 'is_custom', value: 'true' }],
  })
  if (rows.length === 0) throw new ApiError('Custom holiday tidak ditemukan', 404)
  const patch = {}
  if (name !== undefined) patch.name = name
  if (category !== undefined) patch.category = category
  if (Object.keys(patch).length > 0) {
    await updateRows(envOf(context), 'holidays', [{ col: 'id', value: id }], patch)
  }
  await auditCtx(context, 'holidays.update', 'holiday', id, patch)
  const updated = await selectRows(envOf(context), 'holidays', {
    select: '*',
    filter: [{ col: 'id', value: id }],
  })
  return json({ holiday: toCamel(updated[0]) })
}

async function holidaysDelete(context, id) {
  await deleteRows(envOf(context), 'holidays', [{ col: 'id', value: id }, { col: 'is_custom', value: 'true' }])
  await auditCtx(context, 'holidays.delete', 'holiday', id, {})
  return json({ ok: true })
}

// ---------- OKR ROUTES ----------


export { fetchApiHolidays, ensureApiHolidays, holidaysList, holidaysCreate, holidaysUpdate, holidaysDelete }

