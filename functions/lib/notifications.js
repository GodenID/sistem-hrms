import * as core from './core.js'
const { json, ApiError, toCamel, toCamelList, makeId, normalizeTime, countDays, publicUser, isAdminUser, isSuperadminUser, b64uEncode, b64uDecode, hmacKey, signToken, verifyToken, pgReq, buildParams, selectRows, insertRow, updateRows, upsertRows, deleteRows, notify, requireAuth, requireAdmin, requireSuperadmin, isActorSuperadmin, clientIp, countRecentFailures, recordLoginAttempt, enforceLoginRateLimit, writeAudit, auditCtxStrict, auditCtx, s3Client, s3Base, parsePhotoDataUrl, s3UploadAvatar, s3DeleteAvatar, envOf, PUBLIC_FIELDS, haversine, assertClockLocation } = core
async function notificationsList(context) {
const user = context.user
  const rows = await selectRows(envOf(context), 'notifications', {
    select: '*',
    filter: [{ col: 'user_id', value: user.sub }],
    order: 'created_at.desc',
    limit: 100,
  })
  return json({ notifications: toCamelList(rows) })
}

async function notificationsMarkRead(context, id) {
const user = context.user
  await updateRows(
    envOf(context),
    'notifications',
    [{ col: 'id', value: id }, { col: 'user_id', value: user.sub }],
    { read: true }
  )
  return json({ ok: true })
}

async function notificationsMarkAllRead(context) {
const user = context.user
  await updateRows(envOf(context), 'notifications', [{ col: 'user_id', value: user.sub }], { read: true })
  return json({ ok: true })
}

async function notificationsDelete(context, id) {
const user = context.user
  await deleteRows(envOf(context), 'notifications', [{ col: 'id', value: id }, { col: 'user_id', value: user.sub }])
  return json({ ok: true })
}

async function notificationsClearAll(context) {
const user = context.user
  await deleteRows(envOf(context), 'notifications', [{ col: 'user_id', value: user.sub }])
  return json({ ok: true })
}

// ---------- LOCATIONS ROUTES ----------


export { notificationsList, notificationsMarkRead, notificationsMarkAllRead, notificationsDelete, notificationsClearAll }

