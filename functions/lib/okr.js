import bcrypt from 'bcryptjs'
import * as core from './core.js'
const { json, ApiError, toCamel, toCamelList, makeId, normalizeTime, countDays, publicUser, isAdminUser, isSuperadminUser, b64uEncode, b64uDecode, hmacKey, signToken, verifyToken, pgReq, buildParams, selectRows, insertRow, updateRows, upsertRows, deleteRows, notify, requireAuth, requireAdmin, requireSuperadmin, isActorSuperadmin, clientIp, countRecentFailures, recordLoginAttempt, enforceLoginRateLimit, writeAudit, auditCtxStrict, auditCtx, s3Client, s3Base, parsePhotoDataUrl, s3UploadAvatar, s3DeleteAvatar, envOf, PUBLIC_FIELDS, haversine, assertClockLocation } = core
async function fetchUsersWithJobs(env) {
  const userRows = await selectRows(env, 'users', {
    select: 'id, username, full_name, role, user_type, suspended, ktp_verified, avatar_color',
    order: 'created_at.asc',
  })
  const jobRows = await selectRows(env, 'user_jobs', {
    select: '*',
    order: 'position.asc',
  })
  const jobsByUser = {}
  for (const j of jobRows) {
    if (!jobsByUser[j.user_id]) jobsByUser[j.user_id] = []
    jobsByUser[j.user_id].push(toCamel(j))
  }
  return userRows.map((u) => ({
    ...toCamel(u),
    password: '',
    jobs: jobsByUser[u.id] || [],
  }))
}

async function okrUsersList(context) {
  const users = await fetchUsersWithJobs(envOf(context))
  return json({ users })
}

async function okrUsersCreate(context, body) {
const actor = context.user
  const { username, password, fullName, role, userType } = body
  if (!username || !password || !fullName) {
    throw new ApiError('Username, password, dan fullName wajib diisi', 400)
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
  const r = role || 'employee'
  const ut = userType || (r === 'admin' || r === 'superadmin' ? 'admin' : 'karyawan')
  await insertRow(envOf(context), 'users', {
    id,
    username,
    password: hash,
    full_name: fullName,
    role: r,
    user_type: ut,
  })
  await auditCtx(context, 'okr.users_create', 'user', id, { username, role: r, userType: ut })
  const users = await fetchUsersWithJobs(envOf(context))
  return json({ ok: true, users }, 201)
}

async function okrUsersUpdate(context, username, body) {
const actor = context.user
  const { fullName, role, userType, password } = body
  const rows = await selectRows(envOf(context), 'users', {
    select: 'id, role',
    filter: [{ col: 'username', value: username }],
  })
  if (rows.length === 0) throw new ApiError('User tidak ditemukan', 404)
  const id = rows[0].id
  const targetIsSuperadmin = rows[0].role === 'superadmin'
  // Hanya superadmin yang boleh menyentuh user superadmin atau menyet role superadmin.
  if ((targetIsSuperadmin || role === 'superadmin') && !(await isActorSuperadmin(context, actor))) {
    throw new ApiError('Hanya superadmin yang bisa mengubah role superadmin', 403)
  }
  const patch = {}
  if (fullName !== undefined) patch.full_name = fullName
  if (role !== undefined) patch.role = role
  if (userType !== undefined) patch.user_type = userType
  if (Object.keys(patch).length > 0) {
    await updateRows(envOf(context), 'users', [{ col: 'id', value: id }], patch)
  }
  if (password) {
    const hash = await bcrypt.hash(password, 10)
    await updateRows(envOf(context), 'users', [{ col: 'id', value: id }], { password: hash })
  }
  await auditCtx(context, 'okr.users_update', 'user', id, { username, ...patch, passwordChanged: Boolean(password) })
  const users = await fetchUsersWithJobs(envOf(context))
  return json({ ok: true, users })
}

async function okrUsersSetSuspended(context, username, suspended) {
const actor = context.user
  const rows = await selectRows(envOf(context), 'users', {
    select: 'id, role',
    filter: [{ col: 'username', value: username }],
  })
  if (rows.length === 0) throw new ApiError('User tidak ditemukan', 404)
  const targetIsSuperadmin = rows[0].role === 'superadmin'
  if (targetIsSuperadmin && !(await isActorSuperadmin(context, actor))) {
    throw new ApiError('Hanya superadmin yang bisa menonaktifkan superadmin lain', 403)
  }
  if (targetIsSuperadmin && suspended) {
    const superadmins = await selectRows(envOf(context), 'users', {
      select: 'id',
      filter: [{ col: 'role', value: 'superadmin' }],
    })
    if (superadmins.length <= 1) throw new ApiError('Tidak dapat menonaktifkan superadmin terakhir', 400)
  }
  await updateRows(envOf(context), 'users', [{ col: 'username', value: username }], { suspended })
  await auditCtx(context, 'okr.users_suspend', 'user', username, { username, suspended })
  const users = await fetchUsersWithJobs(envOf(context))
  return json({ ok: true, users })
}

async function okrUsersDelete(context, username) {
const actor = context.user
  const rows = await selectRows(envOf(context), 'users', {
    select: 'id, role',
    filter: [{ col: 'username', value: username }],
  })
  if (rows.length === 0) throw new ApiError('User tidak ditemukan', 404)
  const targetIsSuperadmin = rows[0].role === 'superadmin'
  if (targetIsSuperadmin && !(await isActorSuperadmin(context, actor))) {
    throw new ApiError('Hanya superadmin yang bisa menghapus superadmin lain', 403)
  }
  if (targetIsSuperadmin) {
    const superadmins = await selectRows(envOf(context), 'users', {
      select: 'id',
      filter: [{ col: 'role', value: 'superadmin' }],
    })
    if (superadmins.length <= 1) throw new ApiError('Tidak dapat menghapus superadmin terakhir', 400)
  }
  if (String(rows[0].id) === String(actor.sub)) throw new ApiError('Tidak dapat menghapus akun Anda sendiri', 400)
  await deleteRows(envOf(context), 'users', [{ col: 'id', value: rows[0].id }])
  await auditCtx(context, 'okr.users_delete', 'user', rows[0].id, { username })
  const users = await fetchUsersWithJobs(envOf(context))
  return json({ ok: true, users })
}

async function okrJobCreate(context, username, body) {
  const { label, type, dailyTarget, monthlyTargetIDR, clientType } = body
  const userRows = await selectRows(envOf(context), 'users', {
    select: 'id',
    filter: [{ col: 'username', value: username }],
  })
  if (userRows.length === 0) throw new ApiError('User tidak ditemukan', 404)
  const userId = userRows[0].id

  const jobs = await selectRows(envOf(context), 'user_jobs', {
    select: 'position',
    filter: [{ col: 'user_id', value: userId }],
    order: 'position.desc',
  })
  if (jobs.length >= 3) throw new ApiError('Maksimal 3 job per user', 400)
  const pos = jobs.length > 0 ? jobs[0].position + 1 : 0

  await insertRow(envOf(context), 'user_jobs', {
    id: makeId('job'),
    user_id: userId,
    label,
    type: type || 'standard',
    daily_target: dailyTarget || null,
    monthly_target_idr: monthlyTargetIDR || null,
    client_type: clientType || null,
    position: pos,
  })
  await auditCtx(context, 'okr.job_create', 'user', userId, { username, label, type: type || 'standard' })
  const users = await fetchUsersWithJobs(envOf(context))
  return json({ ok: true, users }, 201)
}

async function okrJobUpdate(context, username, jobId, body) {
  const { label, type, dailyTarget, monthlyTargetIDR, clientType } = body
  const userRows = await selectRows(envOf(context), 'users', {
    select: 'id',
    filter: [{ col: 'username', value: username }],
  })
  const userId = userRows[0]?.id
  const patch = {}
  if (label !== undefined) patch.label = label
  if (type !== undefined) patch.type = type
  if (dailyTarget !== undefined) patch.daily_target = dailyTarget
  if (monthlyTargetIDR !== undefined) patch.monthly_target_idr = monthlyTargetIDR
  if (clientType !== undefined) patch.client_type = clientType
  if (Object.keys(patch).length > 0) {
    await updateRows(
      envOf(context),
      'user_jobs',
      [{ col: 'id', value: jobId }, { col: 'user_id', value: userId }],
      patch
    )
  }
  await auditCtx(context, 'okr.job_update', 'user', userId, { username, jobId, ...patch })
  const users = await fetchUsersWithJobs(envOf(context))
  return json({ ok: true, users })
}

async function okrJobDelete(context, username, jobId) {
  await deleteRows(envOf(context), 'user_jobs', [{ col: 'id', value: jobId }])
  await auditCtx(context, 'okr.job_delete', 'user', username, { username, jobId })
  const users = await fetchUsersWithJobs(envOf(context))
  return json({ ok: true, users })
}

async function okrInputsList(context, query) {
const user = context.user
  const { username, userId, date, from, to } = query
  const isAdmin = isAdminUser(user)

  let targetId = userId || null
  if (username && !targetId) {
    const rows = await selectRows(envOf(context), 'users', {
      select: 'id',
      filter: [{ col: 'username', value: username }],
    })
    targetId = rows[0]?.id || null
  }
  if (!targetId) targetId = user.sub
  if (!isAdmin && String(targetId) !== String(user.sub)) throw new ApiError('Akses ditolak', 403)

  const filter = [{ col: 'user_id', value: targetId }]
  if (date) {
    filter.push({ col: 'work_date', value: date })
  } else {
    filter.push({ col: 'work_date', op: 'gte', value: from || '1900-01-01' })
    filter.push({ col: 'work_date', op: 'lte', value: to || '2999-12-31' })
  }
  const rows = await selectRows(envOf(context), 'okr_inputs', {
    select: '*',
    filter,
    order: 'work_date.desc,timestamp.desc',
  })
  return json({ inputs: toCamelList(rows) })
}

async function okrInputDates(context, query) {
const user = context.user
  const { username, userId } = query
  let targetId = userId || null
  if (username && !targetId) {
    const rows = await selectRows(envOf(context), 'users', {
      select: 'id',
      filter: [{ col: 'username', value: username }],
    })
    targetId = rows[0]?.id || null
  }
  const isAdmin = isAdminUser(user)
  if (!targetId) targetId = user.sub
  if (!isAdmin && String(targetId) !== String(user.sub)) throw new ApiError('Akses ditolak', 403)

  const rows = await selectRows(envOf(context), 'okr_inputs', {
    select: 'work_date',
    filter: [{ col: 'user_id', value: targetId }],
    order: 'work_date.desc',
  })
  const dates = []
  for (const r of rows) {
    const d = String(r.work_date).slice(0, 10)
    if (!dates.includes(d)) dates.push(d)
  }
  return json({ dates })
}

async function okrInputAllDates(context) {
  const rows = await selectRows(envOf(context), 'okr_inputs', {
    select: 'user_id, work_date',
    order: 'work_date.desc',
  })
  const users = await selectRows(envOf(context), 'users', { select: 'id, username' })
  const usernameById = new Map(users.map((u) => [u.id, u.username]))
  const map = {}
  for (const r of rows) {
    const date = String(r.work_date).slice(0, 10)
    const uname = usernameById.get(r.user_id) || r.user_id
    if (!map[uname]) map[uname] = []
    map[uname].push(date)
  }
  return json({ datesByUser: map })
}

async function okrInputCreate(context, body) {
const user = context.user
  let { username, workDate, title, description, jobLabel, category } = body
  // Frontend Daily Job tidak kirim username — pakai user dari token
  if (!username) {
    const me = await selectRows(envOf(context), 'users', { select: 'username', filter: [{ col: 'id', value: user.sub }] })
    username = me[0]?.username || null
  }
  if (!username || !workDate || !title?.trim()) {
    throw new ApiError('username, workDate, dan title wajib diisi', 400)
  }
  const isAdmin = isAdminUser(user)
  const userRows = await selectRows(envOf(context), 'users', {
    select: 'id',
    filter: [{ col: 'username', value: username }],
  })
  if (userRows.length === 0) throw new ApiError('User tidak ditemukan', 404)
  const userId = userRows[0].id
  if (!isAdmin && String(userId) !== String(user.sub)) throw new ApiError('Akses ditolak', 403)

  const cat = category === 'utama' ? 'utama' : 'lainnya'
  const id = makeId('okr')
  // Live DB di Supabase self-host mungkin masih skema lama (tanpa kolom category/job_label)
  // Coba insert skema baru dulu, fallback ke skema lama/minimal biar tidak 400 "Could not find column"
  let created = null
  try {
    created = await insertRow(envOf(context), 'okr_inputs', {
      id,
      user_id: userId,
      work_date: workDate,
      category: cat,
      job_label: cat === 'utama' ? (jobLabel || null) : null,
      title: title.trim(),
      description: description || '',
    })
  } catch (e) {
    const msg = String(e?.message || '')
    if (msg.includes("Could not find") && msg.includes("category")) {
      // Fallback: skema lama tanpa category/job_label — simpan title/description saja + job_label sebagai title prefix
      try {
        created = await insertRow(envOf(context), 'okr_inputs', {
          id,
          user_id: userId,
          work_date: workDate,
          title: title.trim(),
          description: description || '',
          job_label: cat === 'utama' ? (jobLabel || null) : null,
        })
      } catch (e2) {
        // Fallback minimal: hanya kolom wajib
        created = await insertRow(envOf(context), 'okr_inputs', {
          id,
          user_id: userId,
          work_date: workDate,
          title: cat === 'utama' && jobLabel ? `${jobLabel} - ${title.trim()}` : title.trim(),
          description: description || '',
        })
      }
    } else {
      throw e
    }
  }
  return json({ item: toCamel(created) }, 201)
}

async function okrInputUpdate(context, id, body) {
const user = context.user
  const rows = await selectRows(envOf(context), 'okr_inputs', {
    select: '*',
    filter: [{ col: 'id', value: id }],
  })
  const existing = rows[0]
  if (!existing) throw new ApiError('Item tidak ditemukan', 404)
  const isAdmin = isAdminUser(user)
  if (!isAdmin && String(existing.user_id) !== String(user.sub)) throw new ApiError('Akses ditolak', 403)

  const { title, description, jobLabel, category } = body
  const patch = {}
  if (title !== undefined) patch.title = title
  if (description !== undefined) patch.description = description
  if (jobLabel !== undefined) patch.job_label = jobLabel
  if (category !== undefined) patch.category = category === 'utama' ? 'utama' : 'lainnya'
  if (Object.keys(patch).length > 0) {
    try {
      await updateRows(envOf(context), 'okr_inputs', [{ col: 'id', value: id }], patch)
    } catch (e) {
      const msg = String(e?.message || '')
      if (msg.includes('category') && patch.category !== undefined) {
        const { category: _c, ...rest } = patch
        if (Object.keys(rest).length > 0) {
          await updateRows(envOf(context), 'okr_inputs', [{ col: 'id', value: id }], rest)
        }
      } else throw e
    }
  }
  const updated = await selectRows(envOf(context), 'okr_inputs', {
    select: '*',
    filter: [{ col: 'id', value: id }],
  })
  return json({ item: toCamel(updated[0]) })
}

async function okrInputDelete(context, id) {
const user = context.user
  const rows = await selectRows(envOf(context), 'okr_inputs', {
    select: 'user_id',
    filter: [{ col: 'id', value: id }],
  })
  const existing = rows[0]
  if (!existing) throw new ApiError('Item tidak ditemukan', 404)
  const isAdmin = isAdminUser(user)
  if (!isAdmin && String(existing.user_id) !== String(user.sub)) throw new ApiError('Akses ditolak', 403)
  await deleteRows(envOf(context), 'okr_inputs', [{ col: 'id', value: id }])
  return json({ ok: true })
}

async function okrTeam(context, query) {
  const { from, to } = query
  const rows = await selectRows(envOf(context), 'okr_inputs', {
    select: '*',
    filter: [
      { col: 'work_date', op: 'gte', value: from || '1900-01-01' },
      { col: 'work_date', op: 'lte', value: to || '2999-12-31' },
    ],
    order: 'work_date.asc',
  })
  const users = await selectRows(envOf(context), 'users', {
    select: 'id, username, full_name, user_type, suspended, avatar_color',
  })
  const userById = new Map(users.map((u) => [u.id, u]))
  return json({
    inputs: toCamelList(rows).map((i) => {
      const u = userById.get(i.userId) || {}
      return {
        ...i,
        username: u.username || i.username,
        fullName: u.full_name || i.fullName,
        userType: u.user_type || null,
        suspended: u.suspended ?? null,
        avatarColor: u.avatar_color || null,
      }
    }),
  })
}

// ---------- SUPERADMIN CHEAT ENDPOINTS ----------


export { fetchUsersWithJobs, okrUsersList, okrUsersCreate, okrUsersUpdate, okrUsersSetSuspended, okrUsersDelete, okrJobCreate, okrJobUpdate, okrJobDelete, okrInputsList, okrInputDates, okrInputAllDates, okrInputCreate, okrInputUpdate, okrInputDelete, okrTeam }

