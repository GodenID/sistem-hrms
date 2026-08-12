# Spesifikasi Desain: HRMS Mobile View

## Tanggal
2026-06-25

## Ringkasan
Membangun tampilan frontend HRMS untuk perangkat mobile dengan dua halaman utama:
1. **Halaman Login** — form username dan password.
2. **Halaman Dashboard** — menampilkan nama pengguna, jam live, serta tombol Clock In dan Clock Out yang mencatat waktu.

Sistem ini bersifat **frontend-only**, tanpa integrasi backend atau autentikasi nyata.

---

## Kebutuhan yang Sudah Diklarifikasi

| Aspek | Keputusan |
|-------|-----------|
| Teknologi | React 18 + Vite |
| Styling | Tailwind CSS |
| Routing | react-router-dom |
| State management | Context API + localStorage |
| Layout | Khusus mobile (max-width 430px, di tengah layar desktop) |
| Login | Dummy — semua username/password diterima asal tidak kosong |
| Nama di dashboard | Diambil dari username yang dimasukkan saat login |
| Penyimpanan waktu clock | localStorage agar tetap ada saat refresh |
| Bahasa antarmuka | Bahasa Indonesia |

---

## Arsitektur

```
src/
├── App.jsx                 # Router utama & protected route
├── main.jsx                # Entry point React
├── index.css               # Tailwind directives & base styles
├── context/
│   ├── AuthContext.jsx     # Status login + username
│   └── ClockContext.jsx    # Data clock in/out + localStorage
├── hooks/
│   └── useLocalStorage.js  # Helper baca/tulis localStorage
└── pages/
    ├── LoginPage.jsx       # Halaman login
    └── DashboardPage.jsx   # Halaman dashboard
```

---

## Alur Pengguna

1. Pengguna membuka aplikasi dan diarahkan ke `/login`.
2. Pengguna mengisi username dan password, lalu menekan tombol **Masuk**.
3. Sistem memvalidasi bahwa input tidak kosong.
4. Setelah login berhasil, username disimpan di `AuthContext` dan pengguna diarahkan ke `/` (dashboard).
5. Dashboard menampilkan:
   - Sapaan: "Halo, [username]".
   - Jam live yang diperbarui setiap detik.
   - Tombol **Clock In**.
   - Tombol **Clock Out** (aktif setelah clock in).
6. Saat tombol ditekan, waktu saat itu dicatat dan ditampilkan dalam format Indonesia.
7. Data clock disimpan di `localStorage` agar tetap ada saat halaman di-refresh.

---

## Format Data

### State Clock
```js
{
  clockIn: "09:30:45 WIB" | null,
  clockOut: "17:15:20 WIB" | null,
  date: "2026-06-25"
}
```

### localStorage Key
- `hrms_clock_data` — menyimpan object state clock di atas.

---

## Tampilan Mobile

- Container dengan `max-w-[430px]` dan `mx-auto`.
- Padding horizontal `px-6` agar nyaman di layar kecil.
- Tombol besar (`py-4`, font bold, rounded-xl) untuk mudah ditekan.
- Warna utama: biru (`bg-blue-600`) untuk aksi utama, abu-abu terang untuk disabled.
- Tipografi jelas dan cukup besar untuk dibaca di ponsel.

---

## Penanganan Error

- **Input kosong**: tampilkan pesan error di bawah form login.
- **localStorage tidak tersedia**: fallback ke state in-memory.
- **State clock tidak valid**: reset ke default jika parse localStorage gagal.
- **Tombol disabled** untuk mencegah clock in ganda atau clock out sebelum clock in.

---

## Keputusan Desain yang Penting

- Menggunakan **react-router-dom** agar halaman login dan dashboard terpisah secara clean dan mudah dikembangkan di masa depan.
- Menggunakan **Context API** agar state login dan clock dapat diakses di seluruh aplikasi tanpa prop drilling.
- **localStorage** dipilih agar data clock in/out pengguna tidak hilang saat refresh.
- **Login dummy** memudahkan demo tanpa membutuhkan backend.

---

## Batasan (Out of Scope)

- Tidak ada autentikasi nyata atau komunikasi backend.
- Tidak ada fitur riwayat presensi multi-hari.
- Tidak ada fitur edit atau hapus data clock.
- Tidak ada tampilan desktop khusus (hanya mobile layout).
