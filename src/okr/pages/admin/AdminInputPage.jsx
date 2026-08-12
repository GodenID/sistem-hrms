import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ListChecks, UserSearch } from "lucide-react";
import { toast } from "sonner";
import AuthGuard from "../../components/AuthGuard";
import BackToHrms from "../../components/BackToHrms";
import InputForm from "../../components/InputForm";
import { api } from "../../../services/api";
import { useUsers } from "../../contexts/UserContext";
import { useWibToday } from "../../hooks/useWibToday";
import { getUserJobs } from "../../lib/jobs";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Skeleton } from "../../components/ui/skeleton";

function getInitials(fullName) {
  const words = fullName.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return (words[0]?.[0] ?? "").toUpperCase();
}

export default function AdminInputPage() {
  return (
    <AuthGuard adminOnly={true}>
      <AdminInputPageContent />
    </AuthGuard>
  );
}

function AdminInputPageContent() {
  const { users, isLoading } = useUsers();
  const todayDate = useWibToday();

  const [pickedUsername, setPickedUsername] = useState("");
  // Bumped after each successful submit so the form remounts cleanly.
  const [formKey, setFormKey] = useState(0);

  const employees = useMemo(() => {
    const collator = new Intl.Collator("id", { sensitivity: "base" });
    return users
      .filter((u) => u.userType !== "admin" && !u.suspended)
      .slice()
      .sort((a, b) => collator.compare(a.fullName, b.fullName));
  }, [users]);

  const pickedUser = useMemo(
    () => employees.find((u) => u.username === pickedUsername) ?? null,
    [employees, pickedUsername]
  );

  const userJobs = useMemo(
    () => (pickedUser ? getUserJobs(pickedUser) : []),
    [pickedUser]
  );

  const handleSubmit = async (data) => {
    if (!pickedUser) {
      toast.error("Pilih karyawan dulu");
      return false;
    }
    try {
      await api("/okr/inputs", {
        method: "POST",
        body: {
          username: pickedUser.username,
          workDate: todayDate,
          title: data.title,
          description: data.description || "",
          jobId: data.jobId || null,
          jobLabel: data.jobLabel || null,
          nominalIDR: data.nominalIDR ?? null,
          customerKind: data.customerKind ?? null,
        },
      });
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan data");
      return false;
    }
    toast.success(`Input atas nama ${pickedUser.fullName} tersimpan`);
    setFormKey((k) => k + 1);
    return true;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 md:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ListChecks className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">
                Daily Input Job Tracking
              </span>
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                Admin Console · Input Manual
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

      <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10 animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <UserSearch className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                Input Manual untuk Karyawan
              </h1>
              <BackToHrms />
            </div>
            <p className="text-sm text-muted-foreground">
              Pilih karyawan, lalu tambahkan entry atas nama mereka untuk hari
              ini.
            </p>
          </div>
        </div>

        <Card className="mb-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pilih Karyawan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <>
                <Label htmlFor="employee-picker" className="sr-only">
                  Karyawan
                </Label>
                <select
                  id="employee-picker"
                  value={pickedUsername}
                  onChange={(e) => setPickedUsername(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">— Pilih karyawan —</option>
                  {employees.map((u) => (
                    <option key={u.username} value={u.username}>
                      {u.fullName} · {u.role}
                    </option>
                  ))}
                </select>

                {pickedUser && (
                  <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
                    <Avatar className="h-8 w-8 border border-border">
                      {pickedUser.avatar && (
                        <AvatarImage
                          src={pickedUser.avatar}
                          alt={`Avatar ${pickedUser.fullName}`}
                        />
                      )}
                      <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
                        {getInitials(pickedUser.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium tracking-tight">
                        {pickedUser.fullName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{pickedUser.username} · {pickedUser.role}
                      </p>
                    </div>
                    {userJobs.length === 0 ? (
                      <Badge variant="muted" className="font-medium">
                        Belum ada job
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="font-medium">
                        {userJobs.length} job
                      </Badge>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {pickedUser ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Entry Baru untuk {pickedUser.fullName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InputForm
                key={formKey}
                mode="add"
                jobs={userJobs}
                onSubmit={handleSubmit}
                onCancel={() => setPickedUsername("")}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center px-6 py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <UserSearch
                  className="h-6 w-6 text-muted-foreground"
                  strokeWidth={1.75}
                />
              </div>
              <h3 className="mb-1.5 text-base font-semibold tracking-tight">
                Pilih karyawan dulu
              </h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Form input akan muncul di sini setelah Anda memilih karyawan dari
                daftar di atas.
              </p>
            </CardContent>
          </Card>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Input disimpan ke bucket hari ini (WIB) milik karyawan yang dipilih.
          Mode demo — data antar perangkat tidak tersinkron.
        </p>
      </main>
    </div>
  );
}
