import * as core from './core.js'
const { json, ApiError, toCamel, toCamelList, makeId, normalizeTime, countDays, publicUser, isAdminUser, isSuperadminUser, b64uEncode, b64uDecode, hmacKey, signToken, verifyToken, pgReq, buildParams, selectRows, insertRow, updateRows, upsertRows, deleteRows, notify, requireAuth, requireAdmin, requireSuperadmin, isActorSuperadmin, clientIp, countRecentFailures, recordLoginAttempt, enforceLoginRateLimit, writeAudit, auditCtxStrict, auditCtx, s3Client, s3Base, parsePhotoDataUrl, s3UploadAvatar, s3DeleteAvatar, envOf, PUBLIC_FIELDS, haversine, assertClockLocation } = core
async function getPOThresholds(env) {
  const rows = await selectRows(env, 'settings', {
    select: 'value',
    filter: [{ col: 'key', value: 'po_thresholds' }],
  })
  return rows[0]?.value || { kecilMax: 50000000, menengahMax: 200000000 }
}

function computePOCategory(amount, thresholds) {
  const a = Number(amount || 0)
  if (a <= 0) return null
  if (a <= thresholds.kecilMax) return 'kecil'
  if (a <= thresholds.menengahMax) return 'menengah'
  return 'besar'
}

// ---------- EVENTS ROUTES ----------

async function eventsList(context) {
  const rows = await selectRows(envOf(context), 'events', {
    select: '*',
    order: 'created_at.desc',
    limit: 500,
  })
  const thresholds = await getPOThresholds(envOf(context))
  return json({
    events: toCamelList(rows).map((e) => ({
      ...e,
      poCategory: e.poCategory || computePOCategory(e.poAmount, thresholds),
    })),
  })
}

async function eventsCreate(context, body) {
const user = context.user
  const { name, startDate, endDate, location, status, poAmount, manpower, additionalCosts } = body
  if (!name?.trim() || !startDate) throw new ApiError('Nama event dan tanggal mulai wajib diisi', 400)
  const thresholds = await getPOThresholds(envOf(context))
  const s = status === 'pending' ? 'pending' : 'approved'
  const id = makeId('evt')
  const created = await insertRow(envOf(context), 'events', {
    id,
    name: name.trim(),
    start_date: startDate,
    end_date: endDate || startDate,
    location: location || null,
    created_by: user.sub,
    status: s,
    po_amount: Number(poAmount || 0),
    po_category: computePOCategory(poAmount, thresholds) || 'kecil',
    manpower: manpower || [],
    additional_costs: additionalCosts || [],
  })

  const others = await selectRows(envOf(context), 'users', {
    select: 'id, user_type, role',
    filter: [{ col: 'id', op: 'neq', value: user.sub }],
  })
  const targetIds =
    s === 'pending'
      ? others.filter((u) => u.user_type === 'admin' || u.role === 'admin').map((r) => r.id)
      : others.map((r) => r.id)
  await notify(
    envOf(context),
    targetIds,
    'event',
    `Event Baru: ${name.trim()}`,
    `${startDate}${endDate && endDate !== startDate ? ' – ' + endDate : ''}${location ? ' · ' + location : ''}`,
    id,
    'event',
    '/events'
  )
  await writeAudit(envOf(context), user, 'events.create', 'event', id, {
    name: name.trim(),
    startDate,
    endDate: endDate || startDate,
    status: s,
  })
  return json({ event: toCamel(created) }, 201)
}

async function eventsUpdate(context, id, body) {
  const rows = await selectRows(envOf(context), 'events', {
    select: '*',
    filter: [{ col: 'id', value: id }],
  })
  const existing = rows[0]
  if (!existing) throw new ApiError('Event tidak ditemukan', 404)

  const prevStatus = existing.status
  const { name, startDate, endDate, location, status, poAmount, poCategory, manpower, additionalCosts, reviewedByName } = body
  const thresholds = await getPOThresholds(envOf(context))
  const poAmt = poAmount !== undefined ? Number(poAmount) : existing.po_amount
  const cat = poCategory || computePOCategory(poAmt, thresholds) || existing.po_category

  const patch = {}
  if (name !== undefined) patch.name = name
  if (startDate !== undefined) patch.start_date = startDate
  if (endDate !== undefined) patch.end_date = endDate
  if (location !== undefined) patch.location = location
  if (status !== undefined) patch.status = status
  patch.po_amount = poAmt
  patch.po_category = cat
  if (manpower !== undefined) patch.manpower = manpower
  if (additionalCosts !== undefined) patch.additional_costs = additionalCosts
  if (reviewedByName !== undefined) patch.reviewed_by_name = reviewedByName
  patch.updated_at = new Date().toISOString()
  await updateRows(envOf(context), 'events', [{ col: 'id', value: id }], patch)
  await auditCtx(context, 'events.update', 'event', id, { name: existing.name, patch })

  const newStatus = status ?? existing.status
  if (existing.created_by && prevStatus !== newStatus) {
    const isPending = newStatus === 'pending'
    const isApproved = newStatus === 'approved'
    const isRejected = newStatus === 'rejected'
    if (!isPending) {
      const label = isApproved ? 'disetujui' : isRejected ? 'ditolak' : newStatus
      await notify(
        envOf(context),
        [existing.created_by],
        'event',
        `Event ${label}: ${existing.name}`,
        `Status event Anda "${existing.name}" sekarang ${label} oleh admin.`,
        existing.id,
        'event',
        `/events/${existing.id}`
      )
    }
  }

  const updated = await selectRows(envOf(context), 'events', {
    select: '*',
    filter: [{ col: 'id', value: id }],
  })
  return json({ event: { ...toCamel(updated[0]), poCategory: cat } })
}

async function eventsDelete(context, id) {
  const rows = await selectRows(envOf(context), 'events', {
    select: 'id',
    filter: [{ col: 'id', value: id }],
  })
  if (rows.length === 0) throw new ApiError('Event tidak ditemukan', 404)
  await deleteRows(envOf(context), 'vouchers', [{ col: 'event_id', value: id }])
  await deleteRows(envOf(context), 'events', [{ col: 'id', value: id }])
  await auditCtx(context, 'events.delete', 'event', id, {})
  return json({ ok: true })
}

async function vouchersList(context, eventId) {
  const rows = await selectRows(envOf(context), 'vouchers', {
    select: '*',
    filter: [{ col: 'event_id', value: eventId }],
    order: 'created_at.asc',
  })
  return json({ vouchers: toCamelList(rows) })
}

async function vouchersCreate(context, eventId, body) {
  const { name, roles } = body
  if (!name?.trim()) throw new ApiError('Nama voucher wajib diisi', 400)
  const id = makeId('vcr')
  const created = await insertRow(envOf(context), 'vouchers', {
    id,
    event_id: eventId,
    name: name.trim(),
    roles: roles || [],
  })
  return json({ voucher: toCamel(created) }, 201)
}

async function vouchersUpdate(context, eventId, voucherId, body) {
  const { name, roles } = body
  const patch = {}
  if (name !== undefined) patch.name = name
  if (roles !== undefined) patch.roles = roles
  if (Object.keys(patch).length > 0) {
    await updateRows(
      envOf(context),
      'vouchers',
      [{ col: 'id', value: voucherId }, { col: 'event_id', value: eventId }],
      patch
    )
  }
  const row = await selectRows(envOf(context), 'vouchers', {
    select: '*',
    filter: [{ col: 'id', value: voucherId }],
  })
  return json({ voucher: toCamel(row[0]) })
}

async function vouchersDelete(context, eventId, voucherId) {
  await deleteRows(
    envOf(context),
    'vouchers',
    [{ col: 'id', value: voucherId }, { col: 'event_id', value: eventId }]
  )
  return json({ ok: true })
}

async function eventsThresholdsGet(context) {
  const t = await getPOThresholds(envOf(context))
  return json({ thresholds: t })
}

async function eventsThresholdsPut(context, body) {
const user = context.user
  const { kecilMax, menengahMax } = body
  await upsertRows(
    envOf(context),
    'settings',
    { key: 'po_thresholds', value: { kecilMax: Number(kecilMax), menengahMax: Number(menengahMax) } },
    'key'
  )
  await writeAudit(envOf(context), user, 'events.thresholds', 'settings', 'po_thresholds', {
    kecilMax: Number(kecilMax),
    menengahMax: Number(menengahMax),
  })
  const row = await selectRows(envOf(context), 'settings', {
    select: 'value',
    filter: [{ col: 'key', value: 'po_thresholds' }],
  })
  return json({ thresholds: row[0].value })
}

// ---------- NOTIFICATIONS ROUTES ----------


export { getPOThresholds, computePOCategory, eventsList, eventsCreate, eventsUpdate, eventsDelete, vouchersList, vouchersCreate, vouchersUpdate, vouchersDelete, eventsThresholdsGet, eventsThresholdsPut }

