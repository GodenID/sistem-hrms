import * as core from './core.js'
const { json, ApiError, toCamel, toCamelList, makeId, normalizeTime, countDays, publicUser, isAdminUser, isSuperadminUser, b64uEncode, b64uDecode, hmacKey, signToken, verifyToken, pgReq, buildParams, selectRows, insertRow, updateRows, upsertRows, deleteRows, notify, requireAuth, requireAdmin, requireSuperadmin, isActorSuperadmin, clientIp, countRecentFailures, recordLoginAttempt, enforceLoginRateLimit, writeAudit, auditCtxStrict, auditCtx, s3Client, s3Base, parsePhotoDataUrl, s3UploadAvatar, s3DeleteAvatar, envOf, PUBLIC_FIELDS, haversine, assertClockLocation } = core
async function locationsList(context) {
  const rows = await selectRows(envOf(context), 'locations', {
    select: '*',
    order: 'created_at.asc',
    limit: 10,
  })
  return json({ locations: toCamelList(rows) })
}

async function locationsCreate(context, body) {
  const { name, lat, lng, radius } = body
  if (!name?.trim() || lat === undefined || lng === undefined) {
    throw new ApiError('Nama, lat, dan lng wajib diisi', 400)
  }
  const count = await selectRows(envOf(context), 'locations', { select: 'id' })
  if (count.length >= 4) throw new ApiError('Maksimal 4 lokasi', 400)
  const id = makeId('loc')
  const created = await insertRow(envOf(context), 'locations', {
    id,
    name: name.trim(),
    lat: Number(lat),
    lng: Number(lng),
    radius: Number(radius || 100),
  })
  await auditCtx(context, 'locations.create', 'location', id, { name: name.trim() })
  return json({ location: toCamel(created) }, 201)
}

async function locationsUpdate(context, id, body) {
  const { name, lat, lng, radius } = body
  const patch = {}
  if (name !== undefined) patch.name = name
  if (lat !== undefined) patch.lat = Number(lat)
  if (lng !== undefined) patch.lng = Number(lng)
  if (radius !== undefined) patch.radius = Number(radius)
  if (Object.keys(patch).length > 0) {
    await updateRows(envOf(context), 'locations', [{ col: 'id', value: id }], patch)
  }
  await auditCtx(context, 'locations.update', 'location', id, patch)
  const row = await selectRows(envOf(context), 'locations', {
    select: '*',
    filter: [{ col: 'id', value: id }],
  })
  return json({ location: toCamel(row[0]) })
}

async function locationsDelete(context, id) {
  await deleteRows(envOf(context), 'locations', [{ col: 'id', value: id }])
  await auditCtx(context, 'locations.delete', 'location', id, {})
  return json({ ok: true })
}

// ---------- HOLIDAYS ROUTES ----------

const FALLBACK_HOLIDAYS = {
  '01-01': 'Tahun Baru Masehi',
  '05-01': 'Hari Buruh Internasional',
  '06-01': 'Hari Lahir Pancasila',
  '08-17': 'Hari Kemerdekaan RI',
  '12-25': 'Hari Raya Natal',
}


export { locationsList, locationsCreate, locationsUpdate, locationsDelete }

