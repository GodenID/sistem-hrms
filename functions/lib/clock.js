import * as core from './core.js'
const { json, ApiError, toCamel, toCamelList, makeId, normalizeTime, wibNow, countDays, publicUser, isAdminUser, isSuperadminUser, b64uEncode, b64uDecode, hmacKey, signToken, verifyToken, pgReq, buildParams, selectRows, insertRow, updateRows, upsertRows, deleteRows, notify, requireAuth, requireAdmin, requireSuperadmin, isActorSuperadmin, clientIp, countRecentFailures, recordLoginAttempt, enforceLoginRateLimit, writeAudit, auditCtxStrict, auditCtx, s3Client, s3Base, parsePhotoDataUrl, s3UploadAvatar, s3DeleteAvatar, envOf, PUBLIC_FIELDS, haversine, assertClockLocation } = core
async function clockHistory(context, query) {
  const user = context.user
  const { userId, from, to } = query
  // Tanpa userId: hanya admin yang boleh mengambil riwayat SEMUA karyawan
  // (tab Absensi admin & modal detail karyawan). Karyawan biasa wajib userId
  // miliknya sendiri — endpoint tetap menutup akses ke data orang lain.
  if (!userId && !isAdminUser(user)) throw new ApiError('userId wajib diisi', 400)
  const filter = [
    ...(userId ? [{ col: 'user_id', value: userId }] : []),
    { col: 'date', op: 'gte', value: from || '1900-01-01' },
    { col: 'date', op: 'lte', value: to || '2999-12-31' },
  ]
  const rows = await selectRows(envOf(context), 'clock_records', {
    select: '*',
    filter,
    order: 'date.desc',
  })
  return json({ history: toCamelList(rows) })
}

async function upsertClock(env, userId, date, field, time) {
  const existing = await selectRows(env, 'clock_records', {
    select: 'id',
    filter: [{ col: 'user_id', value: userId }, { col: 'date', value: date }],
  })
  if (existing.length > 0) {
    const patch = {}
    patch[field] = time
    await updateRows(env, 'clock_records', [{ col: 'user_id', value: userId }, { col: 'date', value: date }], patch)
  } else {
    const body = { user_id: userId, date }
    body[field] = time
    await insertRow(env, 'clock_records', body)
  }
  const rows = await selectRows(env, 'clock_records', {
    select: '*',
    filter: [{ col: 'user_id', value: userId }, { col: 'date', value: date }],
  })
  return toCamel(rows[0])
}

async function clockIn(context, body) {
  const user = context.user
  const { userId, lat, lng } = body
  if (!userId) throw new ApiError('userId wajib diisi', 400)
  if (String(user.sub) !== String(userId)) throw new ApiError('Tidak bisa clock-in atas nama orang lain', 403)
  const loc = await assertClockLocation(envOf(context), lat, lng)
  // Tanggal & jam ditentukan SERVER (WIB), bukan dari client —
  // sehingga tidak bisa memalsukan absen untuk tanggal lain.
  const { date, time } = wibNow()
  const existing = await selectRows(envOf(context), 'clock_records', {
    select: 'clock_in',
    filter: [{ col: 'user_id', value: userId }, { col: 'date', value: date }],
  })
  if (existing.length > 0 && existing[0].clock_in) {
    throw new ApiError('Sudah clock-in hari ini', 400)
  }
  const record = await upsertClock(envOf(context), userId, date, 'clock_in', time)
  return json({ record, ...(loc ? { location: loc } : {}) })
}

async function clockOut(context, body) {
  const user = context.user
  const { userId, lat, lng } = body
  if (!userId) throw new ApiError('userId wajib diisi', 400)
  if (String(user.sub) !== String(userId)) throw new ApiError('Tidak bisa clock-out atas nama orang lain', 403)
  const loc = await assertClockLocation(envOf(context), lat, lng)
  const { date, time } = wibNow()

  // Cari record hari ini; jika belum ada yang clock-in, izinkan clock-out
  // untuk hari sebelumnya (kerja lintas tengah malam) selama masih dini hari.
  let targetDate = date
  let existing = await selectRows(envOf(context), 'clock_records', {
    select: '*',
    filter: [{ col: 'user_id', value: userId }, { col: 'date', value: date }],
  })
  if (!existing[0]?.clock_in) {
    const prev = await selectRows(envOf(context), 'clock_records', {
      select: '*',
      filter: [{ col: 'user_id', value: userId }, { col: 'date', value: wibNow(-1).date }],
    })
    if (prev[0]?.clock_in && !prev[0]?.clock_out && time < '05:00:00') {
      existing = prev
      targetDate = wibNow(-1).date
    }
  }

  const rec = existing[0]
  if (!rec || !rec.clock_in) throw new ApiError('Belum clock-in, tidak bisa clock-out', 400)
  if (rec.clock_out) throw new ApiError('Sudah clock-out hari ini', 400)
  if (targetDate === date && time <= rec.clock_in) {
    throw new ApiError('Jam pulang harus setelah jam masuk', 400)
  }
  const record = await upsertClock(envOf(context), userId, targetDate, 'clock_out', time)
  return json({ record, ...(loc ? { location: loc } : {}) })
}

async function clockRecordPut(context, body) {
  const { userId, date, clockIn, clockOut } = body
  if (!userId || !date) throw new ApiError('userId dan date wajib diisi', 400)
  const existing = await selectRows(envOf(context), 'clock_records', {
    select: 'id',
    filter: [{ col: 'user_id', value: userId }, { col: 'date', value: date }],
  })
  if (existing.length > 0) {
    await updateRows(
      envOf(context),
      'clock_records',
      [{ col: 'user_id', value: userId }, { col: 'date', value: date }],
      { clock_in: normalizeTime(clockIn), clock_out: normalizeTime(clockOut) }
    )
  } else {
    await insertRow(envOf(context), 'clock_records', {
      user_id: userId,
      date,
      clock_in: normalizeTime(clockIn),
      clock_out: normalizeTime(clockOut),
    })
  }
  const row = await selectRows(envOf(context), 'clock_records', {
    select: '*',
    filter: [{ col: 'user_id', value: userId }, { col: 'date', value: date }],
  })
  return json({ record: toCamel(row[0]) })
}

async function clockPendingList(context) {
const user = context.user
  if (isAdminUser(user)) {
    const rows = await selectRows(envOf(context), 'pending_clocks', {
      select: '*',
      order: 'created_at.desc',
      limit: 100,
    })
    const users = await selectRows(envOf(context), 'users', { select: 'id, full_name' })
    const userById = new Map(users.map((u) => [u.id, u]))
    return json({
      pending: toCamelList(rows).map((p) => ({ ...p, userFullName: userById.get(p.userId)?.full_name || null })),
    })
  }
  const rows = await selectRows(envOf(context), 'pending_clocks', {
    select: '*',
    filter: [{ col: 'user_id', value: user.sub }],
    order: 'created_at.desc',
  })
  return json({ pending: toCamelList(rows) })
}

async function clockPendingCreate(context, body) {
const user = context.user
  const { type, date, time, reason } = body
  if (!type || !date || !time) throw new ApiError('type, date, dan time wajib diisi', 400)

  const userRows = await selectRows(envOf(context), 'users', {
    select: 'username, full_name',
    filter: [{ col: 'id', value: user.sub }],
  })
  const u = userRows[0]
  const id = makeId('vcr')
  const created = await insertRow(envOf(context), 'pending_clocks', {
    id,
    user_id: user.sub,
    username: u.username,
    full_name: u.full_name,
    date,
    type,
    time: normalizeTime(time),
    reason: reason || null,
  })
  // PostgREST OR harus ditulis sebagai `or=(...)`; filter `op:'or'` pada selectRows
  // tidak valid ("or.admin") — dulu menyebabkan 400 "failed to parse filter".
  // Ambil admin via dua query terpisah lalu gabungkan (plus superadmin).
  const [byUserType, byRoleAdmin, byRoleSuper] = await Promise.all([
    selectRows(envOf(context), 'users', { select: 'id', filter: [{ col: 'user_type', value: 'admin' }] }),
    selectRows(envOf(context), 'users', { select: 'id', filter: [{ col: 'role', value: 'admin' }] }),
    selectRows(envOf(context), 'users', { select: 'id', filter: [{ col: 'role', value: 'superadmin' }] }),
  ])
  const adminMap = new Map()
  for (const r of [...byUserType, ...byRoleAdmin, ...byRoleSuper]) adminMap.set(r.id, r)
  const adminIds = [...adminMap.keys()]
  await notify(
    envOf(context),
    adminIds,
    'pending_clock',
    'Absen Manual Diajukan',
    `${u.full_name} mengajukan absen manual ${type === 'clockIn' ? 'masuk' : 'pulang'} (${time})`,
    id,
    'pending_clock',
    '/admin/absensi'
  )
  return json({ pending: toCamel(created) }, 201)
}

async function clockPendingApprove(context, id) {
const user = context.user
  const rows = await selectRows(envOf(context), 'pending_clocks', {
    select: '*',
    filter: [{ col: 'id', value: id }],
  })
  const p = rows[0]
  if (!p) throw new ApiError('Not found', 404)
  if (p.status !== 'pending') throw new ApiError('Sudah direview sebelumnya', 400)

  await updateRows(envOf(context), 'pending_clocks', [{ col: 'id', value: p.id }], {
    status: 'approved',
    reviewed_by: user.sub,
    reviewed_at: new Date().toISOString(),
  })

  const field = p.type === 'clockIn' ? 'clock_in' : 'clock_out'
  const existing = await selectRows(envOf(context), 'clock_records', {
    select: 'id',
    filter: [{ col: 'user_id', value: p.user_id }, { col: 'date', value: p.date }],
  })
  if (existing.length > 0) {
    const patch = {}
    patch[field] = p.time
    await updateRows(
      envOf(context),
      'clock_records',
      [{ col: 'user_id', value: p.user_id }, { col: 'date', value: p.date }],
      patch
    )
  } else {
    const body = { user_id: p.user_id, date: p.date }
    body[field] = p.time
    await insertRow(envOf(context), 'clock_records', body)
  }

  await notify(
    envOf(context),
    [p.user_id],
    'pending_clock',
    'Absen Manual Disetujui',
    `Permintaan absen manual ${p.type === 'clockIn' ? 'masuk' : 'pulang'} (${p.date}) Anda disetujui admin.`,
    p.id,
    'pending_clock',
    ''
  )
  await writeAudit(envOf(context), user, 'clock.pending_approve', 'pending_clock', p.id, {
    user_id: p.user_id,
    type: p.type,
    date: p.date,
    time: p.time,
  })
  return json({ ok: true })
}

async function clockPendingReject(context, id) {
const user = context.user
  const rows = await selectRows(envOf(context), 'pending_clocks', {
    select: '*',
    filter: [{ col: 'id', value: id }],
  })
  const p = rows[0]
  if (!p) throw new ApiError('Not found', 404)
  await deleteRows(envOf(context), 'pending_clocks', [{ col: 'id', value: id }])
  await notify(
    envOf(context),
    [p.user_id],
    'pending_clock',
    'Absen Manual Ditolak',
    `Permintaan absen manual ${p.type === 'clockIn' ? 'masuk' : 'pulang'} (${p.date}) Anda ditolak admin.`,
    p.id,
    'pending_clock',
    ''
  )
  await writeAudit(envOf(context), user, 'clock.pending_reject', 'pending_clock', p.id, {
    user_id: p.user_id,
    type: p.type,
    date: p.date,
    time: p.time,
  })
  return json({ ok: true })
}

// ---------- PENGAJUAN ROUTES ----------


export { clockHistory, upsertClock, clockIn, clockOut, clockRecordPut, clockPendingList, clockPendingCreate, clockPendingApprove, clockPendingReject }

