import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Briefcase,
  ListChecks,
  Receipt,
  RefreshCw,
  Users,
} from "lucide-react";
import AuthGuard from "../components/AuthGuard";
import BackToHrms from "../components/BackToHrms";
import { api } from "../../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useUsers } from "../contexts/UserContext";
import { getInputList } from "../lib/storage";
import { useWibToday } from "../hooks/useWibToday";
import {
  formatDateIndonesian,
  formatDateStringIndonesian,
  formatTimeWib,
  getMonthDates,
  getMondayOfWeek,
  getWeekDates,
  isWeekend,
} from "../lib/dateUtils";
import { computeJobStats, computePOMonthlyStats, formatIDR, getMonthlyPOItems, getUserJobs, isPOJob } from "../lib/jobs";
import {
  ACHIEVEMENTS,
  computeTeamAchievements,
  getAnnouncedAchievements,
  setAnnouncedAchievements,
} from "../lib/achievements";
import { toast } from "sonner";
import { getHoliday } from "../lib/holidays";
import { CLIENT_TYPES } from "../lib/types";
import HolidayBanner, { WeekendBanner } from "../components/HolidayBanner";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Skeleton } from "../components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { cn } from "../lib/utils";

const OTHER_COLUMN_ID = "__other__";
const POLL_INTERVAL_MS = 30_000;
const STORAGE_KEY_RE = /^dit_inputs_.+_\d{4}-\d{2}-\d{2}$/;

function getInitials(fullName) {
  const words = fullName.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return (words[0]?.[0] ?? "").toUpperCase();
}

function computeStatus(
  count,
  totalTarget,
  percentage,
  allMet,
  isOffDay
) {
  if (isOffDay) return "Libur";
  if (count === 0) return "Belum Input";
  if (totalTarget > 0 && allMet) return "Tercapai";
  if (percentage >= 50) return "On Track";
  return "Underperform";
}

function statusBadgeVariant(
  status
) {
  switch (status) {
    case "Tercapai":
      return "success";
    case "On Track":
      return "secondary";
    case "Underperform":
      return "destructive";
    case "Libur":
      return "secondary";
    case "Belum Input":
    default:
      return "muted";
  }
}

/**
 * Build the union of distinct job columns across all karyawan, dedup by
 * (label) so two users with separately-defined "Membuat Invoice" jobs
 * collapse into a single column. Within each label we accept multiple jobIds
 * — counts are aggregated by label match.
 */
function buildJobColumns(users) {
  const seen = new Map();
  for (const u of users) {
    if (u.userType === "admin") continue;
    for (const j of getUserJobs(u)) {
      // PO jobs are tracked monthly elsewhere, not in the daily team grid.
      if ((j.type ?? "standard") === "po") continue;
      const label = j.label.trim();
      if (!label) continue;
      if (!seen.has(label)) {
        seen.set(label, { id: label, label });
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "id")
  );
}

const BULAN_INDONESIA = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function formatMonthLabel(yyyyMm) {
  const [y, m] = yyyyMm.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${BULAN_INDONESIA[idx] ?? ""} ${y}`;
}

function getMonthOptions(currentYyyyMm) {
  // 24 months back from "now" — covers ~2 years of historical browsing,
  // enough for monthly review without stuffing the picker.
  const [yStr, mStr] = currentYyyyMm.split("-");
  let year = parseInt(yStr, 10);
  let month = parseInt(mStr, 10);
  const out = [];
  for (let i = 0; i < 24; i++) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return out;
}

export default function TeamPage() {
  return (
    <AuthGuard>
      <TeamPageContent />
    </AuthGuard>
  );
}

function TeamPageContent() {
  const { currentUser } = useAuth();
  const { users, isLoading: usersLoading } = useUsers();
  const todayDate = useWibToday();
  const holiday = getHoliday(todayDate);
  const weekend = !holiday && isWeekend(todayDate);
  const isOffDay = !!holiday || weekend;

  // Period filter for the daily-activity table. "today" = single day,
  // "week" = Mon..min(Sun, today), "month" = 1st..min(last, today).
  const [period, setPeriod] = useState("today");

  const periodDates = useMemo(() => {
    if (period === "today") return [todayDate];
    if (period === "week") return getWeekDates(todayDate, todayDate);
    return getMonthDates(todayDate, todayDate);
  }, [period, todayDate]);

  // Working days in the selected period — used to scale daily targets.
  // Off-days (weekend/holiday) don't carry a target so they're excluded.
  const workingDaysCount = useMemo(() => {
    let count = 0;
    for (const d of periodDates) {
      if (isWeekend(d)) continue;
      if (getHoliday(d)) continue;
      count += 1;
    }
    return count;
  }, [periodDates]);

  const periodLabel = useMemo(() => {
    if (period === "today") return formatDateIndonesian(new Date());
    if (period === "week") {
      const monday = getMondayOfWeek(todayDate);
      return `${formatDateStringIndonesian(monday)} – ${formatDateStringIndonesian(todayDate)}`;
    }
    const [yStr, mStr] = todayDate.split("-");
    const idx = parseInt(mStr, 10) - 1;
    return `${BULAN_INDONESIA[idx] ?? ""} ${yStr}`;
  }, [period, todayDate]);

  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  // Bumped to force re-aggregation on storage events / polling.
  const [refreshTick, setRefreshTick] = useState(0);

  // Selected month for the PO table — defaults to current WIB month and
  // keeps in sync if the WIB day rolls into a new month while the page is
  // open and the user hasn't picked a non-current month yet.
  const [selectedMonth, setSelectedMonth] = useState(() =>
    todayDate.slice(0, 7)
  );
  const [didUserPickMonth, setDidUserPickMonth] = useState(false);
  useEffect(() => {
    if (!didUserPickMonth) {
      setSelectedMonth(todayDate.slice(0, 7));
    }
  }, [todayDate, didUserPickMonth]);

  // Drill-down modal target: which user's monthly PO breakdown to show.
  const [drillUser, setDrillUser] = useState(null);
  // Drill-down for the daily activity table (top table).
  const [dailyDrillUser, setDailyDrillUser] = useState(null);

  const employees = useMemo(
    () => users.filter((u) => u.userType !== "admin"),
    [users]
  );
  const jobColumns = useMemo(() => buildJobColumns(users), [users]);

  // Achievement computation: rerun whenever employees / month / refresh tick
  // changes. Top 1 is computed across the whole team so we hold one map for
  // the whole table.
  const [teamAchievements, setTeamAchievements] = useState(new Map());
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setAchievementsLoading(true);
    computeTeamAchievements(employees, todayDate)
      .then((map) => {
        if (!cancelled) setTeamAchievements(map);
      })
      .finally(() => {
        if (!cancelled) setAchievementsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employees, todayDate, refreshTick]);

  // Toast unlock for the *current* user only — we don't spam everyone with
  // everyone else's wins. We persist announced ids per-user so reload doesn't
  // re-pop the same toast.
  useEffect(() => {
    if (!currentUser) return;
    const earned = teamAchievements.get(currentUser.username);
    if (!earned || earned.length === 0) return;
    const announced = getAnnouncedAchievements(currentUser.username);
    const newlyUnlocked = earned.filter((a) => !announced.has(a.id));
    if (newlyUnlocked.length === 0) return;
    for (const a of newlyUnlocked) {
      toast.success(`${a.emoji} ${a.label}`, {
        description: a.description,
      });
      announced.add(a.id);
    }
    setAnnouncedAchievements(currentUser.username, announced);
  }, [teamAchievements, currentUser]);

  // Aggregate items across the selected period for every karyawan.
  const aggregate = useCallback(async () => {
    // Single round-trip: pull all inputs in the period from the server.
    let allItems = [];
    try {
      const res = await api(
        `/okr/team?from=${periodDates[0]}&to=${periodDates[periodDates.length - 1]}`
      );
      allItems = res.inputs || [];
    } catch {
      allItems = [];
    }
    const byUserDate = new Map();
    for (const it of allItems) {
      const d = (it.workDate || it.date || "").slice(0, 10);
      if (!periodDates.includes(d)) continue;
      const key = `${it.username}__${d}`;
      if (!byUserDate.has(key)) byUserDate.set(key, []);
      byUserDate.get(key).push(it);
    }

    return employees.map((user) => {
      // Concatenate items across every date in the period.
      const items = [];
      let lastUpdate = null;
      for (const d of periodDates) {
        const dayItems = byUserDate.get(`${user.username}__${d}`) || [];
        for (const it of dayItems) {
          items.push(it);
          if (!lastUpdate || (it.timestamp && it.timestamp > lastUpdate)) {
            lastUpdate = it.timestamp ?? lastUpdate;
          }
        }
      }
      const jobStats = computeJobStats(user, items);
      const userJobs = getUserJobs(user);

      // Cells indexed by column label. A user only "has" a column if they
      // have a job with that exact label. Target scales by working days
      // elapsed in the period (so week/month show cumulative target).
      const jobCells = new Map();
      for (const col of jobColumns) {
        const matchingUserJob = userJobs.find((j) => j.label === col.label);
        if (!matchingUserJob) continue;
        if ((matchingUserJob.type ?? "standard") === "po") continue;
        const stat = jobStats.jobs.find(
          (s) => s.job.id === matchingUserJob.id
        );
        const dailyTarget = matchingUserJob.dailyTarget ?? null;
        const scaledTarget =
          dailyTarget == null ? null : dailyTarget * workingDaysCount;
        const count = stat?.count ?? 0;
        jobCells.set(col.id, {
          count,
          target: scaledTarget,
          isMet: scaledTarget != null && scaledTarget > 0 && count >= scaledTarget,
        });
      }

      const totalTarget = userJobs.reduce(
        (sum, j) =>
          (j.type ?? "standard") === "standard"
            ? sum + (j.dailyTarget ?? 0) * workingDaysCount
            : sum,
        0
      );

      // Recompute overall percentage / allMet against the scaled targets so
      // status reflects the period view rather than a single day.
      let scaledPctSum = 0;
      let scaledJobCount = 0;
      let scaledAllMet = true;
      for (const col of jobColumns) {
        const cell = jobCells.get(col.id);
        if (!cell || cell.target == null || cell.target <= 0) continue;
        scaledJobCount += 1;
        const pct = Math.min(
          100,
          Math.round((cell.count / cell.target) * 100)
        );
        scaledPctSum += pct;
        if (!cell.isMet) scaledAllMet = false;
      }
      const overallPercentage =
        scaledJobCount === 0 ? 0 : Math.round(scaledPctSum / scaledJobCount);
      const allMet = scaledJobCount > 0 && scaledAllMet;

      // For week/month, "Libur" only fires when *every* day in the period
      // is off (rare — only happens if the user lands on a fully-off run).
      const periodIsOffDay =
        period === "today"
          ? isOffDay
          : workingDaysCount === 0 && periodDates.length > 0;

      return {
        user,
        jobCells,
        otherCount: jobStats.otherCount,
        totalCount: jobStats.totalCount,
        totalTarget,
        overallPercentage,
        status: computeStatus(
          jobStats.totalCount,
          totalTarget,
          overallPercentage,
          allMet,
          periodIsOffDay
        ),
        lastUpdate,
      };
    });
  }, [employees, jobColumns, periodDates, workingDaysCount, period, isOffDay]);

  // Initial + dependency-driven aggregation.
  useEffect(() => {
    if (usersLoading) return;
    let cancelled = false;
    setIsLoading(true);
    aggregate()
      .then((next) => {
        if (cancelled) return;
        setRows(next);
        setLastRefreshed(new Date());
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [aggregate, usersLoading, todayDate, refreshTick]);

  // Monthly PO rows — only karyawan that actually have a PO job appear.
  // Reads across the whole selected month via computePOMonthlyStats and
  // buckets per clientType (so two PO jobs sharing a client roll up together).
  const [monthlyPORows, setMonthlyPORows] = useState([]);
  const [poRowsLoading, setPoRowsLoading] = useState(false);
  useEffect(() => {
    const yyyyMm = selectedMonth;
    let cancelled = false;
    setPoRowsLoading(true);
    Promise.all(
      employees.map(async (user) => {
        const poJobs = getUserJobs(user).filter(isPOJob);
        if (poJobs.length === 0) return null;
        const stats = await computePOMonthlyStats(user, yyyyMm);

        // Group per-job stats by clientType.
        const byClient = new Map();
        for (const s of stats.jobs) {
          const c = s.job.clientType;
          // Skip legacy PO jobs that don't yet carry a clientType — admin must
          // re-edit them to set the perusahaan bucket.
          if (!c) continue;
          const bucket =
            byClient.get(c) ?? {
              totalIDR: 0,
              targetIDR: 0,
              count: 0,
              newCount: 0,
              repeatCount: 0,
            };
          bucket.totalIDR += s.totalIDR;
          bucket.targetIDR += s.job.monthlyTargetIDR ?? 0;
          bucket.count += s.count;
          bucket.newCount += s.newCount;
          bucket.repeatCount += s.repeatCount;
          byClient.set(c, bucket);
        }
        const clients = Array.from(byClient.entries())
          .map(([clientType, b]) => {
            const percentage =
              b.targetIDR <= 0
                ? 0
                : Math.min(100, Math.round((b.totalIDR / b.targetIDR) * 100));
            return {
              clientType,
              totalIDR: b.totalIDR,
              targetIDR: b.targetIDR,
              count: b.count,
              newCount: b.newCount,
              repeatCount: b.repeatCount,
              percentage,
              isMet: b.targetIDR > 0 && b.totalIDR >= b.targetIDR,
            };
          })
          .sort((a, b) =>
            CLIENT_TYPES.indexOf(a.clientType) -
            CLIENT_TYPES.indexOf(b.clientType)
          );
        const totalIDR = clients.reduce((sum, c) => sum + c.totalIDR, 0);
        const totalTargetIDR = clients.reduce((sum, c) => sum + c.targetIDR, 0);
        const totalNew = clients.reduce((sum, c) => sum + c.newCount, 0);
        const totalRepeat = clients.reduce((sum, c) => sum + c.repeatCount, 0);
        const overallPercentage =
          clients.length === 0
            ? 0
            : Math.round(
                clients.reduce((sum, c) => sum + c.percentage, 0) / clients.length
              );
        const allMet =
          clients.length > 0 && clients.every((c) => c.isMet);
        return {
          user,
          month: yyyyMm,
          clients,
          totalIDR,
          totalTargetIDR,
          overallPercentage,
          allMet,
          totalNew,
          totalRepeat,
        };
      })
    )
      .then((rows) => {
        if (cancelled) return;
        setMonthlyPORows(rows.filter(Boolean));
      })
      .finally(() => {
        if (!cancelled) setPoRowsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // refreshTick + selectedMonth cover both manual refresh and a manually-
    // chosen historic month; employees changes when admin add/edit users.
  }, [employees, selectedMonth, refreshTick]);

  /** Distinct PO clients across all karyawan, in the canonical CLIENT_TYPES order. */
  const monthlyPOClientColumns = useMemo(() => {
    const seen = new Set();
    for (const u of employees) {
      for (const j of getUserJobs(u)) {
        if (!isPOJob(j)) continue;
        if (j.clientType) seen.add(j.clientType);
      }
    }
    return CLIENT_TYPES.filter((c) => seen.has(c));
  }, [employees]);

  // Cross-tab auto-update: listen for storage writes to any date currently
  // included in the selected period.
  useEffect(() => {
    const dateSet = new Set(periodDates);
    const onStorage = (e) => {
      if (!e.key) return;
      if (!STORAGE_KEY_RE.test(e.key)) return;
      const dateMatch = e.key.match(/_(\d{4}-\d{2}-\d{2})$/);
      if (!dateMatch || !dateSet.has(dateMatch[1])) return;
      setRefreshTick((t) => t + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [periodDates]);

  // Polling fallback: covers the same-tab edge case where `storage` events
  // don't fire, plus any scenario where multiple tabs in different processes
  // miss each other.
  useEffect(() => {
    const id = window.setInterval(() => {
      setRefreshTick((t) => t + 1);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  // Sort: most recently active first, then name A-Z.
  const sortedRows = useMemo(() => {
    const collator = new Intl.Collator("id", { sensitivity: "base" });
    return [...rows].sort((a, b) => {
      if (a.lastUpdate && b.lastUpdate) {
        if (a.lastUpdate !== b.lastUpdate) {
          return b.lastUpdate.localeCompare(a.lastUpdate);
        }
      } else if (a.lastUpdate) {
        return -1;
      } else if (b.lastUpdate) {
        return 1;
      }
      return collator.compare(a.user.fullName, b.user.fullName);
    });
  }, [rows]);

  const summary = useMemo(() => {
    const total = sortedRows.length;
    const achieved = sortedRows.filter((r) => r.status === "Tercapai").length;
    const notInput = sortedRows.filter(
      (r) => r.status === "Belum Input"
    ).length;
    return { total, achieved, notInput };
  }, [sortedRows]);

  const handleManualRefresh = () => setRefreshTick((t) => t + 1);

  const homeHref = currentUser?.userType === "admin" ? "/okr/admin" : "/okr";

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ListChecks className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Daily Input Job Tracking
            </span>
          </div>

          <Button variant="outline" size="sm" asChild>
            <Link to={homeHref}>
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Kembali</span>
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:px-8 md:py-10 md:pb-10 animate-fade-in">
        {/* Title row */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-2xl font-bold tracking-tight">
                  Aktivitas Tim
                </h1>
                <BackToHrms />
              </div>
              <p className="text-sm text-muted-foreground">
                {periodLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              Diperbarui {formatTimeWib(lastRefreshed.toISOString())} WIB
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              aria-label="Refresh data"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Period filter */}
        <PeriodTabs value={period} onChange={setPeriod} />


        {/* Off-day banner */}
        {holiday && (
          <div className="mb-6">
            <HolidayBanner holiday={holiday} />
          </div>
        )}
        {weekend && (
          <div className="mb-6">
            <WeekendBanner />
          </div>
        )}

        {/* Summary stats */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard
            label="Total Karyawan"
            value={summary.total}
            loading={isLoading || usersLoading}
          />
          <SummaryCard
            label={
              period === "today"
                ? "Tercapai Hari Ini"
                : period === "week"
                ? "Tercapai Minggu Ini"
                : "Tercapai Bulan Ini"
            }
            value={summary.achieved}
            loading={isLoading || usersLoading}
            tone="success"
            hint={
              period === "today"
                ? undefined
                : `${workingDaysCount} hari kerja dari ${periodDates.length} hari`
            }
          />
          <SummaryCard
            label={period === "today" ? "Belum Input" : "Belum Input Sama Sekali"}
            value={summary.notInput}
            loading={isLoading || usersLoading}
            tone="muted"
            hint={
              period === "today"
                ? undefined
                : "Tidak ada input di seluruh periode"
            }
          />
        </div>

        {/* Table */}
        {isLoading || usersLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
            ))}
          </div>
        ) : sortedRows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center px-6 py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Users
                  className="h-6 w-6 text-muted-foreground"
                  strokeWidth={1.75}
                />
              </div>
              <h3 className="mb-1.5 text-base font-semibold tracking-tight">
                Belum ada karyawan
              </h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Belum ada karyawan terdaftar di sistem. Hubungi admin Anda.
              </p>
            </CardContent>
          </Card>
        ) : (
          <TeamTable
            rows={sortedRows}
            jobColumns={jobColumns}
            currentUsername={currentUser?.username}
            onRowClick={(user) => setDailyDrillUser(user)}
            achievementsByUsername={teamAchievements}
          />
        )}

        {/* Monthly PO table — hanya muncul kalau ada karyawan dengan job PO */}
        {!isLoading && !usersLoading && monthlyPORows.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-tight">
                    Target PO Bulan Ini
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {formatMonthLabel(selectedMonth)} · Klik baris untuk lihat
                    detail PO
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                    PO selalu dihitung per bulan — tidak mengikuti filter periode di atas.
                  </p>
                </div>
              </div>

              <PoMonthFilter
                value={selectedMonth}
                currentMonth={todayDate.slice(0, 7)}
                onChange={(next) => {
                  setSelectedMonth(next);
                  setDidUserPickMonth(next !== todayDate.slice(0, 7));
                }}
              />
            </div>
            <TeamMonthlyPOTable
              rows={monthlyPORows}
              clientColumns={monthlyPOClientColumns}
              currentUsername={currentUser?.username}
              onRowClick={(user) => setDrillUser(user)}
            />
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Tabel diperbarui otomatis setiap kali ada input baru. Mode demo —
          data antar perangkat tidak tersinkron.
        </p>
      </main>

      <PODrilldownDialog
        user={drillUser}
        month={selectedMonth}
        open={drillUser !== null}
        onClose={() => setDrillUser(null)}
      />

      <DailyDrilldownDialog
        user={dailyDrillUser}
        defaultDate={todayDate}
        open={dailyDrillUser !== null}
        onClose={() => setDailyDrillUser(null)}
      />
    </div>
  );
}

function PeriodTabs({
  value,
  onChange,
}) {
  const opts = [
    { id: "today", label: "Hari Ini" },
    { id: "week", label: "Minggu Ini" },
    { id: "month", label: "Bulan Ini" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Filter periode"
      className="mb-4 inline-flex rounded-lg border border-border bg-muted/30 p-1"
    >
      {opts.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              "h-8 rounded-md px-3 text-xs font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  loading,
  tone = "default",
  hint,
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        {loading ? (
          <Skeleton className="h-7 w-12" />
        ) : (
          <span
            className={cn(
              "text-2xl font-bold tracking-tight tabular-nums",
              tone === "success" && "text-emerald-600"
            )}
          >
            {value}
          </span>
        )}
        {hint && !loading && (
          <span className="text-[11px] text-muted-foreground">{hint}</span>
        )}
      </CardContent>
    </Card>
  );
}

function TeamTable({
  rows,
  jobColumns,
  currentUsername,
  onRowClick,
  achievementsByUsername,
}) {
  const showOtherCol = true;

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/30 px-4 py-3 text-left">
                <span className="text-xs font-semibold tracking-tight text-muted-foreground">
                  Karyawan
                </span>
              </th>
              {jobColumns.map((col) => (
                <th key={col.id} className="px-3 py-3 text-center">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold tracking-tight text-muted-foreground">
                    <Briefcase className="h-3 w-3" />
                    {col.label}
                  </span>
                </th>
              ))}
              {showOtherCol && (
                <th className="px-3 py-3 text-center">
                  <span className="text-xs font-semibold tracking-tight text-muted-foreground">
                    Lainnya
                  </span>
                </th>
              )}
              <th className="px-3 py-3 text-center">
                <span className="text-xs font-semibold tracking-tight text-muted-foreground">
                  Total
                </span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold tracking-tight text-muted-foreground">
                  Status
                </span>
              </th>
              <th className="px-4 py-3 text-right">
                <span className="text-xs font-semibold tracking-tight text-muted-foreground">
                  Update
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const initials = getInitials(r.user.fullName);
              const isMe = currentUsername === r.user.username;
              const clickable = !!onRowClick;
              return (
                <tr
                  key={r.user.username}
                  onClick={
                    clickable ? () => onRowClick(r.user) : undefined
                  }
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(r.user);
                          }
                        }
                      : undefined
                  }
                  tabIndex={clickable ? 0 : undefined}
                  role={clickable ? "button" : undefined}
                  aria-label={
                    clickable
                      ? `Lihat aktivitas ${r.user.fullName}`
                      : undefined
                  }
                  className={cn(
                    "border-b border-border/60 transition-colors last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    clickable && "cursor-pointer",
                    isMe ? "bg-primary/5" : "hover:bg-accent/30"
                  )}
                >
                  <td className="sticky left-0 z-10 bg-background px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0 border border-border">
                        {r.user.avatar && (
                          <AvatarImage
                            src={r.user.avatar}
                            alt={`Avatar ${r.user.fullName}`}
                          />
                        )}
                        <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-medium tracking-tight">
                            {r.user.fullName}
                          </p>
                          {isMe && (
                            <Badge
                              variant="secondary"
                              className="h-4 px-1.5 text-[10px] font-medium"
                            >
                              Anda
                            </Badge>
                          )}
                          {(achievementsByUsername?.get(r.user.username) ?? []).map(
                            (a) => (
                              <span
                                key={a.id}
                                className="text-sm leading-none"
                                title={`${a.label} — ${a.description}`}
                                role="img"
                                aria-label={a.label}
                              >
                                {a.emoji}
                              </span>
                            )
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.user.role}
                        </p>
                      </div>
                    </div>
                  </td>
                  {jobColumns.map((col) => {
                    const cell = r.jobCells.get(col.id);
                    return (
                      <td
                        key={col.id}
                        className="px-3 py-3 text-center text-xs tabular-nums"
                      >
                        {cell ? (
                          <JobCellView cell={cell} />
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    );
                  })}
                  {showOtherCol && (
                    <td className="px-3 py-3 text-center text-xs tabular-nums">
                      <span
                        className={cn(
                          "font-medium",
                          r.otherCount > 0
                            ? "text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {r.otherCount}
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-3 text-center text-xs tabular-nums">
                    {r.totalTarget > 0 ? (
                      <span className="font-semibold">
                        {r.totalCount}
                        <span className="font-normal text-muted-foreground">
                          /{r.totalTarget}
                        </span>
                      </span>
                    ) : (
                      <span className="font-semibold">{r.totalCount}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={statusBadgeVariant(r.status)}
                      className="font-medium"
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground">
                    {r.lastUpdate ? formatTimeWib(r.lastUpdate) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function JobCellView({ cell }) {
  const target = cell.target ?? 0;
  if (target === 0) {
    return <span className="font-medium text-foreground">{cell.count}</span>;
  }
  return (
    <span
      className={cn(
        "font-medium",
        cell.isMet ? "text-emerald-600" : "text-foreground"
      )}
    >
      {cell.count}
      <span className="font-normal text-muted-foreground">/{target}</span>
    </span>
  );
}

function TeamMonthlyPOTable({
  rows,
  clientColumns,
  currentUsername,
  onRowClick,
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/30 px-4 py-3 text-left">
                <span className="text-xs font-semibold tracking-tight text-muted-foreground">
                  Karyawan
                </span>
              </th>
              {clientColumns.map((c) => (
                <th key={c} className="px-3 py-3 text-center">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold tracking-tight text-muted-foreground">
                    <Receipt className="h-3 w-3" />
                    {c}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-right">
                <span className="text-xs font-semibold tracking-tight text-muted-foreground">
                  Total
                </span>
              </th>
              <th className="px-4 py-3 text-left min-w-[160px]">
                <span className="text-xs font-semibold tracking-tight text-muted-foreground">
                  Progress
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const initials = getInitials(r.user.fullName);
              const isMe = currentUsername === r.user.username;
              const clickable = !!onRowClick;
              return (
                <tr
                  key={r.user.username}
                  onClick={
                    clickable ? () => onRowClick(r.user) : undefined
                  }
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(r.user);
                          }
                        }
                      : undefined
                  }
                  tabIndex={clickable ? 0 : undefined}
                  role={clickable ? "button" : undefined}
                  aria-label={
                    clickable
                      ? `Lihat detail PO ${r.user.fullName}`
                      : undefined
                  }
                  className={cn(
                    "border-b border-border/60 transition-colors last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    clickable && "cursor-pointer",
                    isMe ? "bg-primary/5" : "hover:bg-accent/30"
                  )}
                >
                  <td className="sticky left-0 z-10 bg-background px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0 border border-border">
                        {r.user.avatar && (
                          <AvatarImage
                            src={r.user.avatar}
                            alt={`Avatar ${r.user.fullName}`}
                          />
                        )}
                        <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-medium tracking-tight">
                            {r.user.fullName}
                          </p>
                          {isMe && (
                            <Badge
                              variant="secondary"
                              className="h-4 px-1.5 text-[10px] font-medium"
                            >
                              Anda
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.user.role}
                        </p>
                      </div>
                    </div>
                  </td>
                  {clientColumns.map((c) => {
                    const cell = r.clients.find((x) => x.clientType === c);
                    return (
                      <td
                        key={c}
                        className="px-3 py-3 text-center align-top text-xs tabular-nums"
                      >
                        {cell ? (
                          <POJobCellView
                            totalIDR={cell.totalIDR}
                            targetIDR={cell.targetIDR}
                            isMet={cell.isMet}
                            percentage={cell.percentage}
                            count={cell.count}
                            newCount={cell.newCount}
                            repeatCount={cell.repeatCount}
                          />
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right align-top text-xs tabular-nums">
                    <div
                      className={cn(
                        "font-semibold",
                        r.allMet ? "text-emerald-600" : "text-foreground"
                      )}
                    >
                      {formatIDR(r.totalIDR)}
                    </div>
                    {r.totalTargetIDR > 0 && (
                      <div className="text-[11px] font-normal text-muted-foreground">
                        / {formatIDR(r.totalTargetIDR)}
                      </div>
                    )}
                    {r.totalNew + r.totalRepeat > 0 && (
                      <div className="mt-1 flex justify-end gap-1.5 text-[10px] tabular-nums">
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
                          {r.totalNew} baru
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
                          {r.totalRepeat} lama
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col gap-1.5">
                      <Progress
                        value={r.overallPercentage}
                        className={cn(
                          "h-1.5",
                          r.allMet && "[&>div]:bg-emerald-500"
                        )}
                      />
                      <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums text-muted-foreground">
                        <span>{r.overallPercentage}%</span>
                        {r.allMet ? (
                          <Badge
                            variant="success"
                            className="h-4 px-1.5 text-[10px] font-medium"
                          >
                            Tercapai
                          </Badge>
                        ) : r.totalIDR === 0 ? (
                          <span>Belum input</span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function POJobCellView({
  totalIDR,
  targetIDR,
  isMet,
  percentage,
  count,
  newCount,
  repeatCount,
}) {
  if (targetIDR <= 0 && totalIDR === 0 && count === 0) {
    return <span className="text-muted-foreground/50">—</span>;
  }
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={cn(
          "font-medium",
          isMet ? "text-emerald-600" : "text-foreground"
        )}
      >
        {formatIDR(totalIDR)}
      </span>
      {targetIDR > 0 && (
        <span className="text-[11px] font-normal text-muted-foreground">
          / {formatIDR(targetIDR)}
        </span>
      )}
      {targetIDR > 0 && (
        <span
          className={cn(
            "text-[10px] font-medium tabular-nums",
            isMet ? "text-emerald-600" : "text-muted-foreground"
          )}
        >
          {percentage}%
        </span>
      )}
      {newCount + repeatCount > 0 && (
        <span className="mt-0.5 flex items-center gap-1 text-[10px] tabular-nums">
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
            {newCount} baru
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
            {repeatCount} lama
          </span>
        </span>
      )}
    </div>
  );
}

function PoMonthFilter({
  value,
  currentMonth,
  onChange,
}) {
  const options = useMemo(() => getMonthOptions(currentMonth), [currentMonth]);
  const [yStr, mStr] = value.split("-");
  const yearOptions = useMemo(() => {
    const ys = new Set();
    for (const o of options) ys.add(o.split("-")[0]);
    return Array.from(ys).sort((a, b) => b.localeCompare(a));
  }, [options]);

  // Months valid for the picked year (so e.g. selecting future months in
  // a future year doesn't bleed past `currentMonth` for the current year).
  const monthOptions = useMemo(() => {
    return options
      .filter((o) => o.startsWith(`${yStr}-`))
      .map((o) => o.split("-")[1])
      .sort();
  }, [options, yStr]);

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Bulan"
        value={mStr}
        onChange={(e) => onChange(`${yStr}-${e.target.value}`)}
        className="flex h-9 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {monthOptions.map((mm) => {
          const idx = parseInt(mm, 10) - 1;
          return (
            <option key={mm} value={mm}>
              {BULAN_INDONESIA[idx] ?? mm}
            </option>
          );
        })}
      </select>
      <select
        aria-label="Tahun"
        value={yStr}
        onChange={(e) => {
          const nextYear = e.target.value;
          // Prefer keeping the same month if it's still in range; otherwise
          // snap to the latest month available for that year.
          const candidate = `${nextYear}-${mStr}`;
          if (options.includes(candidate)) {
            onChange(candidate);
          } else {
            const monthsForYear = options.filter((o) =>
              o.startsWith(`${nextYear}-`)
            );
            onChange(monthsForYear[0] ?? candidate);
          }
        }}
        className="flex h-9 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      {value !== currentMonth && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 text-xs"
          onClick={() => onChange(currentMonth)}
        >
          Reset
        </Button>
      )}
    </div>
  );
}

function PODrilldownDialog({
  user,
  month,
  open,
  onClose,
}) {
  // "month" = view satu bulan (default), "history" = scan semua bulan dalam
  // 24 bulan terakhir lalu group per-bulan.
  const [mode, setMode] = useState("month");
  // Reset mode setiap kali dialog dibuka untuk user/bulan baru.
  useEffect(() => {
    if (open) setMode("month");
  }, [open, user, month]);

  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setItemsLoading(true);
    const load = async () => {
      if (mode === "month") return getMonthlyPOItems(user, month);
      // History: scan 24 bulan ke belakang dari `month`. Cap konsisten dgn
      // PoMonthFilter agar tidak baca lebih jauh dari yang bisa dipilih user.
      const months = getMonthOptions(month);
      const chunks = await Promise.all(months.map((m) => getMonthlyPOItems(user, m)));
      const out = chunks.flat();
      // Newest-first untuk tampilan history.
      out.sort((a, b) => {
        const ta = a.item.timestamp || a.date;
        const tb = b.item.timestamp || b.date;
        return tb.localeCompare(ta);
      });
      return out;
    };
    load()
      .then((result) => {
        if (!cancelled) setItems(result);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, month, mode]);

  const summary = useMemo(() => {
    let total = 0;
    let baru = 0;
    let lama = 0;
    const perClient = new Map();
    const perMonth = new Map();
    for (const it of items) {
      const nominal =
        typeof it.item.nominalIDR === "number" &&
        Number.isFinite(it.item.nominalIDR)
          ? Math.max(0, Math.round(it.item.nominalIDR))
          : 0;
      total += nominal;
      if (it.item.customerKind === "baru") baru += 1;
      else if (it.item.customerKind === "lama") lama += 1;
      const c = it.job?.clientType ?? "—";
      const cBucket = perClient.get(c) ?? { sum: 0, count: 0 };
      cBucket.sum += nominal;
      cBucket.count += 1;
      perClient.set(c, cBucket);
      const ym = it.date.slice(0, 7);
      const mBucket = perMonth.get(ym) ?? { sum: 0, count: 0 };
      mBucket.sum += nominal;
      mBucket.count += 1;
      perMonth.set(ym, mBucket);
    }
    return { total, baru, lama, perClient, perMonth };
  }, [items]);

  // Items grouped per-bulan untuk mode history (newest month first).
  const historyGroups = useMemo(() => {
    if (mode !== "history") return [];
    const map = new Map();
    for (const it of items) {
      const ym = it.date.slice(0, 7);
      const arr = map.get(ym) ?? [];
      arr.push(it);
      map.set(ym, arr);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([ym, rows]) => ({ ym, rows }));
  }, [items, mode]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Detail PO · {user?.fullName ?? ""}
          </DialogTitle>
          <DialogDescription>
            {mode === "month"
              ? `${formatMonthLabel(month)} · ${items.length} entry`
              : `Semua history (24 bulan) · ${items.length} entry`}
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div
          role="tablist"
          aria-label="Lingkup PO"
          className="inline-flex w-fit rounded-lg border border-border bg-muted/30 p-1"
        >
          {([
            { id: "month", label: "Bulan Ini" },
            { id: "history", label: "Semua History" },
          ]).map((o) => {
            const active = mode === o.id;
            return (
              <button
                key={o.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setMode(o.id)}
                className={cn(
                  "h-7 rounded-md px-2.5 text-xs font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            {mode === "month"
              ? "Belum ada PO untuk bulan ini."
              : "Belum ada PO sama sekali dalam 24 bulan terakhir."}
          </div>
        ) : (
          <>
            {/* Summary chips */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="font-medium">
                Total {formatIDR(summary.total)}
              </Badge>
              <Badge
                variant="outline"
                className="font-medium text-emerald-700 border-emerald-200 bg-emerald-50"
              >
                {summary.baru} baru
              </Badge>
              <Badge variant="outline" className="font-medium">
                {summary.lama} lama
              </Badge>
              {Array.from(summary.perClient.entries()).map(([c, b]) => (
                <Badge key={c} variant="muted" className="font-medium">
                  {c}: {formatIDR(b.sum)} · {b.count}
                </Badge>
              ))}
            </div>

            {mode === "history" ? (
              <div className="flex flex-col gap-4">
                {historyGroups.map((group) => {
                  const stat = summary.perMonth.get(group.ym);
                  return (
                    <section
                      key={group.ym}
                      className="overflow-hidden rounded-md border border-border"
                    >
                      <header className="flex items-baseline justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
                        <h3 className="text-xs font-semibold tracking-tight">
                          {formatMonthLabel(group.ym)}
                        </h3>
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {stat?.count ?? 0} entry · {formatIDR(stat?.sum ?? 0)}
                        </span>
                      </header>
                      <POItemsTable rows={group.rows} />
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <POItemsTable rows={items} />
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function POItemsTable({
  rows,
}) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-muted/30">
        <tr>
          <th className="px-3 py-2 text-left font-semibold tracking-tight text-muted-foreground">
            Tgl
          </th>
          <th className="px-3 py-2 text-left font-semibold tracking-tight text-muted-foreground">
            Perusahaan
          </th>
          <th className="px-3 py-2 text-left font-semibold tracking-tight text-muted-foreground">
            Customer
          </th>
          <th className="px-3 py-2 text-center font-semibold tracking-tight text-muted-foreground">
            Status
          </th>
          <th className="px-3 py-2 text-right font-semibold tracking-tight text-muted-foreground">
            Nominal
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const customerName = row.item.jobLabel
            ? row.item.title.startsWith(`${row.item.jobLabel} - `)
              ? row.item.title.slice(row.item.jobLabel.length + 3)
              : row.item.title
            : row.item.title;
          return (
            <tr key={row.item.id} className="border-t border-border/60">
              <td className="px-3 py-2 tabular-nums text-muted-foreground">
                {row.date.slice(8, 10)}/{row.date.slice(5, 7)}
              </td>
              <td className="px-3 py-2">
                {row.job?.clientType ? (
                  <span className="font-medium">{row.job.clientType}</span>
                ) : (
                  <span className="italic text-muted-foreground">
                    (job dihapus)
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <span className="font-medium">{customerName}</span>
                {row.item.description && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                    {row.item.description}
                  </p>
                )}
              </td>
              <td className="px-3 py-2 text-center">
                {row.item.customerKind === "baru" ? (
                  <Badge
                    variant="outline"
                    className="font-medium text-emerald-700 border-emerald-200 bg-emerald-50"
                  >
                    Baru
                  </Badge>
                ) : row.item.customerKind === "lama" ? (
                  <Badge variant="outline" className="font-medium">
                    Lama
                  </Badge>
                ) : (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                {formatIDR(row.item.nominalIDR ?? 0)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function DailyDrilldownDialog({
  user,
  defaultDate,
  open,
  onClose,
}) {
  const [date, setDate] = useState(defaultDate);

  // When the dialog opens, snap the picker to the page's "today". The user
  // can then change to any past day they want to inspect.
  useEffect(() => {
    if (open) setDate(defaultDate);
  }, [open, defaultDate]);

  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setItemsLoading(true);
    getInputList(user.username, date)
      .then((result) => {
        if (!cancelled) setItems(result);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, date]);

  const stats = useMemo(() => {
    if (!user) return null;
    return computeJobStats(user, items);
  }, [user, items]);

  // Sort items oldest-first within the day so the timeline reads naturally
  // top-to-bottom.
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) =>
      (a.timestamp || "").localeCompare(b.timestamp || "")
    );
  }, [items]);

  const isToday = date === defaultDate;
  const dayHoliday = getHoliday(date);
  const dayWeekend = !dayHoliday && isWeekend(date);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Aktivitas · {user?.fullName ?? ""}
          </DialogTitle>
          <DialogDescription>
            {formatDateStringIndonesian(date)}
            {isToday && " · Hari ini"}
          </DialogDescription>
        </DialogHeader>

        {/* Date picker */}
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="daily-drill-date" className="text-xs font-medium">
            Tanggal
          </label>
          <input
            id="daily-drill-date"
            type="date"
            value={date}
            max={defaultDate}
            onChange={(e) => setDate(e.target.value || defaultDate)}
            className="flex h-9 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {!isToday && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 text-xs"
              onClick={() => setDate(defaultDate)}
            >
              Hari ini
            </Button>
          )}
          {dayHoliday && (
            <Badge variant="secondary" className="font-medium">
              {dayHoliday.name}
            </Badge>
          )}
          {dayWeekend && (
            <Badge variant="secondary" className="font-medium">
              Akhir Pekan
            </Badge>
          )}
        </div>

        {/* Per-job summary chips (target progress for the picked day) */}
        {stats && stats.jobs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {stats.jobs.map((s) => (
              <Badge
                key={s.job.id}
                variant={s.isMet ? "success" : "outline"}
                className="font-medium tabular-nums"
              >
                {s.job.label}: {s.count}/{s.job.dailyTarget ?? 0}
              </Badge>
            ))}
            {stats.otherCount > 0 && (
              <Badge variant="muted" className="font-medium tabular-nums">
                Lainnya: {stats.otherCount}
              </Badge>
            )}
          </div>
        )}

        {/* Items list */}
        {sortedItems.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            {dayHoliday || dayWeekend
              ? "Tidak ada aktivitas — hari libur."
              : "Belum ada input untuk hari ini."}
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {sortedItems.map((it) => {
              const time = it.timestamp ? formatTimeWib(it.timestamp) : "—";
              const isPO = typeof it.nominalIDR === "number" && it.nominalIDR > 0;
              return (
                <li
                  key={it.id}
                  className="rounded-md border border-border bg-background px-3 py-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold tracking-tight">
                      {it.title || "(tanpa judul)"}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {time} WIB
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {it.jobLabel ? (
                      <Badge variant="secondary" className="font-medium">
                        {it.jobLabel}
                      </Badge>
                    ) : (
                      <Badge variant="muted" className="font-medium">
                        Lainnya
                      </Badge>
                    )}
                    {isPO && (
                      <Badge
                        variant="outline"
                        className="font-medium tabular-nums"
                      >
                        {formatIDR(it.nominalIDR ?? 0)}
                      </Badge>
                    )}
                    {it.customerKind === "baru" && (
                      <Badge
                        variant="outline"
                        className="font-medium text-emerald-700 border-emerald-200 bg-emerald-50"
                      >
                        Baru
                      </Badge>
                    )}
                    {it.customerKind === "lama" && (
                      <Badge variant="outline" className="font-medium">
                        Lama
                      </Badge>
                    )}
                  </div>
                  {it.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {it.description}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
