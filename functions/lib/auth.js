import bcrypt from 'bcryptjs'
import * as core from './core.js'
const { json, ApiError, toCamel, toCamelList, makeId, normalizeTime, countDays, publicUser, isAdminUser, isSuperadminUser, b64uEncode, b64uDecode, hmacKey, signToken, verifyToken, pgReq, buildParams, selectRows, insertRow, updateRows, upsertRows, deleteRows, notify, requireAuth, requireAdmin, requireSuperadmin, isActorSuperadmin, clientIp, countRecentFailures, recordLoginAttempt, enforceLoginRateLimit, writeAudit, auditCtxStrict, auditCtx, s3Client, s3Base, parsePhotoDataUrl, s3UploadAvatar, s3DeleteAvatar, envOf, PUBLIC_FIELDS, haversine, assertClockLocation } = core
async function authRegister(env, body) {
  const { username, password, fullName, ktp, nik, division, birthPlace, birthDate, sex, address, ktpVerified } = body
  if (!username || !password || !fullName) {
    throw new ApiError('Username, password, dan nama lengkap wajib diisi', 400)
  }
  if (password.length < 6) throw new ApiError('Password minimal 6 karakter', 400)

  const existing = await selectRows(env, 'users', { select: 'id', filter: [{ col: 'username', value: username }] })
  if (existing.length > 0) throw new ApiError('Username sudah terdaftar', 409)

  const id = makeId('usr')
  const hash = await bcrypt.hash(password, 10)
  await insertRow(env, 'users', {
    id,
    username,
    password: hash,
    full_name: fullName,
    ktp: ktp || null,
    nik: nik || null,
    division: division || null,
    birth_place: birthPlace || null,
    birth_date: birthDate || null,
    sex: sex || null,
    address: address || null,
    ktp_verified: Boolean(ktpVerified),
  })
  const row = await selectRows(env, 'users', {
    select: PUBLIC_FIELDS,
    filter: [{ col: 'id', value: id }],
  })
  return json({ user: publicUser(row[0]) }, 201)
}

async function authLogin(context, body) {
  const { username, password } = body
  if (!username || !password) throw new ApiError('Username dan password wajib diisi', 400)

  await enforceLoginRateLimit(context, username)
  const env = envOf(context)
  const ip = clientIp(context)

  const rows = await selectRows(env, 'users', {
    select: '*',
    filter: [{ col: 'username', value: username }],
  })
  const user = rows[0]
  if (!user) {
    await recordLoginAttempt(env, username, ip, false)
    throw new ApiError('Username atau password salah', 401)
  }
  if (user.suspended) throw new ApiError('Akun Anda dinonaktifkan, hubungi admin', 403)

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) {
    await recordLoginAttempt(env, username, ip, false)
    throw new ApiError('Username atau password salah', 401)
  }

  await recordLoginAttempt(env, username, ip, true)
  const token = await signToken(user, context.env.AUTH_SECRET)
  return json({ token, user: publicUser(user) })
}

async function authMe(context) {
const user = context.user
  const rows = await selectRows(envOf(context), 'users', {
    select: PUBLIC_FIELDS,
    filter: [{ col: 'id', value: user.sub }],
  })
  if (rows.length === 0) throw new ApiError('User tidak ditemukan', 401)
  return json({ user: publicUser(rows[0]) })
}

async function authVerifyUsername(env, body) {
  const { username } = body
  const rows = await selectRows(env, 'users', {
    select: 'id, username, full_name',
    filter: [{ col: 'username', value: username }, { col: 'suspended', value: 'false' }],
  })
  const u = rows[0]
  if (!u) throw new ApiError('Username tidak ditemukan', 404)
  return json({ found: true, username: u.username, fullName: u.full_name })
}

async function authVerifyKtp(env, body) {
  const { username, ktp } = body
  if (!username || !ktp) throw new ApiError('Username dan nomor KTP wajib diisi', 400)
  const rows = await selectRows(env, 'users', {
    select: 'ktp',
    filter: [{ col: 'username', value: username }, { col: 'suspended', value: 'false' }],
  })
  const user = rows[0]
  if (!user) throw new ApiError('Username tidak ditemukan', 404)
  if ((user.ktp || '') !== String(ktp).trim()) {
    throw new ApiError('Nomor KTP tidak sesuai dengan username.', 400)
  }
  return json({ ok: true })
}

async function authResetPassword(context, body) {
  const { username, ktp, newPassword } = body
  if (!username || !ktp) throw new ApiError('Username dan nomor KTP wajib diisi', 400)
  if (!newPassword || newPassword.length < 6) throw new ApiError('Password minimal 6 karakter', 400)
  const rows = await selectRows(envOf(context), 'users', {
    select: 'id, user_type, ktp',
    filter: [{ col: 'username', value: username }],
  })
  const target = rows[0]
  if (!target) throw new ApiError('Username tidak ditemukan', 404)
  if (target.user_type === 'admin') {
    throw new ApiError('Password admin tidak bisa di-reset lewat sini', 403)
  }
  if ((target.ktp || '') !== String(ktp).trim()) {
    throw new ApiError('Nomor KTP tidak sesuai.', 400)
  }
  const hash = await bcrypt.hash(newPassword, 10)
  await updateRows(envOf(context), 'users', [{ col: 'id', value: target.id }], { password: hash })
  return json({ ok: true })
}

async function authChangePassword(context, body) {
const user = context.user
  const { oldPassword, newPassword } = body
  if (!newPassword || newPassword.length < 6) throw new ApiError('Password minimal 6 karakter', 400)
  const rows = await selectRows(envOf(context), 'users', {
    select: 'password',
    filter: [{ col: 'id', value: user.sub }],
  })
  const ok = await bcrypt.compare(oldPassword || '', rows[0]?.password || '')
  if (!ok) throw new ApiError('Password lama salah', 400)
  const hash = await bcrypt.hash(newPassword, 10)
  await updateRows(envOf(context), 'users', [{ col: 'id', value: user.sub }], { password: hash })
  return json({ ok: true })
}

async function authUpdateProfile(context, body) {
const user = context.user
  const { fullName, ktp, nik, division, birthPlace, birthDate, sex, address, photo, phone, personalEmail, emergencyContact } = body
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
  if (photo !== undefined) {
    const rows = await selectRows(envOf(context), 'users', {
      select: 'avatar_url',
      filter: [{ col: 'id', value: user.sub }],
    })
    patch.avatar_url =
      photo === null || photo === ''
        ? null
        : await s3UploadAvatar(envOf(context), user.sub, photo, rows[0]?.avatar_url || null)
  }
  if (Object.keys(patch).length > 0) {
    await updateRows(envOf(context), 'users', [{ col: 'id', value: user.sub }], patch)
  }
  const rows = await selectRows(envOf(context), 'users', {
    select: PUBLIC_FIELDS,
    filter: [{ col: 'id', value: user.sub }],
  })
  return json({ user: publicUser(rows[0]) })
}

// ---------- USERS ROUTES ----------


export { authRegister, authLogin, authMe, authVerifyUsername, authVerifyKtp, authResetPassword, authChangePassword, authUpdateProfile }

