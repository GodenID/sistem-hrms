import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  List,
  ListChecks,
  LogOut,
  Search,
  SearchX,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";
import AuthGuard from "../../components/AuthGuard";
import BackToHrms from "../../components/BackToHrms";
import OnboardingTour from "../../components/OnboardingTour";
import HolidayBanner, { WeekendBanner } from "../../components/HolidayBanner";
import AnimatedNumber from "../../components/AnimatedNumber";
import { useAuth } from "../../contexts/AuthContext";
import { useUsers } from "../../contexts/UserContext";
import { api } from "../../../services/api";
import { formatDateIndonesian, isWeekend } from "../../lib/dateUtils";
import { useWibToday } from "../../hooks/useWibToday";
import { getHoliday } from "../../lib/holidays";
import { computeJobStats, getUserJobs } from "../../lib/jobs";
import {
  exportTeamSummaryCSV,
  exportTodaySnapshotCSV,
} from "../../lib/export";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Progress } from "../../components/ui/progress";
import { Skeleton } from "../../components/ui/skeleton";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

const VIEW_MODE_KEY = "dit_admin_view_mode";
const PAGE_SIZE = 20;

function getInitials(fullName) {
  const words = fullName.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return (words[0]?.[0] ?? "").toUpperCase();
}

function computeStatus(count, percentage, allMet, isOffDay) {
  if (isOffDay) return "Libur";
  if (count === 0) return "Belum Input";
  if (allMet) return "Tercapai";
  if (percentage >= 50) return "On Track";
  return "Underperform";
}

function statusBadgeVariant(status) {
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

// Numeric weight for sorting status column.
function statusOrder(status) {
  switch (status) {
    case "Tercapai":
      return 0;
    case "On Track":
      return 1;
    case "Underperform":
      return 2;
    case "Libur":
      return 3;
    case "Belum Input":
    default:
      return 4;
  }
}

export default function AdminDashboardPage() {
  const { currentUser, logout } = useAuth();
  const { users, isLoading: usersLoading } = useUsers();
  const navigate = useNavigate();
  const [stats, setStats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  // WIB-today; auto-flips at WIB midnight so the dashboard re-aggregates
  // against the new day's bucket.
  const todayDate = useWibToday();
  const holiday = getHoliday(todayDate);
  const weekend = !holiday && isWeekend(todayDate);

  const [viewMode, setViewMode] = useState("card");
  const [sortBy, setSortBy] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);

  // Restore persisted view-mode preference on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      if (saved === "card" || saved === "table") {
        setViewMode(saved);
      }
    } catch {
      // ignore — default stays "card"
    }
  }, []);

  const updateViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // ignore — preference is best-effort
    }
  };

  // Compute today's stats for every karyawan in the live user list.
  // Re-runs on user-list changes AND on WIB-day rollover (todayDate hook).
  useEffect(() => {
    if (usersLoading) return;
    let cancelled = false;
    setIsLoading(true);

    const employees = users.filter((u) => u.userType !== "admin");

    // Single round-trip: today's inputs for the whole team.
    api(`/okr/team?from=${todayDate}&to=${todayDate}`)
      .then((res) => {
        if (cancelled) return;
        const itemsByUser = new Map();
        for (const it of res.inputs || []) {
          if (!itemsByUser.has(it.username)) itemsByUser.set(it.username, []);
          itemsByUser.get(it.username).push(it);
        }

        const computed = employees.map((user) => {
          const items = itemsByUser.get(user.username) || [];
          const jobStats = computeJobStats(user, items);
          const userJobs = getUserJobs(user);
          const target =
            userJobs.length > 0
              ? userJobs.reduce(
                  (s, j) =>
                    (j.type ?? "standard") === "standard"
                      ? s + (j.dailyTarget ?? 0)
                      : s,
                  0
                )
              : user.dailyTarget ?? 0;
          const status = computeStatus(
            jobStats.totalCount,
            jobStats.overallPercentage,
            jobStats.allMet,
            !!holiday || weekend
          );
          return {
            user,
            count: jobStats.totalCount,
            target,
            percentage: jobStats.overallPercentage,
            status,
            allMet: jobStats.allMet,
          };
        });

        setStats(computed);
      })
      .catch(() => {
        if (!cancelled) setStats([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [users, usersLoading, todayDate, holiday, weekend]);

  const employees = useMemo(() => stats.map((s) => s.user), [stats]);

  // Top-level summary numbers
  const summary = useMemo(() => {
    const total = stats.length;
    const achieved = stats.filter((s) => s.status === "Tercapai").length;
    const notInput = stats.filter((s) => s.status === "Belum Input").length;
    return { total, achieved, notInput };
  }, [stats]);

  // Apply filter + search
  const filteredStats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return stats.filter((s) => {
      // Status filter
      if (filter === "belum" && s.status !== "Belum Input") return false;
      if (filter === "tercapai" && s.status !== "Tercapai") return false;
      if (filter === "underperform" && s.status !== "Underperform")
        return false;

      // Search filter
      if (q) {
        const matchesName = s.user.fullName.toLowerCase().includes(q);
        const matchesUsername = s.user.username.toLowerCase().includes(q);
        const matchesRole = s.user.role.toLowerCase().includes(q);
        if (!matchesName && !matchesUsername && !matchesRole) return false;
      }
      return true;
    });
  }, [stats, filter, searchQuery]);

  // Sort filtered stats — only applied in table view.
  const sortedStats = useMemo(() => {
    if (viewMode !== "table" || sortBy === null) return filteredStats;

    const collator = new Intl.Collator("id", { sensitivity: "base" });
    const dir = sortOrder === "asc" ? 1 : -1;
    return [...filteredStats].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = collator.compare(a.user.fullName, b.user.fullName);
          break;
        case "role":
          cmp = collator.compare(a.user.role, b.user.role);
          break;
        case "status":
          cmp = statusOrder(a.status) - statusOrder(b.status);
          break;
        case "count":
          cmp = a.count - b.count;
          break;
        case "percentage":
          cmp = a.percentage - b.percentage;
          break;
      }
      return cmp * dir;
    });
  }, [filteredStats, sortBy, sortOrder, viewMode]);

  // Reset pagination whenever filters/search/sort/view change.
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery, sortBy, sortOrder, viewMode]);

  // Clamp page when filtered list shrinks below current page boundary.
  const totalPages = Math.max(1, Math.ceil(sortedStats.length / PAGE_SIZE));
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedStats = useMemo(() => {
    if (sortedStats.length <= PAGE_SIZE) return sortedStats;
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedStats.slice(start, start + PAGE_SIZE);
  }, [sortedStats, currentPage]);

  const showPagination = sortedStats.length > PAGE_SIZE;
  const rangeStart = sortedStats.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, sortedStats.length);

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
  };

  const handleExportToday = async () => {
    if (employees.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }
    try {
      await exportTodaySnapshotCSV(employees, todayDate);
      toast.success("Laporan berhasil diunduh");
    } catch {
      toast.error("Gagal mengunduh laporan");
    }
  };

  const handleExportFull = async () => {
    if (employees.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }
    try {
      await exportTeamSummaryCSV(employees);
      toast.success("Laporan berhasil diunduh");
    } catch {
      toast.error("Gagal mengunduh laporan");
    }
  };

  const handleEmployeeClick = (username) => {
    navigate(`/okr/admin/employee/${encodeURIComponent(username)}`);
  };

  const adminInitials = currentUser ? getInitials(currentUser.fullName) : "MA";

  return (
    <AuthGuard adminOnly={true}>
      <div className="min-h-screen bg-background">
        {/* Top Header */}
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
                  Admin Console
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentUser && (
                <div className="hidden items-center gap-2.5 rounded-full border border-border bg-background px-2.5 py-1 sm:flex">
                  <Avatar className="h-6 w-6 border border-border">
                    {currentUser.avatar && (
                      <AvatarImage
                        src={currentUser.avatar}
                        alt={`Avatar ${currentUser.fullName}`}
                      />
                    )}
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">
                      {adminInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">
                    {currentUser.fullName}
                  </span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/okr/admin/monitoring")}
              >
                <ListChecks className="h-4 w-4" />
                <span className="hidden sm:inline">Monitoring</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/okr/admin/input")}
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Input Manual</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/okr/admin/users")}
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Kelola Karyawan</span>
              </Button>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10 animate-fade-in">
          {/* Title row */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h1 className="text-2xl font-bold tracking-tight">
                    Admin Dashboard
                  </h1>
                  <BackToHrms />
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDateIndonesian(new Date())}
                </p>
              </div>
            </div>

            {/* Export buttons */}
            <div
              className="flex flex-wrap items-center gap-2"
              data-tour="admin-export"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportToday}
                disabled={isLoading || employees.length === 0}
              >
                <Download className="h-4 w-4" />
                Export Hari Ini
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleExportFull}
                disabled={isLoading || employees.length === 0}
              >
                <Download className="h-4 w-4" />
                Export Lengkap
              </Button>
            </div>
          </div>

          {/* Holiday banner (WIB libur nasional) */}
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
          <div
            className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
            data-tour="admin-summary"
          >
            <SummaryCard
              icon={<Users className="h-4 w-4" />}
              label="Total Karyawan"
              value={summary.total}
              loading={isLoading}
            />
            <SummaryCard
              icon={<UserCheck className="h-4 w-4 text-emerald-600" />}
              label="Tercapai Hari Ini"
              value={summary.achieved}
              loading={isLoading}
            />
            <SummaryCard
              icon={<UserX className="h-4 w-4 text-muted-foreground" />}
              label="Belum Input"
              value={summary.notInput}
              loading={isLoading}
            />
          </div>

          {/* Filter + search + view toggle */}
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2" data-tour="admin-filter">
              <FilterChip
                active={filter === "all"}
                onClick={() => setFilter("all")}
              >
                Semua
              </FilterChip>
              <FilterChip
                active={filter === "belum"}
                onClick={() => setFilter("belum")}
              >
                Belum Input
              </FilterChip>
              <FilterChip
                active={filter === "tercapai"}
                onClick={() => setFilter("tercapai")}
              >
                Tercapai
              </FilterChip>
              <FilterChip
                active={filter === "underperform"}
                onClick={() => setFilter("underperform")}
              >
                Underperform
              </FilterChip>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative md:w-72" data-tour="admin-search">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama atau username"
                  className="pl-9 pr-9"
                  aria-label="Cari karyawan"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Bersihkan pencarian"
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* View mode toggle */}
              <div
                className="inline-flex h-10 items-center rounded-lg border border-border bg-background p-1"
                role="group"
                aria-label="Pilih tampilan"
                data-tour="admin-view-toggle"
              >
                <button
                  type="button"
                  onClick={() => updateViewMode("card")}
                  aria-pressed={viewMode === "card"}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    viewMode === "card"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Kartu</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateViewMode("table")}
                  aria-pressed={viewMode === "table"}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    viewMode === "table"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <List className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Tabel</span>
                </button>
              </div>
            </div>
          </div>

          {/* Employee list */}
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[110px] w-full rounded-xl" />
              ))}
            </div>
          ) : filteredStats.length === 0 ? (
            <AdminEmptyState
              hasUsers={stats.length > 0}
              filter={filter}
              searchQuery={searchQuery}
              onClearFilter={() => setFilter("all")}
              onClearSearch={() => setSearchQuery("")}
              onClearAll={() => {
                setFilter("all");
                setSearchQuery("");
              }}
              onManageUsers={() => navigate("/okr/admin/users")}
            />
          ) : viewMode === "table" ? (
            <>
              <EmployeeTable
                stats={paginatedStats}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                onRowClick={handleEmployeeClick}
              />
              {showPagination && (
                <PaginationBar
                  currentPage={currentPage}
                  totalPages={totalPages}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  total={sortedStats.length}
                  onChange={setCurrentPage}
                />
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {paginatedStats.map((s) => (
                  <EmployeeCard
                    key={s.user.username}
                    stat={s}
                    onClick={() => handleEmployeeClick(s.user.username)}
                  />
                ))}
              </div>
              {showPagination && (
                <PaginationBar
                  currentPage={currentPage}
                  totalPages={totalPages}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  total={sortedStats.length}
                  onChange={setCurrentPage}
                />
              )}
            </>
          )}
        </main>

        {/* First-login admin tour */}
        <OnboardingTour
          tourId="admin"
          steps={[
            {
              element: "[data-tour='admin-summary']",
              popover: {
                title: "Ringkasan Tim",
                description: "Statistik cepat tim Anda hari ini.",
              },
            },
            {
              element: "[data-tour='admin-filter']",
              popover: {
                title: "Filter Status",
                description:
                  "Filter karyawan berdasarkan status pencapaian.",
              },
            },
            {
              element: "[data-tour='admin-search']",
              popover: {
                title: "Pencarian",
                description: "Cari karyawan berdasarkan nama atau username.",
              },
            },
            {
              element: "[data-tour='admin-view-toggle']",
              popover: {
                title: "Tampilan",
                description: "Ganti antara tampilan kartu dan tabel.",
              },
            },
            {
              element: "[data-tour='admin-export']",
              popover: {
                title: "Export Laporan",
                description:
                  "Unduh laporan dalam format CSV untuk dianalisis lebih lanjut.",
              },
            },
          ]}
        />
      </div>
    </AuthGuard>
  );
}

function SummaryCard({ icon, label, value, format, loading }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        {loading ? (
          <Skeleton className="h-7 w-12" />
        ) : (
          <span className="text-2xl font-bold tracking-tight tabular-nums">
            {typeof value === "number" ? (
              <AnimatedNumber value={value} format={format} />
            ) : (
              value
            )}
          </span>
        )}
      </CardContent>
    </Card>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
        (active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-accent")
      }
    >
      {children}
    </button>
  );
}

function EmployeeCard({ stat, onClick }) {
  const { user, count, target, percentage, status } = stat;
  const initials = getInitials(user.fullName);
  const isComplete = status === "Tercapai";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-foreground/20 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex items-center gap-4">
        <Avatar className="h-11 w-11 shrink-0 border border-border">
          {user.avatar && (
            <AvatarImage
              src={user.avatar}
              alt={`Avatar ${user.fullName}`}
            />
          )}
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 className="truncate text-sm font-semibold tracking-tight">
              {user.fullName}
            </h3>
            <Badge
              variant={statusBadgeVariant(status)}
              className="font-medium"
            >
              {status}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {user.role}
            <span className="mx-1.5">·</span>
            <span className="font-mono">@{user.username}</span>
          </p>
          <Progress
            value={percentage}
            indicatorClassName={isComplete ? "bg-emerald-500" : "bg-primary"}
            className="h-1.5"
          />
          <p className="text-xs text-muted-foreground tabular-nums">
            {count} dari {target} item
            <span className="mx-1.5">·</span>
            {percentage}%
          </p>
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
    </button>
  );
}

function SortButton({ active, order, onClick, children, align = "left" }) {
  const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex w-full items-center gap-1.5 text-xs font-semibold tracking-tight transition-colors hover:text-foreground",
        active ? "text-foreground" : "text-muted-foreground",
        align === "right" && "justify-end",
        align === "center" && "justify-center"
      )}
    >
      <span>{children}</span>
      <Icon className={cn("h-3 w-3", !active && "opacity-60")} />
    </button>
  );
}

function EmployeeTable({ stats, sortBy, sortOrder, onSort, onRowClick }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className="px-4 py-3 text-left">
                <SortButton
                  active={sortBy === "name"}
                  order={sortOrder}
                  onClick={() => onSort("name")}
                >
                  Nama
                </SortButton>
              </th>
              <th className="hidden px-4 py-3 text-left md:table-cell">
                <SortButton
                  active={sortBy === "role"}
                  order={sortOrder}
                  onClick={() => onSort("role")}
                >
                  Role
                </SortButton>
              </th>
              <th className="hidden px-4 py-3 text-left lg:table-cell">
                <span className="text-xs font-semibold tracking-tight text-muted-foreground">
                  Username
                </span>
              </th>
              <th className="px-4 py-3 text-left">
                <SortButton
                  active={sortBy === "status"}
                  order={sortOrder}
                  onClick={() => onSort("status")}
                >
                  Status
                </SortButton>
              </th>
              <th className="hidden px-4 py-3 text-left sm:table-cell">
                <span className="text-xs font-semibold tracking-tight text-muted-foreground">
                  Progress
                </span>
              </th>
              <th className="px-4 py-3 text-right">
                <SortButton
                  active={sortBy === "count"}
                  order={sortOrder}
                  onClick={() => onSort("count")}
                  align="right"
                >
                  Item
                </SortButton>
              </th>
              <th className="px-4 py-3 text-right">
                <SortButton
                  active={sortBy === "percentage"}
                  order={sortOrder}
                  onClick={() => onSort("percentage")}
                  align="right"
                >
                  %
                </SortButton>
              </th>
              <th className="w-12 px-4 py-3 text-right">
                <span className="sr-only">Detail</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
              const initials = getInitials(s.user.fullName);
              const isComplete = s.status === "Tercapai";
              return (
                <tr
                  key={s.user.username}
                  onClick={() => onRowClick(s.user.username)}
                  className="group cursor-pointer border-b border-border/60 transition-colors last:border-b-0 hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(s.user.username);
                    }
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0 border border-border">
                        {s.user.avatar && (
                          <AvatarImage
                            src={s.user.avatar}
                            alt={`Avatar ${s.user.fullName}`}
                          />
                        )}
                        <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm font-medium tracking-tight">
                        {s.user.fullName}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                    {s.user.role}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground lg:table-cell">
                    @{s.user.username}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={statusBadgeVariant(s.status)}
                      className="font-medium"
                    >
                      {s.status}
                    </Badge>
                  </td>
                  <td className="hidden min-w-[140px] px-4 py-3 sm:table-cell">
                    <Progress
                      value={s.percentage}
                      indicatorClassName={
                        isComplete ? "bg-emerald-500" : "bg-primary"
                      }
                      className="h-1.5"
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground">
                    {s.count}/{s.target}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-medium tabular-nums">
                    {s.percentage}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
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

function AdminEmptyState({
  hasUsers,
  filter,
  searchQuery,
  onClearFilter,
  onClearSearch,
  onClearAll,
  onManageUsers,
}) {
  const trimmedQuery = searchQuery.trim();
  const hasSearch = trimmedQuery.length > 0;
  const hasFilter = filter !== "all";

  let icon = (
    <Users className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
  );
  let title = "Belum ada karyawan terdaftar";
  let description =
    "Tambahkan karyawan terlebih dahulu untuk mulai memantau pencapaian harian.";
  let primaryAction = (
    <Button variant="default" size="sm" onClick={onManageUsers}>
      <UserPlus className="h-4 w-4" />
      Tambah Karyawan
    </Button>
  );
  let secondaryAction = null;

  if (hasUsers && hasSearch && hasFilter) {
    icon = <SearchX className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />;
    title = "Tidak ada karyawan yang cocok";
    description = `Tidak ditemukan hasil untuk "${trimmedQuery}" pada filter status saat ini. Coba ubah kata kunci atau bersihkan filter.`;
    primaryAction = (
      <Button variant="default" size="sm" onClick={onClearAll}>
        Bersihkan Pencarian & Filter
      </Button>
    );
  } else if (hasUsers && hasSearch) {
    icon = <SearchX className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />;
    title = "Pencarian tidak menemukan hasil";
    description = `Tidak ada karyawan dengan nama, username, atau role yang cocok dengan "${trimmedQuery}".`;
    primaryAction = (
      <Button variant="default" size="sm" onClick={onClearSearch}>
        <X className="h-4 w-4" />
        Bersihkan Pencarian
      </Button>
    );
  } else if (hasUsers && filter === "belum") {
    icon = <UserCheck className="h-6 w-6 text-emerald-600" strokeWidth={1.75} />;
    title = "Semua karyawan sudah input hari ini";
    description =
      "Tidak ada karyawan dengan status Belum Input. Semua orang sudah mulai mencatat aktivitas mereka.";
    primaryAction = (
      <Button variant="outline" size="sm" onClick={onClearFilter}>
        Lihat Semua Karyawan
      </Button>
    );
  } else if (hasUsers && filter === "tercapai") {
    icon = <UserX className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />;
    title = "Belum ada yang mencapai target";
    description =
      "Belum ada karyawan yang menyelesaikan target harian mereka. Pantau terus progres mereka.";
    primaryAction = (
      <Button variant="outline" size="sm" onClick={onClearFilter}>
        Lihat Semua Karyawan
      </Button>
    );
  } else if (hasUsers && filter === "underperform") {
    icon = <UserCheck className="h-6 w-6 text-emerald-600" strokeWidth={1.75} />;
    title = "Tidak ada karyawan underperform";
    description =
      "Semua karyawan berada pada jalur yang baik atau telah mencapai target. Pertahankan momentum tim.";
    primaryAction = (
      <Button variant="outline" size="sm" onClick={onClearFilter}>
        Lihat Semua Karyawan
      </Button>
    );
  } else if (hasUsers) {
    icon = <SearchX className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />;
    title = "Tidak ada karyawan yang cocok";
    description = "Coba sesuaikan filter atau kata kunci pencarian.";
    primaryAction = (
      <Button variant="outline" size="sm" onClick={onClearAll}>
        Bersihkan Filter
      </Button>
    );
  }

  if (!hasUsers) {
    secondaryAction = null;
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center px-6 py-14 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>
        <h3 className="mb-1.5 text-base font-semibold tracking-tight">
          {title}
        </h3>
        <p className="mb-5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      </CardContent>
    </Card>
  );
}

function PaginationBar({
  currentPage,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onChange,
}) {
  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <nav
      aria-label="Pagination karyawan"
      className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row"
    >
      <p
        className="text-xs text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        Menampilkan{" "}
        <span className="font-medium text-foreground">{rangeStart}</span>–
        <span className="font-medium text-foreground">{rangeEnd}</span> dari{" "}
        <span className="font-medium text-foreground">{total}</span> karyawan
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Sebelumnya</span>
        </Button>

        <ul className="flex items-center gap-1" role="list">
          {pages.map((p, idx) =>
            p === "ellipsis" ? (
              <li
                key={`ellipsis-${idx}`}
                className="px-2 text-xs text-muted-foreground"
                aria-hidden="true"
              >
                …
              </li>
            ) : (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => onChange(p)}
                  aria-current={p === currentPage ? "page" : undefined}
                  aria-label={`Halaman ${p}`}
                  className={cn(
                    "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    p === currentPage
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {p}
                </button>
              </li>
            )
          )}
        </ul>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          aria-label="Halaman berikutnya"
        >
          <span className="hidden sm:inline">Berikutnya</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}

function getPageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = [1];

  if (current > 3) pages.push("ellipsis");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("ellipsis");

  pages.push(total);
  return pages;
}
