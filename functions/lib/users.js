import bcrypt from 'bcryptjs'
import * as core from './core.js'
const { json, ApiError, toCamel, toCamelList, makeId, normalizeTime, countDays, publicUser, isAdminUser, isSuperadminUser, b64uEncode, b64uDecode, hmacKey, signToken, verifyToken, pgReq, buildParams, selectRows, insertRow, updateRows, upsertRows, deleteRows, notify, requireAuth, requireAdmin, requireSuperadmin, isActorSuperadmin, clientIp, countRecentFailures, recordLoginAttempt, enforceLoginRateLimit, writeAudit, auditCtxStrict, auditCtx, s3Client, s3Base, parsePhotoDataUrl, s3UploadAvatar, s3DeleteAvatar, envOf, PUBLIC_FIELDS, haversine, assertClockLocation } = core
async function usersList(context, body, query = {}) {
  // query bisa di posisi body (GET tanpa body) atau di posisi ke-3 tergantung router
  const q = (query && typeof query === 'object' && Object.keys(query).length) ? query : (body && typeof body === 'object' ? body : {})
  const { limit } = q || {}
  const rows = await selectRows(envOf(context), 'users', {
    select: PUBLIC_FIELDS,
    order: 'created_at.asc',
    ...(limit ? { limit: Number(limit) } : {}),
  })
  return json({ users: toCamelList(rows) })
}

async function usersCreate(context, body) {
const actor = context.user
  const { username, password, fullName, role, ktp, nik, division, birthPlace, birthDate, sex, address } = body
  if (!username || !password || !fullName) {
    throw new ApiError('Username, password, dan nama lengkap wajib diisi', 400)
  }
  if (role === 'superadmin' && !(await isActorSuperadmin(context, actor))) {
    throw new ApiError('Hanya superadmin yang bisa membuat akun superadmin', 403)
  }
  const existing = await selectRows(envOf(context), 'users', {
    select: 'id',
    filter: [{ col: 'username', value: username }],
  })
  if (existing.length > 0) throw new ApiError('Username sudah terdaftar', 409)
  const id = makeId('usr')
  const hash = await bcrypt.hash(password, 10)
  const userType = role === 'admin' || role === 'superadmin' ? 'admin' : 'karyawan'
  await insertRow(envOf(context), 'users', {
    id,
    username,
    password: hash,
    full_name: fullName,
    role: role || 'employee',
    user_type: userType,
    ktp: ktp || null,
    nik: nik || null,
    division: division || null,
    birth_place: birthPlace || null,
    birth_date: birthDate || null,
    sex: sex || null,
    address: address || null,
  })
  const row = await selectRows(envOf(context), 'users', {
    select: PUBLIC_FIELDS,
    filter: [{ col: 'id', value: id }],
  })
  await writeAudit(envOf(context), user, 'users.create', 'user', id, {
    username: body.username,
    role: role || 'employee',
  })
  return json({ user: publicUser(row[0]) }, 201)
}

async function usersUpdate(context, id, body) {
  const { fullName, ktp, nik, division, birthPlace, birthDate, sex, address, photo, phone, personalEmail, emergencyContact, primaryJobs } = body
  const patch = {}
  if (fullName !== undefined) patch.full_name = fullName
  if (ktp !== undefined) patch.ktp = ktp
  if (nik !== undefined) patch.nik = nik
  if (division !== undefined) patch.division = division
  if (birthPlace !== undefined) patch.birth_place = birthPlace
  if (birthDate !== undefined) patch.birth_date = birthDate
  if (sex !== undefined) patch.sex = sex
  if (address !== undefined) patch.address = address
  if (phone !== undefined) patch.phone = phone
  if (personalEmail !== undefined) patch.personal_email = personalEmail
  if (emergencyContact !== undefined) {
    patch.emergency_contact_name = emergencyContact?.name ?? null
    patch.emergency_contact_phone = emergencyContact?.phone ?? null
  }
  if (primaryJobs !== undefined) {
    if (!Array.isArray(primaryJobs)) throw new ApiError('primaryJobs harus array', 400)
    if (primaryJobs.length > 3) throw new ApiError('Maksimal 3 job', 400)
    for (const j of primaryJobs) {
      if (!j.label || typeof j.label !== 'string' || !j.label.trim()) throw new ApiError('Label job wajib diisi', 400)
      if (j.unit !== 'qty' && j.unit !== 'nominal') throw new ApiError('Unit harus qty atau nominal', 400)
      if (!Number.isFinite(Number(j.target)) || Number(j.target) < 1) throw new ApiError('Target harus angka >=1', 400)
    }
    patch.primary_jobs = primaryJobs.map((j) => ({ label: String(j.label).trim(), unit: j.unit === 'nominal' ? 'nominal' : 'qty', target: Math.max(1, Number(j.target) || 1) }))
  }
  if (photo !== undefined) {
    const rows = await selectRows(envOf(context), 'users', {
      select: 'avatar_url',
      filter: [{ col: 'id', value: id }],
    })
    patch.avatar_url =
      photo === null || photo === ''
        ? null
        : await s3UploadAvatar(envOf(context), id, photo, rows[0]?.avatar_url || null)
  }
  if (Object.keys(patch).length > 0) {
    await updateRows(envOf(context), 'users', [{ col: 'id', value: id }], patch)
  }
  await auditCtx(context, 'users.update', 'user', id, patch)
  const row = await selectRows(envOf(context), 'users', {
    select: PUBLIC_FIELDS,
    filter: [{ col: 'id', value: id }],
  })
  return json({ user: publicUser(row[0]) })
}

async function usersSetRole(context, id, body) {
const actor = context.user
  const { role } = body
  if (!role || !['admin', 'employee', 'superadmin'].includes(role)) throw new ApiError('Role tidak valid', 400)
  const rows = await selectRows(envOf(context), 'users', {
    select: 'id, role',
    filter: [{ col: 'id', value: id }],
  })
  const target = rows[0]
  if (!target) throw new ApiError('User tidak ditemukan', 404)
  // Hanya superadmin yang boleh menyet/menurunkan role superadmin.
  if (!(await isActorSuperadmin(context, actor)) && (role === 'superadmin' || target.role === 'superadmin')) {
    throw new ApiError('Hanya superadmin yang bisa mengubah role superadmin', 403)
  }
  // Anti-lockout: superadmin terakhir tidak boleh diturunkan.
  if (target.role === 'superadmin' && role !== 'superadmin') {
    const superadmins = await selectRows(envOf(context), 'users', {
      select: 'id',
      filter: [{ col: 'role', value: 'superadmin' }],
    })
    if (superadmins.length <= 1) throw new ApiError('Tidak dapat menurunkan superadmin terakhir', 400)
  }
  await updateRows(envOf(context), 'users', [{ col: 'id', value: id }], {
    role,
    user_type: role === 'admin' || role === 'superadmin' ? 'admin' : 'karyawan',
  })
  await auditCtx(context, 'users.role', 'user', id, { role })
  const row = await selectRows(envOf(context), 'users', {
    select: PUBLIC_FIELDS,
    filter: [{ col: 'id', value: id }],
  })
  return json({ user: publicUser(row[0]) })
}

async function leaveBalances(context, query) {
const user = context.user
  const year = Number(query.year || new Date().getFullYear())
  const filter = [{ col: 'year', value: year }]
  if (!isAdminUser(user)) filter.push({ col: 'user_id', value: user.sub })
  const rows = await selectRows(envOf(context), 'leave_balances', {
    select: 'id, user_id, year, total_quota, used',
    filter,
  })
  return json({
    balances: toCamelList(rows).map((b) => ({ ...b, remaining: Math.max(0, b.totalQuota - b.used) })),
  })
}

async function leaveBalanceByUser(context, userId, year) {
  const y = Number(year)
  const rows = await selectRows(envOf(context), 'leave_balances', {
    select: 'id, user_id, year, total_quota, used',
    filter: [{ col: 'user_id', value: userId }, { col: 'year', value: y }],
  })
  if (rows.length === 0) {
    return json({ balance: { userId, year: y, totalQuota: 12, used: 0, remaining: 12 } })
  }
  const b = toCamel(rows[0])
  return json({ balance: { ...b, remaining: Math.max(0, b.totalQuota - b.used) } })
}

async function leaveBalanceUpsert(context, body) {
  const { userId, year, totalQuota, used } = body
  if (!userId || !year) throw new ApiError('userId dan year wajib diisi', 400)
  await upsertRows(
    envOf(context),
    'leave_balances',
    { user_id: userId, year: Number(year), total_quota: Number(totalQuota ?? 12), used: Number(used ?? 0) },
    'user_id,year'
  )
  await auditCtx(context, 'leave.balance_set', 'user', userId, { year: Number(year), totalQuota: Number(totalQuota ?? 12), used: Number(used ?? 0) })
  return json({ ok: true })
}

async function leaveDeduct(context, body) {
  const { userId, year, days } = body
  if (!userId || !year || !days) throw new ApiError('userId, year, days wajib diisi', 400)
  const d = Number(days)
  const y = Number(year)
  const rows = await selectRows(envOf(context), 'leave_balances', {
    select: 'used',
    filter: [{ col: 'user_id', value: userId }, { col: 'year', value: y }],
  })
  const used = Math.max(0, (rows[0]?.used || 0) + d)
  await upsertRows(
    envOf(context),
    'leave_balances',
    { user_id: userId, year: y, total_quota: 12, used },
    'user_id,year'
  )
  return json({ ok: true })
}

async function leaveAdjust(context, body) {
const user = context.user
  const { userId, year, startDate, endDate, days, reason } = body
  if (!userId || !year) throw new ApiError('userId dan year wajib diisi', 400)
  const id = makeId('adj')
  const d = Number(days ?? 0)
  const y = Number(year)

  const rows = await selectRows(envOf(context), 'leave_balances', {
    select: 'used',
    filter: [{ col: 'user_id', value: userId }, { col: 'year', value: y }],
  })
  const used = Math.max(0, (rows[0]?.used || 0) + d)
  await upsertRows(
    envOf(context),
    'leave_balances',
    { user_id: userId, year: y, total_quota: 12, used },
    'user_id,year'
  )
  await insertRow(envOf(context), 'leave_adjustments', {
    id,
    user_id: userId,
    year: y,
    start_date: startDate || null,
    end_date: endDate || null,
    days: d,
    reason: reason || null,
    adjusted_by: user.sub,
  })
  await writeAudit(envOf(context), user, 'leave.adjust', 'user', userId, { year: y, days: d, reason: reason || null })

  const bal = await selectRows(envOf(context), 'leave_balances', {
    select: '*',
    filter: [{ col: 'user_id', value: userId }, { col: 'year', value: y }],
  })
  const b = bal[0]
  if (b) {
    const totalQuota = b.total_quota ?? 12
    const remaining = Math.max(0, (b.total_quota ?? 12) - b.used)
    const fmt = (s) => {
      if (!s) return ''
      const [yy, mm, dd] = String(s).slice(0, 10).split('-')
      return `${dd}-${mm}-${yy}`
    }
    const dateRange = startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`
    await notify(
      envOf(context),
      [userId],
      'leave_adjustment',
      'Cuti Bersama',
      `Saldo cuti Anda terpakai ${d} hari (${dateRange}) untuk "${reason || ''}". Sisa saldo: ${remaining}/${totalQuota} hari.`,
      id,
      'leave_adjustment',
      '/settings'
    )
  }
  return json({ ok: true, id }, 201)
}

async function leaveAdjustmentsByUser(context, userId) {
  const rows = await selectRows(envOf(context), 'leave_adjustments', {
    select: '*',
    filter: [{ col: 'user_id', value: userId }],
    order: 'created_at.desc',
  })
  const users = await selectRows(envOf(context), 'users', { select: 'id, full_name' })
  const userById = new Map(users.map((u) => [u.id, u]))
  return json({
    adjustments: toCamelList(rows).map((a) => ({ ...a, adjustedByName: userById.get(a.adjustedBy)?.full_name || null })),
  })
}

// ---------- CLOCK ROUTES ----------
// ---------- SUPERADMIN CHEAT ENDPOINTS ----------

async function superadminResetPassword(context, body) {
const actor = context.user
  const { username, newPassword } = body
  if (!username) throw new ApiError('username wajib diisi', 400)
  if (!newPassword || newPassword.length < 6) throw new ApiError('Password minimal 6 karakter', 400)
  const rows = await selectRows(envOf(context), 'users', {
    select: 'id',
    filter: [{ col: 'username', value: String(username).trim() }],
  })
  if (rows.length === 0) throw new ApiError('User tidak ditemukan', 404)
  // Audit dulu (strict) — aksi tanpa jejak audit tidak diizinkan.
  await auditCtxStrict(context, 'superadmin.reset_password', 'user', rows[0].id, { username, actor: actor.username })
  const hash = await bcrypt.hash(newPassword, 10)
  await updateRows(envOf(context), 'users', [{ col: 'id', value: rows[0].id }], { password: hash })
  return json({ ok: true })
}

async function superadminLeaveBalance(context, body) {
  const { userId, year, totalQuota, used } = body
  if (!userId || !year) throw new ApiError('userId dan year wajib diisi', 400)
  // Audit dulu (strict) — aksi tanpa jejak audit tidak diizinkan.
  await auditCtxStrict(context, 'superadmin.leave_balance', 'user', userId, { year: Number(year), totalQuota: Number(totalQuota ?? 12), used: Number(used ?? 0) })
  await upsertRows(
    envOf(context),
    'leave_balances',
    { user_id: userId, year: Number(year), total_quota: Number(totalQuota ?? 12), used: Number(used ?? 0) },
    'user_id,year'
  )
  return json({ ok: true })
}

async function superadminDeleteUser(context, username) {
const actor = context.user
  const rows = await selectRows(envOf(context), 'users', {
    select: 'id, role',
    filter: [{ col: 'username', value: String(username).trim() }],
  })
  if (rows.length === 0) throw new ApiError('User tidak ditemukan', 404)
  if (String(rows[0].id) === String(actor.sub)) throw new ApiError('Tidak dapat menghapus akun Anda sendiri', 400)
  if (rows[0].role === 'superadmin') {
    const superadmins = await selectRows(envOf(context), 'users', {
      select: 'id',
      filter: [{ col: 'role', value: 'superadmin' }],
    })
    if (superadmins.length <= 1) throw new ApiError('Tidak dapat menghapus superadmin terakhir', 400)
  }
  // Audit dulu (strict) - user harus tetap terlacak di log walau sudah terhapus.
  await auditCtxStrict(context, 'superadmin.user_delete', 'user', rows[0].id, { username, actor: actor.username })
  await deleteRows(envOf(context), 'users', [{ col: 'id', value: rows[0].id }])
  return json({ ok: true })
}

async function adminDeleteUser(context, userId) {
  const actor = context.user
  const targetId = String(userId || '').trim()
  if (!targetId) throw new ApiError('User ID wajib diisi', 400)
  const rows = await selectRows(envOf(context), 'users', {
    select: 'id, role, username, full_name',
    filter: [{ col: 'id', value: targetId }],
  })
  if (rows.length === 0) throw new ApiError('User tidak ditemukan', 404)
  if (String(rows[0].id) === String(actor.sub)) throw new ApiError('Tidak dapat menghapus akun Anda sendiri', 400)
  const targetRole = rows[0].role
  const isSuper = await isActorSuperadmin(context, actor)
  if (targetRole === 'superadmin' && !isSuper) throw new ApiError('Hanya superadmin yang dapat menghapus superadmin', 403)
  if (targetRole === 'superadmin') {
    const superadmins = await selectRows(envOf(context), 'users', {
      select: 'id',
      filter: [{ col: 'role', value: 'superadmin' }],
    })
    if (superadmins.length <= 1) throw new ApiError('Tidak dapat menghapus superadmin terakhir', 400)
  }
  if (targetRole === 'admin' && !isSuper) {
    const admins = await selectRows(envOf(context), 'users', {
      select: 'id',
      filter: [{ col: 'role', value: 'admin' }],
    })
    // Biarkan admin saling hapus admin lain selama bukan yang terakhir (opsional)
    if (admins.length <= 1) throw new ApiError('Tidak dapat menghapus admin terakhir', 400)
  }
  await auditCtxStrict(context, 'admin.user_delete', 'user', rows[0].id, { username: rows[0].username, fullName: rows[0].full_name, actor: actor.username || actor.sub })
  await deleteRows(envOf(context), 'users', [{ col: 'id', value: rows[0].id }])
  return json({ ok: true })
}

export { usersList, usersCreate, usersUpdate, usersSetRole, leaveBalances, leaveBalanceByUser, leaveBalanceUpsert, leaveDeduct, leaveAdjust, leaveAdjustmentsByUser, superadminResetPassword, superadminLeaveBalance, superadminDeleteUser, adminDeleteUser }

