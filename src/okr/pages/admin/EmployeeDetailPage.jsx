import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  Briefcase,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  TrendingUp,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import AuthGuard from "../../components/AuthGuard";
import BackToHrms from "../../components/BackToHrms";
import InputItemComponent from "../../components/InputItem";
import InputForm from "../../components/InputForm";
import DeleteDialog from "../../components/DeleteDialog";
import AnimatedNumber from "../../components/AnimatedNumber";
import { useUsers } from "../../contexts/UserContext";
import { api } from "../../../services/api";
import { getInputRange } from "../../lib/storage";
import { formatDateStringIndonesian } from "../../lib/dateUtils";
import { useWibToday } from "../../hooks/useWibToday";
import { exportEmployeeCSV } from "../../lib/export";
import {
  computeJobStats,
  getItemTypedSuffix,
  getUserJobs,
} from "../../lib/jobs";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { Skeleton } from "../../components/ui/skeleton";

function getInitials(fullName) {
  const words = fullName.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return (words[0]?.[0] ?? "").toUpperCase();
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const username = useMemo(() => {
    // Next.js App Router already URL-decodes route params, so we just need
    // to coerce the value into a string and tolerate the array form some
    // catch-all routes can produce.
    const raw = params?.username;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return raw ?? "";
  }, [params]);

  const { getUserByUsername, isLoading: usersLoading } = useUsers();
  const employee = useMemo(
    () => getUserByUsername(username),
    [getUserByUsername, username]
  );

  // WIB-today; ensures the "Hari Ini" badge follows the WIB calendar.
  const today = useWibToday();

  const [itemsByDate, setItemsByDate] = useState({});
  const [allDates, setAllDates] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Edit/delete state — admin only.
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);

  useEffect(() => {
    if (usersLoading) return;
    if (!employee) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    // Pull every recorded input and group per date, then ensure today is
    // listed (so admin can confirm "no input today" rather than the day
    // disappearing entirely).
    getInputRange(employee.username, "1900-01-01", today)
      .then((items) => {
        if (cancelled) return;
        const itemsMap = {};
        for (const item of items) {
          const d = (item.workDate || item.date || "").slice(0, 10);
          if (!itemsMap[d]) itemsMap[d] = [];
          itemsMap[d].push(item);
        }
        const stored = Object.keys(itemsMap);
        const dates = stored.includes(today) ? stored : [today, ...stored];
        dates.sort((a, b) => b.localeCompare(a));
        setItemsByDate(itemsMap);
        setAllDates(dates);
      })
      .catch(() => {
        if (!cancelled) {
          setItemsByDate({});
          setAllDates([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employee, usersLoading, today]);

  const userJobs = useMemo(
    () => (employee ? getUserJobs(employee) : []),
    [employee]
  );
  const totalDailyTarget = useMemo(
    () =>
      userJobs.reduce(
        (sum, j) =>
          (j.type ?? "standard") === "standard" ? sum + (j.dailyTarget ?? 0) : sum,
        0
      ),
    [userJobs]
  );

  // Derive date entries from itemsByDate so they stay in sync after edits/deletes.
  const dateEntries = useMemo(() => {
    if (!employee) return [];
    return allDates.map((date) => {
      const items = itemsByDate[date] ?? [];
      const stats = computeJobStats(employee, items);
      const formattedDate = formatDateStringIndonesian(date);
      return {
        date,
        formattedDate,
        itemCount: stats.totalCount,
        totalTarget: totalDailyTarget,
        percentage: stats.overallPercentage,
        allMet: stats.allMet,
        isToday: date === today,
      };
    });
  }, [employee, allDates, itemsByDate, totalDailyTarget, today]);

  // All-time aggregate stats. Today is included only when the employee has
  // actually logged something — otherwise the "active days" count would be
  // misleading.
  const stats = useMemo(() => {
    const activeEntries = dateEntries.filter((e) => e.itemCount > 0);
    const totalDays = activeEntries.length;
    const totalItems = activeEntries.reduce((sum, e) => sum + e.itemCount, 0);
    const avgPerDay =
      totalDays === 0 ? 0 : Math.round((totalItems / totalDays) * 10) / 10;
    const mostProductive = activeEntries.reduce(
      (best, e) => (best === null || e.itemCount > best.itemCount ? e : best),
      null
    );
    return { totalDays, totalItems, avgPerDay, mostProductive };
  }, [dateEntries]);

  const toggleExpanded = (date) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const handleExport = async () => {
    if (!employee) return;
    if (stats.totalItems === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }
    try {
      await exportEmployeeCSV(employee);
      toast.success("Riwayat berhasil diunduh");
    } catch {
      toast.error("Gagal mengunduh riwayat");
    }
  };

  const handleEditSubmit = async (data) => {
    if (!editingItem) return false;
    const { date, item } = editingItem;
    try {
      const res = await api(`/okr/inputs/${item.id}`, {
        method: "PUT",
        body: {
          title: data.title,
          description: data.description || "",
          jobId: data.jobId || null,
          jobLabel: data.jobLabel || null,
          nominalIDR: data.nominalIDR ?? null,
          customerKind: data.customerKind ?? null,
        },
      });
      setItemsByDate((prev) => ({
        ...prev,
        [date]: (prev[date] ?? []).map((it) => (it.id === item.id ? res.item : it)),
      }));
      toast.success("Item berhasil diperbarui");
      setEditingItem(null);
      return true;
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan data");
      return false;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    const { date, item } = deletingItem;
    try {
      await api(`/okr/inputs/${item.id}`, { method: "DELETE" });
      setItemsByDate((prev) => ({
        ...prev,
        [date]: (prev[date] ?? []).filter((it) => it.id !== item.id),
      }));
      toast.success("Item berhasil dihapus");
    } catch (err) {
      toast.error(err.message || "Gagal menghapus data");
    }
    setDeletingItem(null);
  };

  return (
    <AuthGuard adminOnly={true}>
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-10 animate-fade-in">
          <Button variant="outline" size="sm" asChild className="mb-6">
            <Link to="/okr/admin">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Admin Dashboard
            </Link>
          </Button>

          {!employee ? (
            <Card>
              <CardContent className="flex flex-col items-center px-4 py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <UserX
                    className="h-6 w-6 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                </div>
                <h3 className="text-base font-semibold tracking-tight">
                  Karyawan tidak ditemukan
                </h3>
                <p className="mt-1 max-w-[320px] text-sm text-muted-foreground">
                  Username{" "}
                  <span className="font-mono">{username || "(kosong)"}</span>{" "}
                  tidak terdaftar di sistem.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Profile card */}
              <Card className="mb-6">
                <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 border border-border">
                      {employee.avatar && (
                        <AvatarImage
                          src={employee.avatar}
                          alt={`Avatar ${employee.fullName}`}
                        />
                      )}
                      <AvatarFallback className="bg-primary text-primary-foreground text-base font-semibold">
                        {getInitials(employee.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl font-bold tracking-tight">
                          {employee.fullName}
                        </h1>
                        <BackToHrms />
                        {employee.suspended && (
                          <Badge
                            variant="destructive"
                            className="font-medium"
                          >
                            Suspended
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="font-medium">
                          {employee.role}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          @{employee.username}
                        </span>
                      </div>
                      {userJobs.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {userJobs.map((job) => (
                            <Badge
                              key={job.id}
                              variant="outline"
                              className="gap-1.5 font-medium"
                            >
                              <Briefcase className="h-3 w-3 text-muted-foreground" />
                              <span>{job.label}</span>
                              <span className="tabular-nums text-muted-foreground">
                                · {job.dailyTarget}/hari
                              </span>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Belum ada job utama
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleExport}
                    disabled={isLoading}
                  >
                    <Download className="h-4 w-4" />
                    Export Riwayat
                  </Button>
                </CardContent>
              </Card>

              {/* Stats summary */}
              <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                  icon={<Calendar className="h-4 w-4" />}
                  label="Hari Aktif"
                  value={stats.totalDays}
                  loading={isLoading}
                />
                <StatCard
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Total Item"
                  value={stats.totalItems}
                  loading={isLoading}
                />
                <StatCard
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Rata-rata / Hari"
                  value={stats.avgPerDay}
                  loading={isLoading}
                />
                <StatCard
                  icon={<Award className="h-4 w-4 text-emerald-600" />}
                  label="Hari Terproduktif"
                  value={
                    stats.mostProductive
                      ? `${stats.mostProductive.itemCount} item`
                      : "—"
                  }
                  loading={isLoading}
                />
              </div>

              {/* History list */}
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-base font-semibold tracking-tight">
                  Riwayat Lengkap
                </h2>
                {!isLoading && (
                  <Badge variant="secondary" className="font-medium tabular-nums">
                    {dateEntries.length}
                  </Badge>
                )}
              </div>

              {isLoading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-[100px] w-full rounded-xl" />
                  ))}
                </div>
              ) : dateEntries.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center px-4 py-12 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Calendar
                        className="h-5 w-5 text-muted-foreground"
                        strokeWidth={1.75}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Belum ada riwayat input
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-3">
                  {dateEntries.map((entry) => {
                    const isOpen = expanded.has(entry.date);
                    const items = itemsByDate[entry.date] ?? [];
                    const isComplete = entry.allMet;

                    return (
                      <div
                        key={entry.date}
                        className="overflow-hidden rounded-xl border border-border bg-card"
                      >
                        <button
                          type="button"
                          onClick={() => toggleExpanded(entry.date)}
                          className="group flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                          aria-expanded={isOpen}
                        >
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <h3 className="truncate text-sm font-semibold tracking-tight">
                                {entry.formattedDate}
                              </h3>
                              {entry.isToday && (
                                <Badge variant="outline" className="font-medium">
                                  Hari Ini
                                </Badge>
                              )}
                              <Badge
                                variant={isComplete ? "success" : "secondary"}
                                className="font-medium tabular-nums"
                              >
                                {entry.percentage}%
                              </Badge>
                            </div>
                            <Progress
                              value={entry.percentage}
                              indicatorClassName={
                                isComplete ? "bg-emerald-500" : "bg-primary"
                              }
                              className="h-1.5"
                            />
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {entry.itemCount} item
                              {entry.totalTarget > 0 && (
                                <>
                                  <span className="mx-1">·</span>
                                  Total target {entry.totalTarget}
                                </>
                              )}
                            </p>
                          </div>
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                          )}
                        </button>

                        {isOpen && (
                          <div className="border-t border-border bg-muted/20 p-4 animate-fade-in">
                            {items.length === 0 ? (
                              <p className="px-1 py-3 text-center text-sm text-muted-foreground">
                                Tidak ada item pada tanggal ini
                              </p>
                            ) : (
                              <div className="flex flex-col gap-2.5">
                                {items.map((item) => {
                                  const isEditing =
                                    editingItem !== null &&
                                    editingItem.date === entry.date &&
                                    editingItem.item.id === item.id;
                                  if (isEditing) {
                                    return (
                                      <div
                                        key={item.id}
                                        className="rounded-xl border border-border bg-muted/30 p-4 animate-fade-in"
                                      >
                                        <InputForm
                                          mode="edit"
                                          jobs={userJobs}
                                          initialJobId={
                                            editingItem.item.jobId ?? null
                                          }
                                          initialTitleSuffix={getItemTypedSuffix(
                                            editingItem.item
                                          )}
                                          initialDescription={
                                            editingItem.item.description
                                          }
                                          initialNominalIDR={
                                            editingItem.item.nominalIDR
                                          }
                                          initialCustomerKind={
                                            editingItem.item.customerKind
                                          }
                                          onSubmit={handleEditSubmit}
                                          onCancel={() => setEditingItem(null)}
                                        />
                                      </div>
                                    );
                                  }
                                  return (
                                    <InputItemComponent
                                      key={item.id}
                                      item={item}
                                      onEdit={(it) =>
                                        setEditingItem({
                                          date: entry.date,
                                          item: it,
                                        })
                                      }
                                      onDelete={(it) =>
                                        setDeletingItem({
                                          date: entry.date,
                                          item: it,
                                        })
                                      }
                                    />
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>

        {/* Admin-only delete confirmation */}
        <DeleteDialog
          isOpen={deletingItem !== null}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingItem(null)}
        />
      </div>
    </AuthGuard>
  );
}

function StatCard({ icon, label, value, loading }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        {loading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <span className="text-xl font-bold tracking-tight tabular-nums">
            {typeof value === "number" ? (
              <AnimatedNumber value={value} />
            ) : (
              value
            )}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
