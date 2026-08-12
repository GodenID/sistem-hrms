import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'

const APP_VERSION = '0.1.0'

export default function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background py-6 pb-24 md:pb-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 md:px-8">
        <p className="text-center text-xs text-muted-foreground">
          Copyright 2026 Prasasti Group. Created by Goden
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>v{APP_VERSION}</span>
          <span aria-hidden>·</span>
          <LegalDialog
            title="Privacy Policy"
            triggerLabel="Privacy"
            body={
              <>
                <p>
                  Aplikasi ini menyimpan data input harian karyawan untuk
                  keperluan internal Prasasti Group.
                </p>
                <p>
                  Data hanya diakses oleh pengguna terkait dan admin yang
                  berwenang. Tidak dibagikan ke pihak ketiga.
                </p>
                <p>
                  Pertanyaan terkait data hubungi admin Prasasti Group.
                </p>
              </>
            }
          />
          <span aria-hidden>·</span>
          <LegalDialog
            title="Terms of Service"
            triggerLabel="Terms"
            body={
              <>
                <p>
                  Penggunaan aplikasi tunduk pada kebijakan internal Prasasti
                  Group.
                </p>
                <p>
                  Pengguna wajib menjaga kerahasiaan akun dan bertanggung jawab
                  atas data yang diinput.
                </p>
                <p>
                  Penyalahgunaan akun atau data dapat berakibat pencabutan
                  akses.
                </p>
              </>
            }
          />
          <span aria-hidden>·</span>
          <LegalDialog
            title="Disclaimer"
            triggerLabel="Disclaimer"
            body={
              <>
                <p>
                  Data ditampilkan apa adanya berdasarkan input pengguna.
                </p>
                <p>
                  Prasasti Group tidak bertanggung jawab atas keputusan yang
                  diambil semata-mata berdasarkan data dalam aplikasi ini tanpa
                  verifikasi tambahan.
                </p>
              </>
            }
          />
        </div>
      </div>
    </footer>
  )
}

function LegalDialog({ title, triggerLabel, body }) {
  return (
    <Dialog>
      <DialogTrigger className="underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:text-foreground focus-visible:underline">
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Prasasti Group</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">{body}</div>
      </DialogContent>
    </Dialog>
  )
}
