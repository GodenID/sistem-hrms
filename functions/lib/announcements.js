import * as core from './core.js'
const { json, ApiError, toCamel, toCamelList, makeId, normalizeTime, countDays, publicUser, isAdminUser, isSuperadminUser, b64uEncode, b64uDecode, hmacKey, signToken, verifyToken, pgReq, buildParams, selectRows, insertRow, updateRows, upsertRows, deleteRows, notify, requireAuth, requireAdmin, requireSuperadmin, isActorSuperadmin, clientIp, countRecentFailures, recordLoginAttempt, enforceLoginRateLimit, writeAudit, auditCtxStrict, auditCtx, s3Client, s3Base, parsePhotoDataUrl, s3UploadAvatar, s3DeleteAvatar, envOf, PUBLIC_FIELDS, haversine, assertClockLocation } = core
async function announcementsList(context) {
  const rows = await selectRows(envOf(context), 'announcements', {
    select: '*',
    order: 'created_at.desc',
    limit: 200,
  })
  const users = await selectRows(envOf(context), 'users', { select: 'id, full_name' })
  const userById = new Map(users.map((u) => [u.id, u]))
  const allUserIds = users.map((u) => u.id)
  // Ambil read receipts untuk semua announcement sekaligus (batch) — toleran jika tabel belum ada (belum migrate)
  const annIds = rows.map((r) => r.id)
  let readsByAnn = new Map()
  if (annIds.length > 0) {
    try {
      const reads = await selectRows(envOf(context), 'announcement_reads', {
        select: 'announcement_id, user_id',
      })
      for (const r of reads) {
        if (!annIds.includes(r.announcement_id)) continue
        if (!readsByAnn.has(r.announcement_id)) readsByAnn.set(r.announcement_id, new Set())
        readsByAnn.get(r.announcement_id).add(r.user_id)
      }
    } catch {}
  }
  const currentUserId = context.user?.sub || null
  return json({
    announcements: toCamelList(rows).map((a) => {
      const readers = readsByAnn.get(a.id) || new Set()
      return {
        ...a,
        createdByName: userById.get(a.createdBy)?.full_name || null,
        readCount: readers.size,
        totalUsers: allUserIds.length,
        hasRead: currentUserId ? readers.has(currentUserId) : false,
      }
    }),
  })
}

async function announcementMarkRead(context, announcementId) {
  const user = context.user
  const annRows = await selectRows(envOf(context), 'announcements', {
    select: 'id',
    filter: [{ col: 'id', value: announcementId }],
  })
  if (annRows.length === 0) throw new ApiError('Pengumuman tidak ditemukan', 404)
  const existing = await selectRows(envOf(context), 'announcement_reads', {
    select: 'id',
    filter: [{ col: 'announcement_id', value: announcementId }, { col: 'user_id', value: user.sub }],
  })
  if (existing.length === 0) {
    await insertRow(envOf(context), 'announcement_reads', {
      id: makeId('ard'),
      announcement_id: announcementId,
      user_id: user.sub,
    })
  }
  return json({ ok: true })
}

async function announcementReads(context, announcementId) {
  const annRows = await selectRows(envOf(context), 'announcements', {
    select: 'id, title',
    filter: [{ col: 'id', value: announcementId }],
  })
  if (annRows.length === 0) throw new ApiError('Pengumuman tidak ditemukan', 404)
  const reads = await selectRows(envOf(context), 'announcement_reads', {
    select: 'user_id, read_at',
    filter: [{ col: 'announcement_id', value: announcementId }],
    order: 'read_at.asc',
  })
  const users = await selectRows(envOf(context), 'users', { select: 'id, full_name, username, division' })
  const userById = new Map(users.map((u) => [u.id, u]))
  const readList = toCamelList(reads).map((r) => ({
    ...r,
    fullName: userById.get(r.userId)?.full_name || null,
    username: userById.get(r.userId)?.username || null,
    division: userById.get(r.userId)?.division || null,
  }))
  const readIds = new Set(readList.map((r) => r.userId))
  const unread = users.filter((u) => !readIds.has(u.id)).map((u) => ({ userId: u.id, fullName: u.full_name, username: u.username, division: u.division }))
  return json({
    announcementId,
    title: annRows[0].title,
    readCount: readList.length,
    totalUsers: users.length,
    reads: readList,
    unread,
  })
}

async function announcementsCreate(context, body) {
const user = context.user
  const { title, body: content, type } = body
  if (!title?.trim() || !content?.trim()) throw new ApiError('Judul dan isi wajib diisi', 400)
  const userRows = await selectRows(envOf(context), 'users', {
    select: 'full_name',
    filter: [{ col: 'id', value: user.sub }],
  })
  const id = makeId('ann')
  const created = await insertRow(envOf(context), 'announcements', {
    id,
    title: title.trim(),
    body: content.trim(),
    type: type || 'info',
    created_by: user.sub,
    created_by_name: userRows[0]?.full_name || null,
  })
  const others = await selectRows(envOf(context), 'users', {
    select: 'id',
    filter: [{ col: 'id', op: 'neq', value: user.sub }],
  })
  await notify(
    envOf(context),
    others.map((r) => r.id),
    'announcement',
    `Pengumuman: ${title.trim()}`,
    content.trim().slice(0, 120),
    id,
    'announcement',
    '/announcements'
  )
  await writeAudit(envOf(context), user, 'announcements.create', 'announcement', id, {
    title: title.trim(),
    type: type || 'info',
  })
  return json({ announcement: toCamel(created) }, 201)
}

async function announcementsUpdate(context, id, body) {
const user = context.user
  const rows = await selectRows(envOf(context), 'announcements', {
    select: '*',
    filter: [{ col: 'id', value: id }],
  })
  const existing = rows[0]
  if (!existing) throw new ApiError('Pengumuman tidak ditemukan', 404)
  if (!isAdminUser(user) && String(existing.created_by) !== String(user.sub)) {
    throw new ApiError('Hanya pembuat atau admin yang bisa mengubah', 403)
  }
  const { title, body: content, type } = body
  const patch = {}
  if (title !== undefined) patch.title = title
  if (content !== undefined) patch.body = content
  if (type !== undefined) patch.type = type
  patch.updated_at = new Date().toISOString()
  await updateRows(envOf(context), 'announcements', [{ col: 'id', value: id }], patch)
  await writeAudit(envOf(context), user, 'announcements.update', 'announcement', id, patch)
  const updated = await selectRows(envOf(context), 'announcements', {
    select: '*',
    filter: [{ col: 'id', value: id }],
  })
  return json({ announcement: toCamel(updated[0]) })
}

async function announcementsDelete(context, id) {
const user = context.user
  const rows = await selectRows(envOf(context), 'announcements', {
    select: '*',
    filter: [{ col: 'id', value: id }],
  })
  const existing = rows[0]
  if (!existing) throw new ApiError('Pengumuman tidak ditemukan', 404)
  if (!isAdminUser(user) && String(existing.created_by) !== String(user.sub)) {
    throw new ApiError('Hanya pembuat atau admin yang bisa menghapus', 403)
  }
  await deleteRows(envOf(context), 'announcements', [{ col: 'id', value: id }])
  await writeAudit(envOf(context), user, 'announcements.delete', 'announcement', id, {
    title: existing.title,
  })
  return json({ ok: true })
}


export { announcementsList, announcementsCreate, announcementsUpdate, announcementsDelete, announcementMarkRead, announcementReads }

