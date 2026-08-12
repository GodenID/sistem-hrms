// All webhook_type values that Didit can dispatch. Per the spec there is no
// wildcard — subscribe explicitly to each event family you need.
export const WEBHOOK_TYPES = Object.freeze({
  STATUS_UPDATED: 'status.updated',
  DATA_UPDATED: 'data.updated',
  USER_STATUS_UPDATED: 'user.status.updated',
  USER_DATA_UPDATED: 'user.data.updated',
  BUSINESS_STATUS_UPDATED: 'business.status.updated',
  BUSINESS_DATA_UPDATED: 'business.data.updated',
  ACTIVITY_CREATED: 'activity.created',
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_STATUS_UPDATED: 'transaction.status.updated',
})

export const ALL_WEBHOOK_TYPES = Object.freeze(Object.values(WEBHOOK_TYPES))

// Verification statuses per Didit V3 spec.
export const VERIFICATION_STATUS = Object.freeze({
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  IN_REVIEW: 'In Review',
  IN_PROGRESS: 'In Progress',
  NOT_STARTED: 'Not Started',
  ABANDONED: 'Abandoned',
  EXPIRED: 'Expired',
  KYC_EXPIRED: 'KYC Expired',
  RESUBMITTED: 'Resubmitted',
})

// Headers we read. Lowercase canonical because Express normalizes them.
export const HEADERS = Object.freeze({
  SIG_V2: 'x-signature-v2',
  SIG: 'x-signature',
  SIG_SIMPLE: 'x-signature-simple',
  TIMESTAMP: 'x-timestamp',
})

// Reject anything older than this. 5 minutes per spec.
export const TIMESTAMP_TOLERANCE_SECONDS = 300
