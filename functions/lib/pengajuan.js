import * as core from './core.js'
const { json, ApiError, toCamel, toCamelList, makeId, normalizeTime, countDays, publicUser, isAdminUser, isSuperadminUser, b64uEncode, b64uDecode, hmacKey, signToken, verifyToken, pgReq, buildParams, selectRows, insertRow, updateRows, upsertRows, deleteRows, notify, requireAuth, requireAdmin, requireSuperadmin, isActorSuperadmin, clientIp, countRecentFailures, recordLoginAttempt, enforceLoginRateLimit, writeAudit, auditCtxStrict, auditCtx, s3Client, s3Base, parsePhotoDataUrl, s3UploadAvatar, s3DeleteAvatar, envOf, PUBLIC_FIELDS, haversine, assertClockLocation } = core
async function pengajuanList(context) {
const user = context.user
  const filter = isAdminUser(user) ? [] : [{ col: 'user_id', value: user.sub }]
  const rows = await selectRows(envOf(context), 'pengajuan', {
    select: '*',
    filter,
    order: 'created_at.desc',
    limit: 500,
  })
  return json({ pengajuan: toCamelList(rows) })
}

async function pengajuanCreate(context, body) {
const user = context.user
  const { type, startDate, endDate, reason, clockInTime, clockOutTime } = body
  if (!type || !startDate || !endDate || !reason?.trim()) {
    throw new ApiError('Semua field wajib diisi.', 400)
  }
  if ((type === 'koreksi' || type === 'lembur') && (!clockInTime || !clockOutTime)) {
    throw new ApiError('Jam masuk dan pulang wajib diisi.', 400)
  }
  const userRows = await selectRows(envOf(context), 'users', {
    select: 'username, full_name',
    filter: [{ col: 'id', value: user.sub }],
  })
  const u = userRows[0]
  const id = makeId('png')
  const created = await insertRow(envOf(context), 'pengajuan', {
    id,
    user_id: user.sub,
    username: u.username,
    full_name: u.full_name,
    type,
    start_date: startDate,
    end_date: endDate,
    reason: reason.trim(),
    clock_in_time: type === 'koreksi' || type === 'lembur' ? normalizeTime(clockInTime) : null,
    clock_out_time: type === 'koreksi' || type === 'lembur' ? normalizeTime(clockOutTime) : null,
  })

  const [byUserType, byRoleAdmin, byRoleSuper] = await Promise.all([
    selectRows(envOf(context), 'users', { select: 'id', filter: [{ col: 'user_type', value: 'admin' }] }),
    selectRows(envOf(context), 'users', { select: 'id', filter: [{ col: 'role', value: 'admin' }] }),
    selectRows(envOf(context), 'users', { select: 'id', filter: [{ col: 'role', value: 'superadmin' }] }),
  ])
  const adminMap = new Map()
  for (const r of [...byUserType, ...byRoleAdmin, ...byRoleSuper]) adminMap.set(r.id, r)
  const admins = [...adminMap.values()]
  const typeLabel = { cuti: 'Cuti', sakit: 'Sakit', lembur: 'Lembur', koreksi: 'Koreksi Absen', lainnya: 'Lainnya' }[type]
  await notify(
    envOf(context),
    admins.map((r) => r.id),
    'pengajuan',
    'Pengajuan Baru',
    `${u.full_name} mengajukan ${typeLabel} (${startDate}${endDate !== startDate ? ' – ' + endDate : ''})`,
    id,
    'pengajuan',
    '/admin?tab=pengajuan'
  )
  return json({ item: toCamel(created) }, 201)
}

async function pengajuanStatus(context, id, body) {
const user = context.user
  const { status, rejectionReason } = body
  if (!['pending', 'approved', 'rejected'].includes(status)) throw new ApiError('Status tidak valid.', 400)

  const rows = await selectRows(envOf(context), 'pengajuan', {
    select: '*',
    filter: [{ col: 'id', value: id }],
  })
  const prev = rows[0]
  if (!prev) throw new ApiError('Pengajuan tidak ditemukan.', 404)

  const reviewers = await selectRows(envOf(context), 'users', {
    select: 'username, full_name',
    filter: [{ col: 'id', value: user.sub }],
  })

  await updateRows(envOf(context), 'pengajuan', [{ col: 'id', value: prev.id }], {
    status,
    reviewed_by: user.sub,
    reviewed_by_name: reviewers[0]?.full_name || null,
    reviewed_at: new Date().toISOString(),
    rejection_reason: status === 'rejected' ? (rejectionReason || null) : null,
  })

  if (prev.type === 'cuti') {
    const year = new Date(prev.start_date + 'T00:00:00').getFullYear()
    const days = countDays(prev.start_date, prev.end_date)
    const wasApproved = prev.status === 'approved'
    const isApproved = status === 'approved'
    const delta = !wasApproved && isApproved ? days : wasApproved && !isApproved ? -days : 0
    if (delta !== 0) {
      const bal = await selectRows(envOf(context), 'leave_balances', {
        select: 'used',
        filter: [{ col: 'user_id', value: prev.user_id }, { col: 'year', value: year }],
      })
      const used = Math.max(0, (bal[0]?.used || 0) + delta)
      await upsertRows(
        envOf(context),
        'leave_balances',
        { user_id: prev.user_id, year, total_quota: 12, used },
        'user_id,year'
      )
    }
  }

  const statusLabel = { approved: 'disetujui', rejected: 'ditolak', pending: 'pending' }[status]
  await notify(
    envOf(context),
    [prev.user_id],
    'pengajuan',
    `Pengajuan ${statusLabel}`,
    `Pengajuan ${prev.type} (${prev.start_date}) Anda ${statusLabel} oleh admin.`,
    prev.id,
    'pengajuan',
    '/pengajuan'
  )
  await writeAudit(envOf(context), user, 'pengajuan.review', 'pengajuan', prev.id, {
    type: prev.type,
    status,
    rejectionReason: rejectionReason || null,
  })

  const updated = await selectRows(envOf(context), 'pengajuan', {
    select: '*',
    filter: [{ col: 'id', value: id }],
  })
  return json({ item: toCamel(updated[0]) })
}

async function pengajuanDelete(context, id) {
const user = context.user
  const rows = await selectRows(envOf(context), 'pengajuan', {
    select: '*',
    filter: [{ col: 'id', value: id }],
  })
  const p = rows[0]
  if (!p) throw new ApiError('Pengajuan tidak ditemukan.', 404)
  if (!isAdminUser(user) && String(p.user_id) !== String(user.sub)) {
    throw new ApiError('Tidak bisa menghapus pengajuan orang lain', 403)
  }
  if (p.type === 'cuti' && p.status === 'approved') {
    const year = new Date(p.start_date + 'T00:00:00').getFullYear()
    const days = countDays(p.start_date, p.end_date)
    const bal = await selectRows(envOf(context), 'leave_balances', {
      select: 'used',
      filter: [{ col: 'user_id', value: p.user_id }, { col: 'year', value: year }],
    })
    const used = Math.max(0, (bal[0]?.used || 0) - days)
    await upsertRows(
      envOf(context),
      'leave_balances',
      { user_id: p.user_id, year, total_quota: 12, used },
      'user_id,year'
    )
  }
  await deleteRows(envOf(context), 'pengajuan', [{ col: 'id', value: id }])
  await writeAudit(envOf(context), user, 'pengajuan.delete', 'pengajuan', p.id, {
    type: p.type,
    status: p.status,
  })
  return json({ ok: true })
}

// ---------- ANNOUNCEMENTS ROUTES ----------


export { pengajuanList, pengajuanCreate, pengajuanStatus, pengajuanDelete }

