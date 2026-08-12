import React, { useEffect, useMemo, useState } from "react";
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Download,
  ListChecks,
  LineChart,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import AuthGuard from "../../components/AuthGuard";
import BackToHrms from "../../components/BackToHrms";
import { useUsers } from "../../contexts/UserContext";
import { useWibToday } from "../../hooks/useWibToday";
import {
  buildBuckets,
  computeBucketStat,
  currentMonthRange,
  currentWeekRange,
} from "../../lib/monitoring";
import { formatIDR } from "../../lib/jobs";
import { exportMonitoringCSV } from "../../lib/export";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Skeleton } from "../../components/ui/skeleton";
import { cn } from "../../lib/utils";

const PAGE_SIZE = 20;

function getInitials(fullName) {
  const words = fullName.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return (words[0]?.[0] ?? "").toUpperCase();
}

const GRANULARITY_LABEL = {
  day: "Hari",
  week: "Minggu",
  month: "Bulan",
};

function defaultRange(today, g) {
  if (g === "day") {
    const startDt = new Date(today);
    startDt.setUTCDate(startDt.getUTCDate() - 13);
    const start = startDt.toISOString().slice(0, 10);
    return { start, end: today };
  }
  if (g === "week") {
    const cur = currentWeekRange(today);
    const startDt = new Date(cur.start);
    startDt.setUTCDate(startDt.getUTCDate() - 7 * 7);
    const start = startDt.toISOString().slice(0, 10);
    return { start, end: cur.end };
  }
  const cur = currentMonthRange(today);
  const [yStr, mStr] = cur.start.split("-");
  let year = parseInt(yStr, 10);
  let month = parseInt(mStr, 10) - 5;
  while (month <= 0) {
    month += 12;
    year -= 1;
  }
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  return { start, end: cur.end };
}

export default function AdminMonitoringPage() {
  return (
    <AuthGuard adminOnly={true}>
      <AdminMonitoringContent />
    </AuthGuard>
  );
}

function AdminMonitoringContent() {
  const { users, isLoading } = useUsers();
  const todayDate = useWibToday();

  const [granularity, setGranularity] = useState("day");
  const [start, setStart] = useState(() => defaultRange(todayDate, "day").start);
  const [end, setEnd] = useState(todayDate);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const r = defaultRange(todayDate, granularity);
    setStart(r.start);
    setEnd(r.end);
  }, [granularity, todayDate]);

  const allEmployees = useMemo(() => {
    const collator = new Intl.Collator("id", { sensitivity: "base" });
    return users
      .filter((u) => u.userType !== "admin")
      .slice()
      .sort((a, b) => collator.compare(a.fullName, b.fullName));
  }, [users]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allEmployees;
    return allEmployees.filter((u) => {
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.role ?? "").toLowerCase().includes(q)
      );
    });
  }, [allEmployees, search]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const pagedEmployees = useMemo(() => {
    const offset = (safePage - 1) * PAGE_SIZE;
    return filteredEmployees.slice(offset, offset + PAGE_SIZE);
  }, [filteredEmployees, safePage]);

  const buckets = useMemo(
    () => buildBuckets(start, end, granularity),
    [start, end, granularity]
  );

  // matrix only computes for paged employees — keeps cost flat as roster grows.
  const [matrix, setMatrix] = useState(new Map());
  const [matrixLoading, setMatrixLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setMatrixLoading(true);
    Promise.all(
      pagedEmployees.map(async (emp) => {
        const inner = new Map();
        for (const b of buckets) {
          inner.set(b.key, await computeBucketStat(emp, b));
        }
        return [emp.username, inner];
      })
    )
      .then((pairs) => {
        if (cancelled) return;
        setMatrix(new Map(pairs));
      })
      .finally(() => {
        if (!cancelled) setMatrixLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pagedEmployees, buckets, todayDate]);

  const handleExport = async () => {
    if (filteredEmployees.length === 0 || buckets.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }
    // Export covers everyone matching current search (not just current page).
    const exportMatrix = new Map();
    try {
      await Promise.all(
        filteredEmployees.map(async (emp) => {
          const inner = new Map();
          for (const b of buckets) {
            inner.set(b.key, await computeBucketStat(emp, b));
          }
          exportMatrix.set(emp.username, inner);
        })
      );
      exportMonitoringCSV(
        filteredEmployees,
        buckets,
        exportMatrix,
        GRANULARITY_LABEL[granularity]
      );
      toast.success("CSV berhasil diunduh");
    } catch {
      toast.error("Gagal mengunduh CSV");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ListChecks className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">
                Daily Input Job Tracking
              </span>
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                Admin Console · Monitoring
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/okr/admin">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Kembali</span>
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10 animate-fade-in">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <LineChart className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-2xl font-bold tracking-tight">
                  Monitoring Tim
                </h1>
                <BackToHrms />
              </div>
              <p className="text-sm text-muted-foreground">
                Pantau aktivitas harian, mingguan, dan bulanan setiap karyawan.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            <span>Download CSV</span>
          </Button>
        </div>

        {/* Filter bar */}
        <Card className="mb-5">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Tampilan
                </span>
                <div className="inline-flex rounded-md border border-border bg-background p-0.5">
                  {(["day", "week", "month"]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGranularity(g)}
                      aria-pressed={granularity === g}
                      className={cn(
                        "inline-flex h-8 items-center rounded px-3 text-xs font-medium transition-colors",
                        granularity === g
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-accent"
                      )}
                    >
                      {GRANULARITY_LABEL[g]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="mon-start"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Mulai
                </label>
                <input
                  id="mon-start"
                  type="date"
                  value={start}
                  max={end}
                  onChange={(e) => setStart(e.target.value || start)}
                  className="flex h-9 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="mon-end"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Selesai
                </label>
                <input
                  id="mon-end"
                  type="date"
                  value={end}
                  min={start}
                  max={todayDate}
                  onChange={(e) => setEnd(e.target.value || end)}
                  className="flex h-9 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
                onClick={() => {
                  const r = defaultRange(todayDate, granularity);
                  setStart(r.start);
                  setEnd(r.end);
                }}
              >
                Reset
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, username, atau role…"
                  className="h-9 pl-8 pr-8 text-xs"
                  aria-label="Cari karyawan"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Hapus pencarian"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {buckets.length} kolom · {filteredEmployees.length} karyawan
                {search && ` (dari ${allEmployees.length})`}
              </p>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[64px] w-full rounded-xl" />
            ))}
          </div>
        ) : allEmployees.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center px-6 py-14 text-center text-sm text-muted-foreground">
              Belum ada karyawan terdaftar.
            </CardContent>
          </Card>
        ) : filteredEmployees.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center px-6 py-14 text-center text-sm text-muted-foreground">
              Tidak ada karyawan cocok dengan pencarian.
            </CardContent>
          </Card>
        ) : buckets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center px-6 py-14 text-center text-sm text-muted-foreground">
              Range tanggal tidak valid.
            </CardContent>
          </Card>
        ) : (
          <>
            <MonitoringMatrix
              employees={pagedEmployees}
              buckets={buckets}
              matrix={matrix}
              loading={matrixLoading}
            />
            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={filteredEmployees.length}
              pageSize={PAGE_SIZE}
              onPage={setPage}
            />
          </>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Data tersimpan di server. Hari kerja = Senin–Jumat (akhir pekan
          tidak punya target). Hijau = target tercapai.
        </p>
      </main>
    </div>
  );
}

function Pagination({ page, totalPages, total, pageSize, onPage }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-2 sm:flex-row">
      <p className="text-xs text-muted-foreground tabular-nums">
        {from}–{to} dari {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Sebelumnya</span>
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          Halaman {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          <span className="hidden sm:inline">Berikutnya</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function MonitoringMatrix({ employees, buckets, matrix, loading }) {
  const [expanded, setExpanded] = useState(new Set());

  const toggle = (username) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <div className="flex items-center justify-center px-6 py-10 text-sm text-muted-foreground">
          Memuat data…
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/30 px-3 py-2 text-left">
                <span className="text-xs font-semibold tracking-tight text-muted-foreground">
                  Karyawan
                </span>
              </th>
              {buckets.map((b) => (
                <th
                  key={b.key}
                  className="px-2 py-2 text-center min-w-[88px]"
                  title={`${b.startDate} → ${b.endDate}`}
                >
                  <span className="text-[11px] font-semibold tracking-tight text-muted-foreground">
                    {b.label}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 text-right">
                <span className="text-xs font-semibold tracking-tight text-muted-foreground">
                  Total
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const bucketStats = matrix.get(emp.username);
              if (!bucketStats) return null;
              const initials = getInitials(emp.fullName);
              const isOpen = expanded.has(emp.username);
              let rowCount = 0;
              let rowTarget = 0;
              let rowMet = 0;
              let rowWorking = 0;
              for (const b of buckets) {
                const s = bucketStats.get(b.key);
                if (!s) continue;
                rowCount += s.totalCount;
                rowTarget += s.totalTarget;
                rowMet += s.daysAllMet;
                rowWorking += s.workingDays;
              }
              const rowAllMet = rowWorking > 0 && rowMet === rowWorking;
              return (
                <React.Fragment key={emp.username}>
                  <tr className="border-b border-border/60 transition-colors hover:bg-accent/30">
                    <td className="sticky left-0 z-10 bg-background px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggle(emp.username)}
                        aria-expanded={isOpen}
                        aria-label={
                          isOpen
                            ? `Sembunyikan rincian ${emp.fullName}`
                            : `Tampilkan rincian ${emp.fullName}`
                        }
                        className="flex w-full items-center gap-2.5 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                            !isOpen && "-rotate-90"
                          )}
                          aria-hidden
                        />
                        <Avatar className="h-7 w-7 border border-border">
                          {emp.avatar && (
                            <AvatarImage
                              src={emp.avatar}
                              alt={`Avatar ${emp.fullName}`}
                            />
                          )}
                          <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium tracking-tight">
                            {emp.fullName}
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {emp.role}
                          </p>
                        </div>
                      </button>
                    </td>
                    {buckets.map((b) => {
                      const s = bucketStats.get(b.key);
                      return (
                        <td
                          key={b.key}
                          className="px-2 py-2 text-center align-top tabular-nums"
                        >
                          {s ? (
                            <BucketCell stat={s} />
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right align-top tabular-nums">
                      <div
                        className={cn(
                          "font-semibold",
                          rowAllMet && "text-emerald-600"
                        )}
                      >
                        {rowCount}
                        {rowTarget > 0 && (
                          <span className="font-normal text-muted-foreground">
                            /{rowTarget}
                          </span>
                        )}
                      </div>
                      {rowWorking > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          {rowMet}/{rowWorking} hari tercapai
                        </div>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <JobBreakdownRow
                      bucketStats={bucketStats}
                      buckets={buckets}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function JobBreakdownRow({ bucketStats, buckets }) {
  // Use the first bucket's job list as the canonical job set — every bucket
  // computes for the same user, so job ordering matches.
  const firstBucket = buckets[0] ? bucketStats.get(buckets[0].key) : undefined;
  const jobsForUser = firstBucket?.jobs ?? [];

  if (jobsForUser.length === 0) {
    const anyOther = buckets.some(
      (b) => (bucketStats.get(b.key)?.otherCount ?? 0) > 0
    );
    if (!anyOther) {
      return (
        <tr className="border-b border-border/60 bg-muted/10">
          <td
            colSpan={buckets.length + 2}
            className="px-3 py-3 pl-12 text-[11px] text-muted-foreground"
          >
            Karyawan ini belum punya job utama.
          </td>
        </tr>
      );
    }
  }

  return (
    <>
      {jobsForUser.map((seedJob) => {
        let rowJobCount = 0;
        let rowJobTarget = 0;
        let rowJobIDR = 0;
        for (const b of buckets) {
          const s = bucketStats.get(b.key);
          if (!s) continue;
          const j = s.jobs.find((x) => x.job.id === seedJob.job.id);
          if (!j) continue;
          rowJobCount += j.count;
          rowJobTarget += j.target;
          rowJobIDR += j.totalIDR;
        }
        const rowMet =
          seedJob.type === "po"
            ? rowJobTarget > 0 && rowJobIDR >= rowJobTarget
            : rowJobTarget > 0 && rowJobCount >= rowJobTarget;
        return (
          <tr
            key={seedJob.job.id}
            className="border-b border-border/60 bg-muted/10"
          >
            <td className="sticky left-0 z-10 bg-muted/10 px-3 py-2 pl-12">
              <div className="flex flex-col">
                <span className="truncate text-[11px] font-medium tracking-tight">
                  {seedJob.job.label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {seedJob.type === "po"
                    ? `PO · ${seedJob.job.clientType ?? "—"}`
                    : `Target ${seedJob.job.dailyTarget ?? 0}/hari`}
                </span>
              </div>
            </td>
            {buckets.map((b) => {
              const s = bucketStats.get(b.key);
              const j = s?.jobs.find((x) => x.job.id === seedJob.job.id);
              return (
                <td
                  key={b.key}
                  className="px-2 py-2 text-center align-top tabular-nums"
                >
                  {j ? <JobCell stat={j} /> : <span className="text-muted-foreground/50">—</span>}
                </td>
              );
            })}
            <td className="px-3 py-2 text-right align-top tabular-nums">
              {seedJob.type === "po" ? (
                <div
                  className={cn(
                    "text-[11px] font-semibold",
                    rowMet && "text-emerald-600"
                  )}
                >
                  {formatIDR(rowJobIDR)}
                </div>
              ) : (
                <div
                  className={cn(
                    "text-[11px] font-semibold",
                    rowMet && "text-emerald-600"
                  )}
                >
                  {rowJobCount}
                  {rowJobTarget > 0 && (
                    <span className="font-normal text-muted-foreground">
                      /{rowJobTarget}
                    </span>
                  )}
                </div>
              )}
            </td>
          </tr>
        );
      })}
      <OtherRow bucketStats={bucketStats} buckets={buckets} />
    </>
  );
}

function OtherRow({ bucketStats, buckets }) {
  let rowOther = 0;
  for (const b of buckets) {
    rowOther += bucketStats.get(b.key)?.otherCount ?? 0;
  }
  if (rowOther === 0) return null;

  return (
    <tr className="border-b border-border/60 bg-muted/10">
      <td className="sticky left-0 z-10 bg-muted/10 px-3 py-2 pl-12">
        <div className="flex flex-col">
          <span className="truncate text-[11px] font-medium tracking-tight">
            Lainnya
          </span>
          <span className="text-[10px] text-muted-foreground">
            Item di luar job utama
          </span>
        </div>
      </td>
      {buckets.map((b) => {
        const s = bucketStats.get(b.key);
        const c = s?.otherCount ?? 0;
        return (
          <td
            key={b.key}
            className="px-2 py-2 text-center align-top tabular-nums"
          >
            {c > 0 ? (
              <span className="text-[11px] text-foreground">{c}</span>
            ) : (
              <span className="text-muted-foreground/50">—</span>
            )}
          </td>
        );
      })}
      <td className="px-3 py-2 text-right align-top tabular-nums">
        <div className="text-[11px] font-semibold">{rowOther}</div>
      </td>
    </tr>
  );
}

function JobCell({ stat }) {
  if (stat.type === "po") {
    if (stat.count === 0 && stat.totalIDR === 0 && stat.target === 0) {
      return <span className="text-muted-foreground/50">—</span>;
    }
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span
          className={cn(
            "text-[11px] font-semibold",
            stat.isMet && "text-emerald-600"
          )}
        >
          {formatIDR(stat.totalIDR)}
        </span>
        {stat.target > 0 && (
          <span className="text-[10px] text-muted-foreground">
            / {formatIDR(stat.target)}
          </span>
        )}
        {stat.count > 0 && (
          <Badge
            variant="outline"
            className="h-4 px-1.5 text-[9px] font-medium tabular-nums"
          >
            {stat.count} entri
          </Badge>
        )}
      </div>
    );
  }
  if (stat.count === 0 && stat.target === 0) {
    return <span className="text-muted-foreground/50">—</span>;
  }
  return (
    <span
      className={cn(
        "text-[11px] font-semibold",
        stat.isMet && "text-emerald-600"
      )}
    >
      {stat.count}
      {stat.target > 0 && (
        <span className="font-normal text-muted-foreground">
          /{stat.target}
        </span>
      )}
    </span>
  );
}

function BucketCell({ stat }) {
  if (
    stat.totalCount === 0 &&
    stat.totalTarget === 0 &&
    stat.poCount === 0
  ) {
    return <span className="text-muted-foreground/50">—</span>;
  }
  const allMet =
    stat.workingDays > 0 &&
    stat.daysAllMet === stat.workingDays;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={cn(
          "font-semibold",
          allMet ? "text-emerald-600" : "text-foreground"
        )}
      >
        {stat.totalCount}
        {stat.totalTarget > 0 && (
          <span className="font-normal text-muted-foreground">
            /{stat.totalTarget}
          </span>
        )}
      </span>
      {stat.workingDays > 1 && (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {stat.daysAllMet}/{stat.workingDays} hari
        </span>
      )}
      {stat.poCount > 0 && (
        <Badge
          variant="outline"
          className="h-4 px-1.5 text-[9px] font-medium tabular-nums"
        >
          PO {stat.poCount}
        </Badge>
      )}
    </div>
  );
}
