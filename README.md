# AbsenGo — Sistem Presensi Karyawan & Penggajian Harian

Aplikasi absensi kantor berbasis QR dinamis dengan penggajian harian, dibangun dengan
[TanStack Start](https://tanstack.com/start) + Supabase.

## Fitur

- **Login username + password** — tanpa email. Username admin = email akun Supabase;
  username karyawan diberikan oleh admin.
- **Model akun dua jalur** — akun yang dibuat di Supabase Auth otomatis jadi **admin**;
  karyawan dibuat dari **Panel Admin → Data Karyawan** (username + password ditentukan
  admin, akun Supabase Auth-nya dibuat otomatis lewat Edge Function).
- **Role & panel otomatis** — login admin membuka panel admin, login karyawan membuka panel karyawan.
- **Scan presensi** — QR di layar kiosk berubah tiap 5 detik; karyawan scan untuk absen masuk/pulang.
- **Layar kiosk** (`/kiosk`) — layar monitor kantor yang menampilkan QR + feed presensi realtime
  (khusus admin).
- **Dashboard** — rekap kehadiran harian, input presensi manual (izin/sakit/alfa) oleh admin.
- **Data karyawan** — CRUD karyawan + akun loginnya (buat, ganti kata sandi, hapus, aktif/nonaktif).
- **Penggajian** — estimasi gaji dari jumlah hari hadir × tarif harian.
- **Rekap** — riwayat kehadiran per periode, filter departemen, ekspor CSV.
- **Pengaturan kantor** — nama perusahaan, jam masuk/pulang, toleransi keterlambatan, `qr_secret`.

## Menjalankan secara lokal

```sh
npm install
npm run dev
```

Variabel lingkungan (isi `.env`):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Setup database (WAJIB, sekali saja)

Script schema ada di [`schema database/paste di sql.txt`](schema%20database/paste%20di%20sql.txt)
(salinan yang sama ada di `supabase/migrations/20261001090000_absengo_corporate_presensi.sql`).

1. Supabase Dashboard → **SQL Editor** → New query → paste seluruh isi file → **Run**.
2. **Deploy Edge Function** (untuk membuat akun karyawan dari panel admin):
   - Supabase Dashboard → **Edge Functions** → Deploy new function → nama
     `manage-employee-account` → paste isi `supabase/functions/manage-employee-account/index.ts` → Deploy.
   - (Alternatif lewat CLI: `supabase functions deploy manage-employee-account`)
3. **Matikan signup publik** — Supabase → Authentication → Sign In / Providers → Email →
   matikan *Allow new users to sign up*. Ini **wajib**, karena setiap akun Supabase Auth
   otomatis menjadi admin.
4. Buat akun admin pertama: Supabase Dashboard → **Authentication → Users** → *Add user*
   (email + password). Trigger database otomatis mendaftarkannya sebagai admin.
5. Login di aplikasi memakai **email lengkap** akun tersebut sebagai username.

Setelah script dijalankan, tabel yang tersedia:

| Tabel | Isi |
| --- | --- |
| `staff/employees` | Data karyawan + tarif harian |
| `company_attendance` | Presensi harian (clock in/out, status, keterlambatan) |
| `company_settings` | Jam kerja, toleransi, `qr_secret` (selalu 1 baris) |
| `login_accounts` | Pemetaan username → auth user → role & karyawan |

Script ini juga menghapus sisa tabel versi sekolah (`students`, `attendance`, `settings`, `profiles`, `user_roles`) yang tidak lagi dipakai aplikasi.

## Alur login

| Tipe akun | Dibuat di | Username | Panel |
| --- | --- | --- | --- |
| Admin | Supabase Authentication (dashboard) | email lengkap akun | Panel admin |
| Karyawan | Panel Admin → Data Karyawan | ditentukan admin | Panel karyawan |

Karyawan dibuat lewat Edge Function `manage-employee-account` yang:
- membuat akun Supabase Auth (email yang dimasukkan admin) + baris `employees` + baris `login_accounts` sekaligus;
- membatasi diri hanya untuk admin (verifikasi JWT + cek role);
- dapat mengganti kata sandi, menonaktifkan akun, dan menghapus akun (termasuk user Auth-nya).

## Catatan keamanan

- **Role dua jalur.** Akun dari Supabase Auth = admin (otomatis via trigger).
  Karyawan dibuat dari panel admin dan role-nya `employee`. `login_accounts` hanya
  bisa ditulis lewat Edge Function (service role), bukan dari aplikasi client.
- **RLS ketat.** Hanya admin yang bisa mengubah `employees` dan `company_settings`;
  karyawan hanya bisa membaca/menulis baris presensi miliknya sendiri. `anon` tidak
  punya hak akses ke tabel ini.
- **Signup publik wajib dimatikan** — kalau tidak, siapa pun bisa daftar dan langsung
  menjadi admin. (Supabase → Authentication → Sign In / Providers → Email)
- **Known limitation — `qr_secret`.** Verifikasi QR berjalan di browser, jadi `qr_secret`
  sampai ke perangkat karyawan. Secara teknis karyawan bisa membuat QR sendiri di luar
  kantor. Untuk menutup ini, verifikasi QR perlu dipindahkan ke Supabase Edge Function
  (server-side) sehingga hanya hash QR yang dikirim ke database.

## Development

```sh
npm run dev      # server pengembangan
npm run build    # build produksi
npm run preview  # preview hasil build
npm run lint     # eslint + prettier
npm run format   # prettier --write
```

## Dibuat dengan

This project was built with [Lovable](https://lovable.dev).

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Supabase