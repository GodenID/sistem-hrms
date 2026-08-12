import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  Briefcase,
  CheckCircle2,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import AuthGuard from "../../components/AuthGuard";
import BackToHrms from "../../components/BackToHrms";
import AnimatedNumber from "../../components/AnimatedNumber";
import { useAuth } from "../../contexts/AuthContext";
import { useUsers } from "../../contexts/UserContext";
import { CLIENT_TYPES } from "../../lib/types";
import { formatIDR, parseIDR } from "../../lib/jobs";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Skeleton } from "../../components/ui/skeleton";

function getInitials(fullName) {
  const words = fullName.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return (words[0]?.[0] ?? "").toUpperCase();
}

function jobsToDrafts(jobs) {
  if (!jobs || jobs.length === 0) {
    return [
      {
        id: tempId(),
        label: "",
        type: "standard",
        dailyTarget: "",
        monthlyTargetIDR: "",
        clientType: "",
      },
    ];
  }
  return jobs.map((j) => {
    const t = j.type ?? "standard";
    return {
      id: j.id,
      label: j.label,
      type: t,
      dailyTarget:
        t === "standard" && typeof j.dailyTarget === "number"
          ? String(j.dailyTarget)
          : "",
      monthlyTargetIDR:
        t === "po" && typeof j.monthlyTargetIDR === "number"
          ? String(j.monthlyTargetIDR)
          : "",
      clientType: t === "po" && j.clientType ? j.clientType : "",
    };
  });
}

let tempCounter = 0;
function tempId() {
  tempCounter += 1;
  return `__new_${tempCounter}_${Date.now()}`;
}

function isTempId(id) {
  return id.startsWith("__new_");
}

export default function UsersPage() {
  const { session } = useAuth();
  const {
    users,
    isLoading,
    createUser,
    updateUser,
    suspendUser,
    activateUser,
    deleteUser,
  } = useUsers();

  const [searchQuery, setSearchQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const karyawan = useMemo(() => {
    return users
      .filter((u) => u.userType !== "admin")
      .slice()
      .sort((a, b) =>
        new Intl.Collator("id", { sensitivity: "base" }).compare(
          a.fullName,
          b.fullName
        )
      );
  }, [users]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return karyawan;
    return karyawan.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [karyawan, searchQuery]);

  const summary = useMemo(() => {
    const total = karyawan.length;
    const suspended = karyawan.filter((u) => u.suspended).length;
    return { total, active: total - suspended, suspended };
  }, [karyawan]);

  const handleSuspendConfirm = () => {
    if (!suspendTarget) return;
    const u = suspendTarget;
    const result = u.suspended
      ? activateUser(u.username)
      : suspendUser(u.username);
    if (result.success) {
      toast.success(
        u.suspended
          ? `Akun ${u.fullName} berhasil diaktifkan`
          : `Akun ${u.fullName} berhasil ditangguhkan`
      );
    } else {
      toast.error(result.error ?? "Operasi gagal");
    }
    setSuspendTarget(null);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const u = deleteTarget;
    const result = deleteUser(u.username);
    if (result.success) {
      toast.success(`User ${u.fullName} berhasil dihapus`);
    } else {
      toast.error(result.error ?? "Operasi gagal");
    }
    setDeleteTarget(null);
  };

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

            <Button variant="outline" size="sm" asChild>
              <Link to="/okr/admin">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Kembali</span>
              </Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10 animate-fade-in">
          {/* Title row */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h1 className="text-2xl font-bold tracking-tight">
                    Kelola Karyawan
                  </h1>
                  <BackToHrms />
                </div>
                <p className="text-sm text-muted-foreground">
                  Tambah, edit, atau nonaktifkan akun karyawan
                </p>
              </div>
            </div>

            <Button onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Tambah User
            </Button>
          </div>

          {/* Summary stats */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            <SummaryCard
              icon={<Users className="h-4 w-4" />}
              label="Total Karyawan"
              value={summary.total}
              loading={isLoading}
            />
            <SummaryCard
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              label="Aktif"
              value={summary.active}
              loading={isLoading}
            />
            <SummaryCard
              icon={<Ban className="h-4 w-4 text-destructive" />}
              label="Suspended"
              value={summary.suspended}
              loading={isLoading}
            />
          </div>

          {/* Search */}
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-96">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, username, atau role"
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
          </div>

          {/* Users table */}
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[80px] w-full rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center px-4 py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Users
                    className="h-5 w-5 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? "Tidak ada karyawan yang cocok"
                    : "Belum ada karyawan terdaftar"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/30">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold tracking-tight text-muted-foreground">
                        Nama
                      </th>
                      <th className="hidden px-4 py-3 text-left text-xs font-semibold tracking-tight text-muted-foreground md:table-cell">
                        Role
                      </th>
                      <th className="hidden px-4 py-3 text-left text-xs font-semibold tracking-tight text-muted-foreground lg:table-cell">
                        Username
                      </th>
                      <th className="hidden px-4 py-3 text-left text-xs font-semibold tracking-tight text-muted-foreground md:table-cell">
                        Job Utama
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold tracking-tight text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold tracking-tight text-muted-foreground">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => {
                      const isMe = session?.username === u.username;
                      const initials = getInitials(u.fullName);
                      const jobs = u.jobs ?? [];
                      const visibleJobs = jobs.slice(0, 2);
                      const moreJobs = jobs.length - visibleJobs.length;
                      return (
                        <tr
                          key={u.username}
                          className="border-b border-border/60 transition-colors last:border-b-0 hover:bg-accent/40"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 shrink-0 border border-border">
                                {u.avatar && (
                                  <AvatarImage
                                    src={u.avatar}
                                    alt={`Avatar ${u.fullName}`}
                                  />
                                )}
                                <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate text-sm font-medium tracking-tight">
                                {u.fullName}
                              </span>
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                            {u.role}
                          </td>
                          <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground lg:table-cell">
                            @{u.username}
                          </td>
                          <td className="hidden px-4 py-3 md:table-cell">
                            {jobs.length === 0 ? (
                              <span className="text-xs italic text-muted-foreground">
                                —
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {visibleJobs.map((j) => (
                                  <Badge
                                    key={j.id}
                                    variant={j.type === "po" ? "outline" : "secondary"}
                                    className="font-medium"
                                  >
                                    {j.type === "po"
                                      ? `PO · ${j.clientType ?? j.label}`
                                      : j.label}
                                  </Badge>
                                ))}
                                {moreJobs > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="font-medium tabular-nums"
                                  >
                                    +{moreJobs}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={u.suspended ? "destructive" : "success"}
                              className="font-medium"
                            >
                              {u.suspended ? "Suspended" : "Aktif"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEditTarget(u)}
                                aria-label={`Edit ${u.fullName}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setSuspendTarget(u)}
                                disabled={isMe}
                                aria-label={
                                  u.suspended
                                    ? `Aktifkan ${u.fullName}`
                                    : `Tangguhkan ${u.fullName}`
                                }
                              >
                                {u.suspended ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Ban className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setDeleteTarget(u)}
                                disabled={isMe}
                                aria-label={`Hapus ${u.fullName}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </main>

        {/* Create dialog */}
        <UserFormDialog
          open={createOpen}
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSubmit={(payload) => {
            const result = createUser(payload);
            if (result.success) {
              toast.success(`User ${payload.fullName} berhasil dibuat`);
              setCreateOpen(false);
              return true;
            }
            toast.error(result.error ?? "Gagal membuat user");
            return false;
          }}
        />

        {/* Edit dialog */}
        <UserFormDialog
          open={editTarget !== null}
          mode="edit"
          existing={editTarget ?? undefined}
          onClose={() => setEditTarget(null)}
          onSubmit={(payload) => {
            if (!editTarget) return false;
            const result = updateUser(editTarget.username, payload);
            if (result.success) {
              toast.success(`User ${payload.fullName} berhasil diperbarui`);
              setEditTarget(null);
              return true;
            }
            toast.error(result.error ?? "Gagal memperbarui user");
            return false;
          }}
        />

        {/* Suspend / activate confirm */}
        <Dialog
          open={suspendTarget !== null}
          onOpenChange={(open) => !open && setSuspendTarget(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {suspendTarget?.suspended ? "Aktifkan Akun" : "Tangguhkan Akun"}
              </DialogTitle>
              <DialogDescription>
                {suspendTarget?.suspended
                  ? `Aktifkan akun ${suspendTarget?.fullName}? Mereka akan dapat login kembali.`
                  : `Tangguhkan akun ${suspendTarget?.fullName}? Mereka tidak bisa login sampai diaktifkan kembali.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => setSuspendTarget(null)}
              >
                Batal
              </Button>
              <Button
                variant={suspendTarget?.suspended ? "default" : "destructive"}
                onClick={handleSuspendConfirm}
              >
                {suspendTarget?.suspended ? "Aktifkan" : "Tangguhkan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <Dialog
          open={deleteTarget !== null}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Hapus User</DialogTitle>
              <DialogDescription>
                Hapus akun {deleteTarget?.fullName} secara permanen? Semua
                riwayat input juga akan dihapus. Tindakan ini tidak dapat
                dibatalkan.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
              >
                Batal
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>
                Hapus
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  );
}

function SummaryCard({ icon, label, value, loading }) {
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

function UserFormDialog({ open, mode, existing, onClose, onSubmit }) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [jobDrafts, setJobDrafts] = useState([]);
  const [errors, setErrors] = useState({});

  // Reset form whenever the dialog opens or the editing target changes.
  useEffect(() => {
    if (!open) return;
    setFullName(existing?.fullName ?? "");
    setUsername(existing?.username ?? "");
    setPassword("");
    setRole(existing?.role ?? "");
    setJobDrafts(jobsToDrafts(existing?.jobs));
    setErrors({});
  }, [open, existing]);

  const addJobRow = () => {
    setJobDrafts((prev) => {
      if (prev.length >= 3) return prev;
      return [
        ...prev,
        {
          id: tempId(),
          label: "",
          type: "standard",
          dailyTarget: "",
          monthlyTargetIDR: "",
          clientType: "",
        },
      ];
    });
  };

  const removeJobRow = (id) => {
    setJobDrafts((prev) => prev.filter((j) => j.id !== id));
  };

  const updateJobRow = (id, patch) => {
    setJobDrafts((prev) =>
      prev.map((j) => (j.id === id ? { ...j, ...patch } : j))
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const nextErrors = {};

    const trimmedName = fullName.trim();
    if (trimmedName.length === 0) nextErrors.fullName = "Nama wajib diisi";
    else if (trimmedName.length > 100)
      nextErrors.fullName = "Maksimal 100 karakter";

    const trimmedUsername = username.trim();
    if (mode === "create") {
      if (trimmedUsername.length === 0)
        nextErrors.username = "Username wajib diisi";
      else if (!/^[a-z0-9_]+$/.test(trimmedUsername))
        nextErrors.username =
          "Hanya boleh huruf kecil, angka, dan underscore";
      else if (trimmedUsername.length > 50)
        nextErrors.username = "Maksimal 50 karakter";
    }

    if (mode === "create") {
      if (password.length === 0) nextErrors.password = "Password wajib diisi";
      else if (password.length > 100)
        nextErrors.password = "Maksimal 100 karakter";
    } else if (password.length > 0 && password.length > 100) {
      nextErrors.password = "Maksimal 100 karakter";
    }

    const trimmedRole = role.trim();
    if (trimmedRole.length === 0) nextErrors.role = "Role wajib diisi";
    else if (trimmedRole.length > 100)
      nextErrors.role = "Maksimal 100 karakter";

    // Jobs validation
    if (jobDrafts.length === 0) {
      nextErrors.jobs = "Minimal 1 job utama";
    } else {
      for (const draft of jobDrafts) {
        const label = draft.label.trim();
        if (label.length === 0) {
          nextErrors[`job-label-${draft.id}`] = "Label wajib diisi";
        } else if (label.length > 50) {
          nextErrors[`job-label-${draft.id}`] = "Maksimal 50 karakter";
        }
        if (draft.type === "po") {
          const parsed = parseIDR(draft.monthlyTargetIDR);
          if (
            !Number.isFinite(parsed) ||
            parsed < 1 ||
            parsed > 999_999_999_999
          ) {
            nextErrors[`job-target-${draft.id}`] =
              "Target nominal PO wajib diisi";
          }
          if (!draft.clientType) {
            nextErrors[`job-client-${draft.id}`] = "Perusahaan wajib dipilih";
          }
        } else {
          const num = Number(draft.dailyTarget);
          if (
            draft.dailyTarget.trim() === "" ||
            !Number.isInteger(num) ||
            num < 1 ||
            num > 99
          ) {
            nextErrors[`job-target-${draft.id}`] = "Target 1-99";
          }
        }
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    // Build payload. For edits, omit password if blank so updateUser preserves it.
    const builtJobs = jobDrafts.map((draft) => {
      const baseId = isTempId(draft.id)
        ? typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${trimmedUsername || existing?.username || "u"}-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 7)}`
        : draft.id;
      if (draft.type === "po") {
        return {
          id: baseId,
          label: draft.label.trim(),
          type: "po",
          monthlyTargetIDR: Math.round(parseIDR(draft.monthlyTargetIDR)),
          clientType: draft.clientType,
        };
      }
      return {
        id: baseId,
        label: draft.label.trim(),
        type: "standard",
        dailyTarget: Number(draft.dailyTarget),
      };
    });

    const payload = {
      username: mode === "create" ? trimmedUsername : existing.username,
      fullName: trimmedName,
      role: trimmedRole,
      password:
        mode === "create"
          ? password
          : password.length > 0
          ? password
          : existing.password,
      userType: existing?.userType ?? "karyawan",
      avatar: existing?.avatar,
      suspended: existing?.suspended ?? false,
      jobs: builtJobs,
    };

    onSubmit(payload);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Tambah User" : "Edit User"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Buat akun karyawan baru beserta job utamanya."
              : `Perbarui informasi ${existing?.fullName ?? ""}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="form-fullname">
              Nama Lengkap <span className="text-destructive">*</span>
            </Label>
            <Input
              id="form-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              placeholder="mis. Goden Pratama"
              aria-invalid={!!errors.fullName}
            />
            {errors.fullName && (
              <p className="text-xs text-destructive">{errors.fullName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="form-username">
              Username <span className="text-destructive">*</span>
            </Label>
            <Input
              id="form-username"
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))
              }
              maxLength={50}
              placeholder="mis. goden"
              disabled={mode === "edit"}
              aria-invalid={!!errors.username}
            />
            {mode === "edit" && (
              <p className="text-xs text-muted-foreground">
                Username tidak dapat diubah setelah dibuat.
              </p>
            )}
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="form-password">
              Password{" "}
              {mode === "create" && (
                <span className="text-destructive">*</span>
              )}
            </Label>
            <Input
              id="form-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={100}
              placeholder={
                mode === "edit"
                  ? "Biarkan kosong untuk tidak mengubah"
                  : "Minimal 1 karakter"
              }
              autoComplete="new-password"
              aria-invalid={!!errors.password}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="form-role">
              Role / Jabatan <span className="text-destructive">*</span>
            </Label>
            <Input
              id="form-role"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              maxLength={100}
              placeholder="mis. Staff Keuangan"
              aria-invalid={!!errors.role}
            />
            {errors.role && (
              <p className="text-xs text-destructive">{errors.role}</p>
            )}
          </div>

          {/* Jobs section */}
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                Job Utama (1-3) <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addJobRow}
                disabled={jobDrafts.length >= 3}
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Job
              </Button>
            </div>

            {errors.jobs && (
              <p className="text-xs text-destructive">{errors.jobs}</p>
            )}

            <div className="flex flex-col gap-2">
              {jobDrafts.map((draft, idx) => {
                const isPO = draft.type === "po";
                const parsedMonthlyIDR = parseIDR(draft.monthlyTargetIDR);
                const monthlyPreview =
                  isPO && Number.isFinite(parsedMonthlyIDR) && parsedMonthlyIDR > 0
                    ? formatIDR(parsedMonthlyIDR)
                    : "";
                return (
                  <div
                    key={draft.id}
                    className="rounded-md border border-border bg-background p-3"
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Job #{idx + 1}
                      </span>
                      {jobDrafts.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => removeJobRow(draft.id)}
                          aria-label="Hapus job"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Type picker */}
                    <div className="mb-2 space-y-1">
                      <Label className="text-xs">Tipe</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateJobRow(draft.id, { type: "standard" })
                          }
                          aria-pressed={!isPO}
                          className={
                            "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium transition-colors " +
                            (!isPO
                              ? "border-transparent bg-primary text-primary-foreground"
                              : "border-border bg-background text-foreground hover:bg-accent")
                          }
                        >
                          Harian (count)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateJobRow(draft.id, { type: "po" })
                          }
                          aria-pressed={isPO}
                          className={
                            "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium transition-colors " +
                            (isPO
                              ? "border-transparent bg-primary text-primary-foreground"
                              : "border-border bg-background text-foreground hover:bg-accent")
                          }
                        >
                          PO (nominal/bulan)
                        </button>
                      </div>
                    </div>

                    {/* Client picker — only for PO jobs */}
                    {isPO && (
                      <div className="mb-2 space-y-1">
                        <Label
                          htmlFor={`job-client-${draft.id}`}
                          className="text-xs"
                        >
                          Perusahaan <span className="text-destructive">*</span>
                        </Label>
                        <select
                          id={`job-client-${draft.id}`}
                          value={draft.clientType}
                          onChange={(e) =>
                            updateJobRow(draft.id, {
                              clientType: e.target.value,
                            })
                          }
                          aria-invalid={!!errors[`job-client-${draft.id}`]}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="">Pilih perusahaan…</option>
                          {CLIENT_TYPES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        {errors[`job-client-${draft.id}`] && (
                          <p className="text-xs text-destructive">
                            {errors[`job-client-${draft.id}`]}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          Setiap job PO terhubung ke satu perusahaan. User boleh
                          pegang beberapa job PO dengan perusahaan berbeda.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="flex-1 space-y-1">
                        <Label
                          htmlFor={`job-label-${draft.id}`}
                          className="text-xs"
                        >
                          Label
                        </Label>
                        <Input
                          id={`job-label-${draft.id}`}
                          type="text"
                          value={draft.label}
                          onChange={(e) =>
                            updateJobRow(draft.id, { label: e.target.value })
                          }
                          maxLength={50}
                          placeholder={
                            isPO ? "mis. PO" : "mis. Membuat Invoice"
                          }
                          aria-invalid={!!errors[`job-label-${draft.id}`]}
                        />
                        {errors[`job-label-${draft.id}`] && (
                          <p className="text-xs text-destructive">
                            {errors[`job-label-${draft.id}`]}
                          </p>
                        )}
                      </div>
                      {isPO ? (
                        <div className="w-full space-y-1 sm:w-56">
                          <Label
                            htmlFor={`job-target-${draft.id}`}
                            className="text-xs"
                          >
                            Target / bulan (Rp)
                          </Label>
                          <Input
                            id={`job-target-${draft.id}`}
                            type="text"
                            inputMode="numeric"
                            value={draft.monthlyTargetIDR}
                            onChange={(e) =>
                              updateJobRow(draft.id, {
                                monthlyTargetIDR: e.target.value,
                              })
                            }
                            placeholder="500.000.000"
                            aria-invalid={!!errors[`job-target-${draft.id}`]}
                          />
                          {monthlyPreview && (
                            <p className="text-[11px] text-muted-foreground">
                              = {monthlyPreview}
                            </p>
                          )}
                          {errors[`job-target-${draft.id}`] && (
                            <p className="text-xs text-destructive">
                              {errors[`job-target-${draft.id}`]}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="w-full space-y-1 sm:w-28">
                          <Label
                            htmlFor={`job-target-${draft.id}`}
                            className="text-xs"
                          >
                            Target / hari
                          </Label>
                          <Input
                            id={`job-target-${draft.id}`}
                            type="number"
                            min={1}
                            max={99}
                            step={1}
                            value={draft.dailyTarget}
                            onChange={(e) =>
                              updateJobRow(draft.id, {
                                dailyTarget: e.target.value,
                              })
                            }
                            placeholder="10"
                            aria-invalid={!!errors[`job-target-${draft.id}`]}
                          />
                          {errors[`job-target-${draft.id}`] && (
                            <p className="text-xs text-destructive">
                              {errors[`job-target-${draft.id}`]}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
