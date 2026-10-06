import * as core from './core.js'
const { json, toCamelList, selectRows, envOf } = core
async function auditLogsList(context) {
const user = context.user
  const limit = Math.min(Number(new URL(context.request.url).searchParams.get('limit') || 100), 500)
  const rows = await selectRows(envOf(context), 'audit_logs', {
    select: '*',
    order: 'created_at.desc',
    limit,
  })
  return json({ logs: toCamelList(rows) })
}


export { auditLogsList }

