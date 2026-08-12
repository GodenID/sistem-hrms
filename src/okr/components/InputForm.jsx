import React, { useEffect, useRef, useState } from 'react'
import { Briefcase, Check } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { cn } from '../lib/utils'
import {
  OTHER_JOB_ID,
  OTHER_JOB_LABEL,
  buildItemTitle,
  formatIDR,
  isPOJob,
  parseIDR,
} from '../lib/jobs'
import { clearDraft, getDraft, setDraft } from '../lib/storage'

function resolveInitialJobId(jobs, initialJobId, mode) {
  if (initialJobId === null) return OTHER_JOB_ID
  if (typeof initialJobId === 'string') {
    if (jobs.some((j) => j.id === initialJobId)) return initialJobId
    return OTHER_JOB_ID
  }
  if (mode === 'add' && jobs.length > 0) return jobs[0].id
  return OTHER_JOB_ID
}

export default function InputForm({
  mode,
  jobs,
  initialJobId,
  initialTitleSuffix = '',
  initialDescription = '',
  initialNominalIDR,
  initialCustomerKind,
  onSubmit,
  onCancel,
  autoSave = false,
  username,
}) {
  const draftEnabled = autoSave && mode === 'add' && !!username

  const initialFromDraft = (() => {
    if (!draftEnabled) return null
    return getDraft(username)
  })()

  const [pickedJobId, setPickedJobId] = useState(() => {
    if (initialFromDraft) {
      const draftId = initialFromDraft.jobId
      if (draftId === null) return OTHER_JOB_ID
      if (jobs.some((j) => j.id === draftId)) return draftId
      return OTHER_JOB_ID
    }
    return resolveInitialJobId(jobs, initialJobId, mode)
  })

  const [titleSuffix, setTitleSuffix] = useState(() => {
    if (initialTitleSuffix) return initialTitleSuffix
    if (initialFromDraft?.titleSuffix) return initialFromDraft.titleSuffix
    return ''
  })

  const [description, setDescription] = useState(() => {
    if (initialDescription) return initialDescription
    if (initialFromDraft?.description) return initialFromDraft.description
    return ''
  })

  const [nominalRaw, setNominalRaw] = useState(() => {
    if (typeof initialNominalIDR === 'number' && initialNominalIDR > 0) {
      return formatIDR(initialNominalIDR).replace(/^Rp\s*/, '')
    }
    return ''
  })

  const [customerKind, setCustomerKind] = useState(() => initialCustomerKind ?? '')

  const [titleError, setTitleError] = useState('')
  const [descriptionError, setDescriptionError] = useState('')
  const [nominalError, setNominalError] = useState('')
  const [customerKindError, setCustomerKindError] = useState('')
  const [draftSaved, setDraftSaved] = useState(false)

  const isFirstRender = useRef(true)
  const indicatorTimeoutRef = useRef(null)

  const pickedJob =
    pickedJobId === OTHER_JOB_ID
      ? null
      : jobs.find((j) => j.id === pickedJobId) ?? null
  const isLainnya = pickedJob === null
  const pickedIsPO = pickedJob ? isPOJob(pickedJob) : false

  const parsedNominal = pickedIsPO ? parseIDR(nominalRaw) : NaN
  const nominalPreview =
    pickedIsPO && Number.isFinite(parsedNominal) && parsedNominal > 0
      ? formatIDR(parsedNominal)
      : ''

  useEffect(() => {
    if (!draftEnabled) return

    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    const timer = setTimeout(() => {
      setDraft(username, {
        jobId: pickedJob ? pickedJob.id : null,
        titleSuffix,
        description,
      })

      if (titleSuffix.trim() || description.trim()) {
        setDraftSaved(true)
        if (indicatorTimeoutRef.current) {
          clearTimeout(indicatorTimeoutRef.current)
        }
        indicatorTimeoutRef.current = setTimeout(() => {
          setDraftSaved(false)
        }, 2000)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [titleSuffix, description, pickedJob, draftEnabled, username])

  useEffect(() => {
    return () => {
      if (indicatorTimeoutRef.current) {
        clearTimeout(indicatorTimeoutRef.current)
      }
    }
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()

    setTitleError('')
    setDescriptionError('')
    setNominalError('')
    setCustomerKindError('')

    let hasError = false
    const trimmedSuffix = titleSuffix.trim()

    if (trimmedSuffix === '') {
      setTitleError(
        pickedIsPO
          ? 'Nama perusahaan tidak boleh kosong'
          : 'Judul tidak boleh kosong'
      )
      hasError = true
    } else if (trimmedSuffix.length > 120) {
      setTitleError('Judul maksimal 120 karakter')
      hasError = true
    }

    if (description.length > 500) {
      setDescriptionError('Deskripsi maksimal 500 karakter')
      hasError = true
    }

    let nominalValue
    let kindValue
    if (pickedIsPO) {
      const parsed = parseIDR(nominalRaw)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setNominalError('Nominal PO wajib diisi')
        hasError = true
      } else if (parsed > 999_999_999_999) {
        setNominalError('Nominal terlalu besar')
        hasError = true
      } else {
        nominalValue = Math.round(parsed)
      }
      if (customerKind === '') {
        setCustomerKindError('Pilih Customer Baru atau Lama')
        hasError = true
      } else {
        kindValue = customerKind
      }
    }

    if (hasError) return

    const jobLabel = pickedJob ? pickedJob.label : null
    const effectiveLabel =
      pickedJob && pickedIsPO && pickedJob.clientType
        ? `${pickedJob.label} ${pickedJob.clientType}`
        : jobLabel
    const finalTitle = buildItemTitle(effectiveLabel, trimmedSuffix)

    const success = onSubmit({
      title: finalTitle,
      description,
      jobId: pickedJob ? pickedJob.id : null,
      jobLabel: effectiveLabel,
      nominalIDR: nominalValue,
      customerKind: kindValue,
    })
    if (!success) return

    if (draftEnabled) {
      clearDraft(username)
    }
  }

  const handleCancel = () => {
    if (draftEnabled) {
      clearDraft(username)
    }
    onCancel()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === 'add' && (
        <p className="text-xs text-muted-foreground">
          Input hanya untuk hari ini · WIB
        </p>
      )}

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
          Job
        </Label>
        <div className="flex flex-wrap gap-2">
          {jobs.map((job) => {
            const isActive = pickedJobId === job.id
            const jobIsPO = isPOJob(job)
            return (
              <button
                key={job.id}
                type="button"
                onClick={() => setPickedJobId(job.id)}
                aria-pressed={isActive}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:bg-accent'
                )}
              >
                <span>{job.label}</span>
                {jobIsPO && job.clientType && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                      isActive
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {job.clientType}
                  </span>
                )}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setPickedJobId(OTHER_JOB_ID)}
            aria-pressed={pickedJobId === OTHER_JOB_ID}
            className={cn(
              'inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              pickedJobId === OTHER_JOB_ID
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-accent'
            )}
          >
            {OTHER_JOB_LABEL}
          </button>
        </div>
        {pickedIsPO && pickedJob?.clientType && (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Anda menginput PO untuk perusahaan </span>
            <span className="font-semibold text-foreground">
              {pickedJob.clientType}
            </span>
            <span className="text-muted-foreground">
              . Pastikan benar — PO ini akan masuk ke akumulasi target perusahaan tersebut.
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="input-title">
          {pickedIsPO ? 'Nama Customer' : 'Judul'}{' '}
          <span className="text-destructive">*</span>
        </Label>
        {!isLainnya && pickedJob && (
          <p className="text-xs text-muted-foreground">
            Judul akan menjadi:{' '}
            <span className="font-semibold text-foreground">
              {pickedIsPO && pickedJob.clientType
                ? `${pickedJob.label} ${pickedJob.clientType}`
                : pickedJob.label}{' '}
              -{' '}
              <span className="font-normal text-muted-foreground">
                {titleSuffix.trim() ||
                  (pickedIsPO ? '(nama customer)' : '(isi judul)')}
              </span>
            </span>
          </p>
        )}
        <Input
          id="input-title"
          type="text"
          value={titleSuffix}
          onChange={(e) => setTitleSuffix(e.target.value)}
          placeholder={
            isLainnya
              ? 'Masukkan judul'
              : pickedIsPO
              ? 'mis. PT BCA Syariah'
              : 'Masukkan detail (mis. PT BCA Syariah)'
          }
          aria-invalid={!!titleError}
          aria-describedby={titleError ? 'title-error' : undefined}
        />
        {titleError && (
          <p id="title-error" className="text-xs text-destructive">
            {titleError}
          </p>
        )}
      </div>

      {pickedIsPO && (
        <div className="space-y-2">
          <Label htmlFor="input-nominal">
            Nominal PO <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              Rp
            </span>
            <Input
              id="input-nominal"
              type="text"
              inputMode="numeric"
              value={nominalRaw}
              onChange={(e) => setNominalRaw(e.target.value)}
              placeholder="1.500.000"
              className="pl-9"
              aria-invalid={!!nominalError}
              aria-describedby={nominalError ? 'nominal-error' : undefined}
            />
          </div>
          {nominalPreview && (
            <p className="text-xs text-muted-foreground">
              Tersimpan sebagai{' '}
              <span className="font-semibold text-foreground">
                {nominalPreview}
              </span>
            </p>
          )}
          {nominalError && (
            <p id="nominal-error" className="text-xs text-destructive">
              {nominalError}
            </p>
          )}
        </div>
      )}

      {pickedIsPO && (
        <div className="space-y-2">
          <Label>
            Status Customer <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCustomerKind('baru')}
              aria-pressed={customerKind === 'baru'}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                customerKind === 'baru'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500'
                  : 'border-border bg-background text-foreground hover:bg-accent'
              )}
            >
              <span className="font-semibold">Customer Baru</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Belum pernah PO ke perusahaan ini
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCustomerKind('lama')}
              aria-pressed={customerKind === 'lama'}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                customerKind === 'lama'
                  ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                  : 'border-border bg-background text-foreground hover:bg-accent'
              )}
            >
              <span className="font-semibold">Customer Lama</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Repeat order / sudah pernah PO
              </span>
            </button>
          </div>
          {customerKindError && (
            <p className="text-xs text-destructive">{customerKindError}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="input-description">Deskripsi</Label>
        <Textarea
          id="input-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Masukkan deskripsi (opsional)"
          aria-invalid={!!descriptionError}
          aria-describedby={
            descriptionError ? 'description-error' : undefined
          }
          className="resize-y"
        />
        {descriptionError && (
          <p id="description-error" className="text-xs text-destructive">
            {descriptionError}
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
        {draftEnabled && (
          <span
            className={`mr-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-opacity duration-300 ${
              draftSaved ? 'opacity-100' : 'opacity-0'
            }`}
            aria-live="polite"
          >
            <Check className="h-3 w-3" />
            Draft tersimpan
          </span>
        )}
        <Button type="button" variant="outline" onClick={handleCancel}>
          Batal
        </Button>
        <Button type="submit">Simpan</Button>
      </div>
    </form>
  )
}
