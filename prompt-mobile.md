# PROMPT UNTUK AGEN: AbsenGo Corporate Mobile (Flutter, geofence + selfie)

Tempel seluruh isi file ini ke agen yang akan membangun aplikasinya.

---

## Peran

Kamu adalah Flutter engineer senior sekaligus product designer. Tugasmu membangun ulang **AbsenGo Corporate** sebagai aplikasi mobile Flutter (Android dan iOS) dengan perilaku, data, dan logika yang sama seperti versi web, kecuali satu perubahan yang diminta pemilik produk: absen tidak lagi memakai QR di layar kiosk, tetapi memakai **radius lokasi kantor plus selfie sebagai bukti**.

Jangan mengarang fitur. Jangan mengganti backend. Jangan mengubah nama tabel, kolom, atau fungsi yang sudah ada kecuali pada bagian "Perubahan backend yang diminta".

Hasil akhir: proyek Flutter yang bisa dijalankan, semua layar berfungsi, semua state (loading, kosong, error) ada, dan lolos daftar QA di bagian akhir.

## 1. Konteks produk

AbsenGo Corporate adalah sistem presensi kantor plus penggajian harian:

- Karyawan menekan Absen dari HP sendiri, mengambil selfie, dan sistem memeriksa apakah perangkat berada dalam radius kantor.
- Server yang memutuskan absen masuk atau pulang, menghitung keterlambatan, dan menolak absen di luar radius, akurasi buruk, atau lokasi palsu.
- Selfie disimpan privat sebagai bukti dan bisa ditinjau admin.
- Admin mengelola data karyawan dan akun login, memantau kehadiran harian, mencatat izin/sakit/alfa manual, menghitung gaji harian, dan mengekspor rekap.
- Gaji harian = jumlah hari hadir yang lengkap (jam masuk dan jam pulang tercatat) dikali tarif harian.

Pengguna: staf kantor Indonesia, satu admin/HRD, puluhan karyawan. Bahasa UI: Indonesia. Mata uang: Rupiah. Zona waktu acuan: Asia/Jakarta. Semua teks UI harus bahasa Indonesia operasional, singkat, faktual. Dilarang memakai em dash, kata pemasaran seperti "seamless" atau "next generation", dan klaim keamanan tanpa bukti.

## 2. Yang dibangun dan yang tidak

Dibangun:

- Login username dan kata sandi, tanpa pendaftaran mandiri.
- Panel karyawan: Beranda, Absen (lokasi dan selfie), Riwayat.
- Panel admin: Beranda, Data Karyawan, Penggajian, Rekap, Setelan.
- Peninjauan bukti selfie di Rekap.
- Persetujuan penggunaan lokasi dan kamera sebelum absen pertama.

Tidak dibangun, dan jangan ditambahkan:

- Layar kiosk, QR code, atau pemindaian QR. Konsep ini dihapus dari aplikasi mobile.
- Halaman landing pemasaran. Aplikasi ini alat internal.
- Registrasi, lupa kata sandi mandiri, login email, login Google.
- Pengenalan wajah otomatis atau pencocokan biometrik. Selfie hanya bukti visual.
- Pelacakan lokasi latar belakang. Lokasi diambil hanya saat karyawan menekan Absen.
- Grafik, analitik, notifikasi push, chat, potongan pajak, BPJS.
- Antrean offline. Validasi butuh server, jadi absen tanpa jaringan memang tidak bisa.
- Data contoh baru selain 4 karyawan yang sudah ada di database.

Batas yang harus kamu pahami dan jangan dilebih-lebihkan ke pengguna:

- Koordinat, akurasi, dan flag mock dikirim oleh HP. Server bisa menolak, tetapi tidak bisa membuktikan angka itu jujur.
- Yang benar-benar terverifikasi server hanya identitas sesi dan waktu.
- Selfie tidak mencegah titip absen. Dia bukti untuk ditinjau admin.

## 3. Stack dan struktur

- Flutter stabil terbaru, null safety, Material 3.
- Routing: `go_router` dengan guard sesi dan role.
- State: `flutter_riverpod`, pola repository. Jangan taruh query Supabase langsung di widget.
- Backend: `supabase_flutter` ke project Supabase yang sama. Sesi disimpan di `flutter_secure_storage`.
- Kamera selfie: `image_picker` dengan kamera depan. Jangan membangun kamera kustom kecuali benar-benar perlu.
- Lokasi: `geolocator`.
- Kompresi foto: `flutter_image_compress`, target lebar maksimal 1080 px, kualitas 80, JPEG.
- Tanggal dan angka: `intl` dengan locale `id_ID`.
- Berbagi file CSV: `share_plus`. Slip gaji PDF: `pdf` dan `printing`.
- Font: `google_fonts`, tetapi bundel file font sebagai asset.
- Ambil versi stabil terbaru saat implementasi. Jangan mengarang nama API. Kalau ragu, cek dokumentasi paket yang terpasang.

Struktur folder:

```
lib/
  main.dart
  app/router.dart, app/theme.dart, app/env.dart
  core/jakarta_time.dart, core/currency.dart, core/csv.dart, core/strings.dart, core/failure.dart
  data/models/, data/repositories/, data/supabase_client.dart
  features/auth/, features/dashboard/, features/attendance/, features/history/,
  features/employees/, features/payroll/, features/recap/, features/settings/, features/consent/
  shared/widgets/app_shell.dart, data_list.dart, status_badge.dart, page_header.dart,
  shared/widgets/empty_state.dart, error_state.dart, loading_state.dart, password_field.dart
```

Semua teks UI dikumpulkan di `core/strings.dart`.

## 4. Arah desain

Baca ini sebagai: alat presensi internal untuk staf kantor Indonesia, identitas teal tenang dengan aksen amber hangat, dial **ENERGY 2 / RHYTHM 2 / MOTION 1**.

Identitas yang dipertahankan:

- Warna utama teal, bukan biru korporat generik.
- Judul Sora, teks isi Plus Jakarta Sans, alasan: Sora memberi karakter judul, Plus Jakarta Sans nyaman dibaca di HP dan terasa lokal.
- Kartu putih di atas latar hijau sangat muda, sudut membulat, garis tipis, bayangan hanya pada kartu yang memang terangkat.
- Angka waktu dan uang memakai tabular figures, bukan monospace dekoratif. Tujuannya digit tidak bergeser.
- Satu gradasi saja di seluruh aplikasi: kartu profil karyawan di Beranda. Tujuannya focal point untuk dua angka yang paling ingin dilihat karyawan.
- Status memakai lencana pil karena memang penanda keadaan. Bentuk pil tidak dipakai untuk tombol, input, atau kartu.

Yang diubah untuk mobile:

- Tidak ada sidebar dan tidak ada tabel. Semua daftar memakai kartu.
- Tidak ada efek hover. Umpan balik memakai pressed state dan haptic.
- Unduh CSV diganti share sheet. Cetak slip diganti PDF yang bisa dibagikan atau dicetak.

### Token warna

Light:

| Token | Hex | Pemakaian |
| --- | --- | --- |
| background | #F6FCF8 | latar layar |
| card | #FFFFFF | kartu, sheet, dialog |
| foreground | #091F1A | teks utama |
| muted | #E9F3EF | latar sekunder, isian input |
| mutedForeground | #526962 | teks pendukung, 5.9:1 di atas putih |
| primary | #00836C | tombol terisi, ikon aktif, 4.6:1 dengan teks putih |
| onPrimary | #F6FEFB | teks di atas primary |
| secondary | #D8F2E9 | chip dan latar ikon |
| secondaryForeground | #003D33 | teks di atas secondary |
| accent | #F2B036 | aksen langka, hanya penanda keterlambatan |
| destructive | #DB2B33 | hapus dan error |
| border | #D2E3DC | garis 1dp |

Dark:

| Token | Hex |
| --- | --- |
| background | #021817 |
| card | #072523 |
| foreground | #ECF4F1 |
| muted | #123432 |
| mutedForeground | #91ABA5 |
| primary | #21BFA0 |
| border | putih 12% |

Warna status, wajib lolos kontras minimal 4.5:1. Kalau gagal saat diukur, gelapkan teksnya:

| Status | Latar | Teks |
| --- | --- | --- |
| hadir | #D8F2E9 | #005143 |
| terlambat | #FDF0D5 | #6B4300 |
| sakit | #DCE9FB | #17427A |
| izin | #DDF1F9 | #0B4A6F |
| alfa | #FBE0E3 | #8A1B2A |

### Tipografi dan bentuk

- Judul layar: Sora 22, weight 700, tracking -0.02em.
- Judul kartu: Sora 16, weight 600.
- Isi: Plus Jakarta Sans 14, tinggi baris 1.5. Teks kecil 12.
- Angka besar: 28 sampai 32, tabular figures.
- Radius: 10 chip kecil, 12 input dan tombol, 14 default, 22 kartu. Jangan membuat semuanya pil.
- Spasi kelipatan 4. Padding layar 16. Jarak antar bagian 20.
- Bayangan halus untuk kartu data, lebih tegas untuk sheet dan dialog.
- Target sentuh minimal 48dp.
- Dark mode penuh, ikut sistem, kedua mode harus terbaca.

## 5. Navigasi mobile

- Karyawan, bottom navigation 3 item: Beranda, Absen, Riwayat.
- Admin, bottom navigation 5 item: Beranda, Karyawan, Gaji, Rekap, Setelan.
- App bar berisi nama perusahaan dan menu akun (nama, username, Keluar).
- Login, layar persetujuan, dan layar blokir tampil tanpa bottom navigation.
- Setiap tab menyimpan state dan posisi scroll saat berpindah.

## 6. Autentikasi dan penentuan role

1. Pengguna memasukkan username dan kata sandi.
2. Panggil RPC `resolve_login_email`. Kalau kosong, tampilkan "Username tidak ditemukan atau akun sudah dinonaktifkan."
3. Login dengan `signInWithPassword`. Kalau gagal, tampilkan "Username atau kata sandi salah."
4. Baca `login_accounts` berdasarkan `user_id`. Ambil `role`, `active`, `username`, `employee_id`.
5. Kalau tidak ada baris atau `active` false, langsung `signOut` lalu tampilkan "Akun ini belum aktif. Hubungi administrator kantor."
6. Kalau `employee_id` ada, ambil baris `employees` untuk profil.
7. Role selalu dari `login_accounts`, bukan dari `employees.role`, karena akun admin dari Supabase Auth belum tentu punya baris `employees`.

State wajib:

- Memulihkan sesi saat aplikasi dibuka, dengan splash singkat.
- Sesi ada tetapi belum terdaftar sebagai karyawan: layar "Akun belum terdaftar sebagai karyawan", berisi username, penjelasan, dan tombol Keluar.
- Karyawan membuka halaman admin: layar "Halaman khusus administrator" dengan tombol kembali ke Beranda.
- Sesi kedaluwarsa: kembali ke login dengan pesan singkat.

Layar login: logo yang sudah ada, judul AbsenGo Corporate, field username (autofocus, autocapitalize off, keyboard next), field kata sandi dengan tombol lihat, tombol Masuk selebar layar dengan state loading "Memproses...", catatan "Belum punya akun? Hubungi administrator kantor." Tanpa tautan daftar.

## 7. Kontrak data

Tabel yang sudah ada, jangan diubah namanya:

`company_settings`: satu baris `id = 1`. Kolom `company_name`, `work_start_time` (time), `late_tolerance_minutes` (int), `work_end_time` (time), `qr_secret` (text, tidak dipakai lagi oleh aplikasi mobile), `updated_at`.

`employees`: `id`, `user_id`, `nik` unik, `full_name`, `email` unik, `department`, `position`, `daily_salary` numeric, `role`, `active`, `created_at`, `updated_at`.

`company_attendance`: `id`, `employee_id`, `attend_date` (date), `clock_in` (time), `clock_out` (time), `status` ('hadir' | 'terlambat' | 'izin' | 'sakit' | 'alfa'), `late_minutes`, `note`, `recorded_by`, `created_at`, `updated_at`. Unik per `(employee_id, attend_date)`.

`login_accounts`: `id`, `username` unik, `email` unik, `user_id`, `role`, `employee_id`, `active`, `updated_at`.

Tabel baru dari bagian 12: `attendance_evidence`. Bucket baru: `attendance-photos`.

RPC yang tersedia setelah migrasi: `resolve_login_email`, `is_admin`, `current_employee_id`, `get_public_settings`, `record_attendance_geo`, `accept_attendance_consent`, dan helper internal `absengo_record_clock`.

Edge Function `manage-employee-account` dengan aksi `create`, `reset_password`, `set_active`, `delete`. Hanya admin, memverifikasi JWT pemanggil.

Aturan akses yang berlaku, jangan dilawan di client:

- Karyawan hanya membaca baris presensi dan bukti miliknya sendiri.
- Karyawan tidak menulis `company_attendance` langsung. Semua lewat `record_attendance_geo`.
- Admin boleh menulis presensi manual dan mengubah data karyawan.
- Hanya admin yang membaca `company_settings` penuh. Karyawan memakai `get_public_settings`.
- `login_accounts` hanya ditulis lewat Edge Function.

## 8. Aturan bisnis

Waktu:

- Tanggal dan jam presensi selalu dihitung server dalam zona Asia/Jakarta. Jangan mengirim tanggal atau jam dari HP.
- Tampilan di HP juga memakai Asia/Jakarta.

Lokasi, divalidasi server:

- Ambil `office_lat`, `office_lng`, `office_radius_m`, `max_accuracy_m` dari `company_settings` baris `id = 1`.
- Kalau koordinat kantor belum diisi, tolak dengan kode `PENGATURAN`.
- Jarak dihitung dengan haversine di SQL, bukan di Flutter.
- Tolak kalau jarak lebih besar dari radius, kode `DI_LUAR_RADIUS`.
- Tolak kalau `p_accuracy_m` kosong, nol, atau lebih besar dari `max_accuracy_m`, kode `LOKASI_TIDAK_AKURAT`.
- Tolak kalau `p_is_mocked` true, kode `LOKASI_PALSU`.
- Tolak kalau `p_photo_path` kosong, tidak berawalan `{employee_id}/`, atau tidak ada di `storage.objects`, kode `FOTO_TIDAK_ADA` atau `FOTO_TIDAK_VALID`.

Keterlambatan saat absen masuk:

- Absen masuk ditolak kalau waktu sekarang lebih dari 60 menit sebelum `work_start_time`, kode `BELUM_BUKA`.
- Kalau waktu sekarang lebih dari `work_start_time + late_tolerance_minutes`, status `terlambat` dan `late_minutes` = selisih menit sekarang dengan jam masuk.
- Selain itu status `hadir` dan `late_minutes` 0.
- Toleransi tidak mengurangi angka keterlambatan. Contoh: masuk 08:00, toleransi 15, datang 08:20, tercatat terlambat 20 menit.

Absen pulang:

- Kalau belum ada baris hari ini atau `clock_in` kosong, tindakan dianggap absen masuk, walaupun sudah lewat jam pulang. Ini disengaja.
- Kalau `clock_in` ada dan `clock_out` kosong, absen sebelum `work_end_time` ditolak dengan kode `BELUM_WAKTU_PULANG`.
- Kalau sudah lewat `work_end_time`, `clock_out` diisi jam sekarang.
- Kalau keduanya terisi, kode `SUDAH_LENGKAP`.

Perhitungan gaji:

- Sehari dibayar hanya kalau `clock_in` dan `clock_out` ada, status `hadir` atau `terlambat`.
- Hari berstatus hadir atau terlambat yang belum lengkap dihitung "belum lengkap" dan tidak dibayar.
- `izin`, `sakit`, `alfa` tidak dibayar.
- Gaji karyawan = jumlah hari dibayar x `daily_salary`.

Presensi manual admin:

- Status: sakit (default), izin, alfa, hadir, terlambat.
- Untuk hadir dan terlambat, jam masuk dan pulang wajib, jam pulang tidak boleh lebih awal.
- `late_minutes` manual = max(0, jam masuk dikurangi jam masuk kantor), tanpa toleransi.
- Simpan dengan `recorded_by` user admin. Bentrok unik menghasilkan "Karyawan sudah tercatat presensi hari ini".

Rekap harian admin:

- Karyawan aktif = `employees.active = true`.
- Sudah masuk = baris hari ini dengan status hadir atau terlambat.
- Terlambat = baris hari ini dengan status terlambat.
- Izin, sakit, alfa = jumlah baris dengan ketiga status itu.
- Belum presensi = max(karyawan aktif dikurangi jumlah baris hari ini, 0).

Dashboard karyawan:

- Hari hadir bulan ini = baris bulan berjalan dengan status hadir atau terlambat yang lengkap.
- Estimasi gaji = hari hadir bulan ini x tarif harian.
- Tampilkan peringatan kalau ada hari belum lengkap.
- Riwayat 10 terakhir bulan berjalan, tanggal terbaru.

Periode penggajian:

- Preset 2 minggu: tanggal 1 sampai 15, atau 16 sampai akhir bulan, mengikuti Asia/Jakarta.
- Preset 1 bulan: tanggal 1 sampai akhir bulan.
- Rentang manual diperbolehkan.

## 9. Kontrak absen

Urutan yang wajib diikuti aplikasi:

1. Periksa izin lokasi dan kamera saat tombol Absen ditekan, bukan saat aplikasi dibuka.
2. Ambil posisi dengan akurasi tinggi, batas tunggu 20 detik: `Geolocator.getCurrentPosition(locationSettings: LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 20)))`.
3. Tampilkan kartu lokasi: jarak ke kantor, akurasi, radius, status. Hitungan jarak di client hanya untuk tampilan, keputusan tetap di server.
4. Ambil selfie kamera depan dengan `image_picker`. Kompres ke lebar maksimal 1080 px, kualitas 80, JPEG. Tolak foto lebih dari 5 MB sebelum unggah.
5. Unggah ke `attendance-photos` pada path `{employee_id}/{epochMillis}.jpg`, `upsert: false`, `contentType: image/jpeg`.
6. Panggil RPC:

```dart
final result = await supabase.rpc('record_attendance_geo', params: {
  'p_lat': position.latitude,
  'p_lng': position.longitude,
  'p_accuracy_m': position.accuracy,
  'p_is_mocked': position.isMocked,
  'p_photo_path': path,
});
```

7. Kalau RPC mengembalikan `ok: false`, hapus objek yang sudah diunggah, best effort, lalu tampilkan alasan.
8. Kalau sukses, hapus kamera, tampilkan overlay konfirmasi dengan foto kecil, aksi, jam, jarak, dan status keterlambatan. Overlay menutup sendiri setelah 4 detik.

Bentuk respons sukses masuk:

```json
{"ok":true,"aksi":"masuk","jam":"08:12","status":"terlambat","late_minutes":12,"jam_pulang":"17:00","distance_m":42,"accuracy_m":12}
```

Bentuk respons sukses pulang:

```json
{"ok":true,"aksi":"pulang","jam":"17:04","status":"terlambat","late_minutes":12,"jam_masuk":"08:12","jam_pulang":"17:00","distance_m":38,"accuracy_m":10}
```

Kode penolakan dan perilaku UI:

| Kode | Judul | Tindakan setelah ditolak |
| --- | --- | --- |
| DI_LUAR_RADIUS | Di luar radius kantor | Tampilkan jarak dan radius, tombol Perbarui Lokasi |
| LOKASI_TIDAK_AKURAT | Sinyal GPS lemah | Tampilkan akurasi dan batas, saran pindah ke area terbuka |
| LOKASI_PALSU | Lokasi palsu terdeteksi | Jelaskan mematikan aplikasi mock location |
| FOTO_TIDAK_ADA | Foto absen tidak ditemukan | Ulangi pengambilan foto |
| FOTO_TIDAK_VALID | Foto absen tidak valid | Ulangi pengambilan foto |
| BELUM_BUKA | Presensi belum dibuka | Tampilkan jam masuk kantor |
| BELUM_WAKTU_PULANG | Belum waktunya pulang | Tampilkan jam masuk tercatat dan jam sekarang |
| SUDAH_LENGKAP | Presensi sudah lengkap | Tampilkan jam masuk dan pulang |
| SUDAH_TERCATAT | Presensi sudah tercatat | Arahkan ke Riwayat |
| TANPA_PROFIL | Profil belum terdaftar | Arahkan menghubungi admin |
| NONAKTIF | Akun sedang tidak aktif | Arahkan menghubungi admin |
| PENGATURAN | Pengaturan belum lengkap | Arahkan menghubungi admin |

Aturan tambahan:

- Kunci proses supaya tidak ada dua pemanggilan bersamaan. Abaikan aksi baru selama proses berjalan.
- Jangan mencatat koordinat, foto, atau isi payload ke log.
- Haptic sedang untuk sukses, kuat untuk gagal.
- Setelah hasil apa pun, muat ulang status hari ini.
- Kalau aplikasi masuk latar belakang saat kamera terbuka, batalkan pengambilan dan bersihkan state.

## 10. Spesifikasi layar

### 10.1 Beranda admin

- Header: "Dashboard Presensi", tanggal lengkap bahasa Indonesia, nama perusahaan.
- Aksi: tombol Input Izin / Cuti.
- Lima kartu statistik: Karyawan Aktif (selebar layar di HP), Sudah Masuk Kerja, Terlambat, Izin / Sakit / Alfa, Belum Presensi.
- Kalau belum ada karyawan: panel ajakan dengan tombol Muat Data Contoh (4 karyawan) dan Kelola Karyawan.
- Daftar "Presensi Karyawan Hari Ini", maksimal 10 kartu: nama, NIK, departemen dan jabatan, jam masuk, jam pulang, lencana status, dan penanda jumlah bukti foto.
- Header daftar: "X dari Y karyawan sudah tercatat" dan tautan ke Rekap.
- Empty state: "Belum ada presensi hari ini", jelaskan catatan muncul setelah karyawan absen dari HP.
- Sheet Input Presensi Manual: pilih karyawan, status, dua field jam hanya untuk hadir atau terlambat, keterangan opsional, catatan jam kerja kantor, peringatan kalau jam masuk melewati jam kantor. Tombol Batal dan Simpan.

### 10.2 Beranda karyawan

- Header: "Portal Presensi Karyawan", tanggal hari ini, tombol Absen Sekarang.
- Kartu gradasi teal, satu-satunya gradasi: nama, NIK, departemen dan jabatan, tarif harian, hari hadir bulan ini, estimasi gaji. Satu baris peringatan bila ada hari belum lengkap.
- Kartu "Absensi Anda Hari Ini": jam masuk dan jam pulang dalam dua kotak, lencana status, keterangan "Absen pulang dibuka pukul HH:mm" bila belum pulang.
- Daftar riwayat bulan ini, 10 terakhir: tanggal, jam masuk dan pulang, lencana status.

### 10.3 Absen

Susunan dari atas ke bawah:

- Kartu identitas: nama, NIK, departemen, chip status hari ini (Belum Masuk amber, Sudah Masuk hijau, Sudah Pulang violet).
- Kartu lokasi: angka jarak besar dengan tabular figures, keterangan "dari kantor", akurasi "±12 m", radius "150 m", dan chip "Di dalam radius", "Di luar radius", atau "Akurasi rendah". Satu tombol teks Perbarui Lokasi yang mengambil posisi ulang. Kalau di luar radius, tampilkan peringatan bahwa absen akan ditolak, tetapi jangan memblokir tombol Absen, karena GPS HP bisa salah.
- Area selfie: tombol besar Ambil Selfie. Setelah ada foto, tampilkan preview 3:4 dengan tombol Ulangi dan Kirim Absen.
- Teks bantuan singkat: "Selfie dipakai sebagai bukti kehadiran dan hanya bisa dilihat admin."
- Overlay hasil dengan foto kecil, aksi, jam, jarak, status, dan tombol Tutup.

State yang wajib: lokasi dimatikan, izin lokasi ditolak, izin kamera ditolak, GPS timeout, unggah gagal, RPC gagal, dan berhasil. Setiap kegagalan punya satu kalimat penyebab dan satu langkah berikutnya.

### 10.4 Data karyawan

- Header: "Data Karyawan dan Tarif Gaji", tombol Tambah Karyawan.
- Pencarian nama, NIK, jabatan, username. Filter departemen.
- Kartu: nama, NIK, lencana akun (Admin, Karyawan, Belum ada akun), departemen dan jabatan, tarif harian, status aktif, tiga aksi ikon: ganti kata sandi (kalau punya akun), edit, hapus.
- Form tambah: NIK dengan saran EMP plus nomor urut, nama, username (pola huruf, angka, titik, garis, strip, 3 sampai 32 karakter), kata sandi minimal 6, email wajib, departemen, jabatan, tarif harian kelipatan 5.000. Email wajib di mobile walau di web tidak ditandai wajib, karena Edge Function menolaknya.
- Form edit: data karyawan tanpa username dan sandi. Status nonaktif ikut menonaktifkan akun login lewat aksi `set_active`.
- Ganti kata sandi: satu field minimal 6 karakter.
- Hapus: konfirmasi yang menyebut akun login dan riwayat absensi ikut terhapus. Kalau Edge Function gagal, hapus data karyawan saja dan beri tahu akun Supabase tidak terhapus.
- Pesan error Edge Function ditampilkan apa adanya.

### 10.5 Penggajian

- Penjelasan singkat aturan gaji, tombol Export Rekap CSV.
- Panel periode: preset 2 Minggu Ini, 1 Bulan Penuh, dua pemilih tanggal.
- Tiga ringkasan: total pengeluaran, total hari masuk, jumlah karyawan aktif berhak gaji.
- Daftar karyawan aktif: nama, NIK, tarif harian, hari hadir, rincian tepat waktu, terlambat, belum lengkap, izin/sakit/alfa, total gaji, tombol Lihat slip.
- Slip gaji: nama perusahaan, periode, NIK dan nama, departemen dan jabatan, tarif, total kehadiran, rincian, total diterima, dua kolom tanda tangan. Aksi Bagikan PDF dan Cetak.

### 10.6 Rekap

Admin:

- Rentang tanggal, default hari ini, filter departemen.
- Ringkasan: jumlah catatan, hadir tepat, terlambat, izin/sakit/alfa, belum lengkap.
- Kartu: nama, NIK, departemen dan jabatan, tanggal, jam masuk dan pulang, keterlambatan, status gaji (Dihitung, Belum lengkap, Tidak dibayar), lencana status, dan tombol Bukti kalau ada foto.
- Layar bukti: daftar evidence untuk baris itu, masing-masing dengan foto, jenis masuk atau pulang, jam, jarak, akurasi, penanda mock, dan tombol Buka di peta memakai URI `geo:`.
- Export CSV.
- Empty state yang menyebut rentang tanggal.

Karyawan:

- Judul "Riwayat Presensi", rentang tanggal, daftar miliknya sendiri, ringkasan singkat, export CSV opsional. Tanpa filter departemen dan tanpa akses ke bukti foto milik orang lain.

### 10.7 Setelan

- Kebijakan waktu kerja: nama perusahaan, jam masuk, toleransi 0 sampai 120 menit, jam pulang.
- Lokasi kantor: latitude, longitude, radius 25 sampai 1000 meter, batas akurasi 25 sampai 200 meter, dan tombol **Pakai lokasi perangkat ini** untuk admin yang berdiri di pintu kantor. Tampilkan koordinat tersimpan dan hasil pembacaan perangkat saat ini. Tidak perlu peta atau Google Maps API.
- Peringatan: perubahan radius dan koordinat berlaku langsung untuk absen berikutnya.
- Akun login: email read only dan nama pengguna yang disimpan ke metadata user.
- Jangan tampilkan `qr_secret`. Kolom itu hanya dipertahankan untuk web lama.

### 10.8 Persetujuan

Sebelum absen pertama, jika `employees.attendance_consent_at` masih kosong, tampilkan layar persetujuan satu halaman:

- Apa yang dikumpulkan: lokasi saat menekan Absen dan satu foto selfie.
- Untuk apa: mencatat kehadiran dan menghitung gaji.
- Siapa yang bisa melihat: karyawan sendiri dan admin.
- Berapa lama disimpan: sesuai kebijakan perusahaan, sebutkan angkanya.
- Tombol Saya Mengerti dan Setuju, plus tombol Keluar.

Setelah disetujui, panggil RPC `accept_attendance_consent` lalu lanjut ke layar Absen. Jangan menampilkan lagi kalau sudah tercatat.

## 11. Format, ekspor, dan berbagi

Rupiah: `Rp150.000`, tanpa desimal. Tanggal: `Senin, 1 Oktober 2026`. Jam: `HH:mm` 24 jam.

CSV memakai BOM UTF-8, pemisah koma, semua sel diberi tanda kutip ganda, kutip di dalam sel di-escape. Nama file:

- `rekap-presensi-karyawan-YYYY-MM-DD-sd-YYYY-MM-DD.csv`
- `rekap-gaji-YYYY-MM-DD-sd-YYYY-MM-DD.csv`

Kolom rekap presensi: Tanggal, NIK, Nama, Departemen, Jabatan, Jam Masuk, Jam Pulang, Terlambat (Menit), Status, Dihitung Gaji (Ya atau Belum), Keterangan.

Kolom rekap gaji: NIK, Nama, Departemen, Jabatan, Tarif Gaji Harian, Total Hari Hadir, Tepat Waktu, Terlambat, Belum Lengkap (tidak dibayar), Izin, Sakit, Alfa, Total Gaji Diterima.

File dikirim lewat share sheet.

## 12. Perubahan backend yang diminta

Tulis sebagai migrasi SQL idempoten. Jangan mengubah tabel atau fungsi lain selain yang disebut.

### 12.1 Kolom pengaturan dan persetujuan

```sql
alter table public.company_settings
  add column if not exists office_lat numeric(10,7),
  add column if not exists office_lng numeric(10,7),
  add column if not exists office_radius_m int not null default 150,
  add column if not exists max_accuracy_m int not null default 100;

alter table public.employees
  add column if not exists attendance_consent_at timestamptz;
```

### 12.2 Jarak dan tabel bukti

```sql
create or replace function public.distance_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql immutable as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

create table if not exists public.attendance_evidence (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.company_attendance(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  kind text not null check (kind in ('masuk','pulang')),
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision,
  distance_m int not null,
  is_mocked boolean not null default false,
  photo_path text,
  captured_at timestamptz not null default now()
);

create index if not exists attendance_evidence_att_idx
  on public.attendance_evidence (attendance_id);
create index if not exists attendance_evidence_emp_idx
  on public.attendance_evidence (employee_id);

alter table public.attendance_evidence enable row level security;

drop policy if exists "evidence read self or admin" on public.attendance_evidence;
create policy "evidence read self or admin" on public.attendance_evidence
  for select to authenticated
  using (public.is_admin() or employee_id = public.current_employee_id());

drop policy if exists "evidence delete admin" on public.attendance_evidence;
create policy "evidence delete admin" on public.attendance_evidence
  for delete to authenticated using (public.is_admin());

grant select on public.attendance_evidence to authenticated;
revoke insert, update, delete on public.attendance_evidence from authenticated, anon;
```

### 12.3 Helper jam

Pecah logika jam dari `record_attendance` yang sudah ada menjadi satu fungsi `absengo_record_clock(p_emp uuid) returns jsonb`. Fungsi ini mengurus: `BELUM_BUKA`, status terlambat, `late_minutes`, insert atau update `clock_in`, `clock_out`, `BELUM_WAKTU_PULANG`, `SUDAH_LENGKAP`, `SUDAH_TERCATAT`, dan `PENGATURAN`. Nilai balik minimal berisi `ok`, `aksi`, `jam`, `status`, `late_minutes`, `jam_pulang`, `jam_masuk`, dan `attendance_id`.

`record_attendance` yang lama tetap ada, hanya menjadi pembungkus verifikasi QR lalu memanggil helper. Tidak perlu dipakai aplikasi baru, tetapi jangan dihapus karena web lama mungkin masih memakainya.

### 12.4 RPC absen baru

```sql
create or replace function public.record_attendance_geo(
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m double precision,
  p_is_mocked boolean,
  p_photo_path text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
-- 1. baca company_settings, tolak PENGATURAN kalau koordinat atau jam belum diisi
-- 2. tentukan karyawan lewat current_employee_id(), tolak TANPA_PROFIL
-- 3. cek employees.active, tolak NONAKTIF
-- 4. validasi koordinat, akurasi, is_mocked, dan jarak memakai distance_m
-- 5. validasi p_photo_path: berawalan employee_id, dan ada di storage.objects
-- 6. panggil absengo_record_clock(employee_id)
-- 7. kalau sukses, insert attendance_evidence dengan kind dari aksi
-- 8. kembalikan jsonb hasil helper ditambah distance_m dan accuracy_m
$$;

revoke all on function public.record_attendance_geo(double precision, double precision, double precision, boolean, text) from public, anon;
grant execute on function public.record_attendance_geo(double precision, double precision, double precision, boolean, text) to authenticated;
```

Validasi foto:

```sql
if not exists (
  select 1 from storage.objects o
  where o.bucket_id = 'attendance-photos'
    and o.name = p_photo_path
) then
  return jsonb_build_object('ok', false, 'kode', 'FOTO_TIDAK_VALID',
    'pesan', 'Foto absen tidak ditemukan. Ulangi pengambilan foto.');
end if;
```

### 12.5 Pengaturan publik dan penutupan rahasia QR

```sql
create or replace function public.get_public_settings()
returns table (
  company_name text,
  work_start_time time,
  work_end_time time,
  late_tolerance_minutes int,
  office_lat numeric,
  office_lng numeric,
  office_radius_m int,
  max_accuracy_m int
)
language sql stable security definer set search_path = public as $$
  select company_name, work_start_time, work_end_time, late_tolerance_minutes,
         office_lat, office_lng, office_radius_m, max_accuracy_m
  from public.company_settings where id = 1;
$$;

revoke all on function public.get_public_settings() from public, anon;
grant execute on function public.get_public_settings() to authenticated;

drop policy if exists "settings read authenticated" on public.company_settings;
create policy "settings read admin" on public.company_settings
  for select to authenticated using (public.is_admin());
```

### 12.6 Persetujuan

```sql
create or replace function public.accept_attendance_consent()
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := public.current_employee_id();
  v_at timestamptz;
begin
  if v_emp is null then
    raise exception 'Profil karyawan tidak ditemukan';
  end if;

  update public.employees
     set attendance_consent_at = coalesce(attendance_consent_at, now())
   where id = v_emp
  returning attendance_consent_at into v_at;

  return v_at;
end;
$$;

revoke all on function public.accept_attendance_consent() from public, anon;
grant execute on function public.accept_attendance_consent() to authenticated;
```

### 12.7 Bucket foto

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attendance-photos', 'attendance-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg'];

drop policy if exists "attendance photo upload own" on storage.objects;
create policy "attendance photo upload own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attendance-photos'
    and (storage.foldername(name))[1] = public.current_employee_id()::text
  );

drop policy if exists "attendance photo read own or admin" on storage.objects;
create policy "attendance photo read own or admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attendance-photos'
    and (public.is_admin() or owner = auth.uid())
  );

drop policy if exists "attendance photo delete own or admin" on storage.objects;
create policy "attendance photo delete own or admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attendance-photos'
    and (public.is_admin() or owner = auth.uid())
  );
```

Foto hanya ditampilkan lewat signed URL berdurasi pendek, misalnya 60 detik.

### 12.8 Retensi foto

Jangan menghapus objek dengan `delete from storage.objects` langsung dari SQL, karena file fisiknya tidak ikut terhapus. Hapus lewat Storage API, misalnya dari Edge Function terjadwal.

Aturan yang diminta: foto lebih tua dari 90 hari dihapus. Sediakan Edge Function kecil `prune-attendance-photos` yang memakai service role, menghapus objek lama, dan mengosongkan `attendance_evidence.photo_path`. Jadwalkan manual atau dengan cron. Jangan menghapus baris evidence, karena jarak dan waktu masih berguna untuk audit.

## 13. State wajib di setiap layar data

- Loading: skeleton atau indikator dengan label.
- Empty: ikon, satu kalimat apa yang belum ada, satu kalimat langkah berikutnya, aksi kalau relevan.
- Error: penyebab singkat dan tombol Coba lagi yang benar-benar memuat ulang.
- Pull to refresh pada semua daftar.
- Angka ringkasan memakai tanda "-" saat memuat, jangan 0 palsu.

## 14. Larangan

- Jangan mengarang data, angka, testimoni, atau klaim keamanan.
- Jangan membuat logo, avatar, atau ilustrasi. Pakai `logo.webp` yang sudah ada, serahkan ikon aplikasi ke pemilik produk.
- Jangan menambah menu yang halamannya belum ada.
- Jangan memakai em dash di teks UI.
- Jangan memakai tabel yang digeser horizontal di HP.
- Jangan menaruh query database di widget.
- Jangan mencatat koordinat, foto, atau kata sandi ke log.
- Jangan menambahkan dark mode setengah jadi.
- Jangan menghitung jarak atau memutuskan absen di client.
- Jangan memakai pengenalan wajah. Itu di luar cakupan.
- Jangan menganggap sukses tanpa menjalankan aplikasi.

## 15. Kriteria selesai dan QA

1. Login username berhasil untuk admin dan karyawan, dan membuka panel yang benar.
2. Username tidak dikenal, sandi salah, akun nonaktif, dan akun tanpa profil menampilkan pesan yang tepat.
3. Memulihkan sesi setelah aplikasi ditutup membuka layar yang benar.
4. Dashboard admin menampilkan lima angka yang cocok dengan isi database hari ini.
5. Input manual hadir menyimpan jam masuk dan pulang, menghitung `late_minutes`, dan menolak jam pulang lebih awal.
6. Input manual untuk karyawan yang sudah tercatat hari ini ditolak dengan pesan jelas.
7. Tambah karyawan membuat akun login dan baris karyawan, dan akun itu bisa dipakai login.
8. Duplikat username dan NIK ditolak dengan pesan yang tepat.
9. Edit, nonaktifkan, reset kata sandi, dan hapus karyawan bekerja, termasuk efek nonaktif ke akun login.
10. Absen di dalam radius dengan selfie mencatat masuk, menulis satu baris evidence, dan foto bisa dibuka admin.
11. Absen pulang setelah jam pulang mencatat `clock_out` dan evidence kedua.
12. Absen pulang sebelum jam pulang ditolak, dan foto yang sudah diunggah tidak tertinggal.
13. Absen di luar radius ditolak dengan jarak dan radius yang benar.
14. Akurasi lebih buruk dari batas ditolak sebagai `LOKASI_TIDAK_AKURAT`.
15. `is_mocked` true ditolak sebagai `LOKASI_PALSU`.
16. Path foto milik karyawan lain atau file yang tidak ada ditolak sebagai `FOTO_TIDAK_VALID`.
17. Izin lokasi ditolak menampilkan panduan, bukan layar kosong. Hal yang sama untuk izin kamera.
18. GPS mati menampilkan panduan mengaktifkan lokasi.
19. Unggah foto gagal karena jaringan tidak menghasilkan catatan presensi.
20. Dua aksi absen cepat hanya menghasilkan satu catatan.
21. Karyawan tidak bisa membuka foto karyawan lain, baik lewat aplikasi maupun URL langsung.
22. Persetujuan tercatat sekali dan tidak muncul lagi setelah disetujui.
23. Gaji hanya menghitung hari dengan jam masuk dan pulang lengkap, dan angka di Beranda karyawan, Penggajian, serta Rekap konsisten.
24. Preset 2 minggu dan 1 bulan menghasilkan rentang tanggal yang benar di Asia/Jakarta.
25. CSV bisa dibuka di Excel tanpa karakter rusak, kolom sesuai bagian 11.
26. Slip gaji bisa dibagikan sebagai PDF dan dicetak.
27. Semua layar punya state loading, kosong, dan error yang bisa dicoba ulang.
28. Kontras teks minimal 4.5:1 di light dan dark mode. Ukur, jangan dikira-kira.
29. Target sentuh minimal 48dp, teks tidak terpotong pada skala font 130%.
30. Tidak ada overflow horizontal di lebar 360dp, 390dp, dan 768dp.
31. Kamera berhenti saat aplikasi ke latar belakang dan tidak meninggalkan state menggantung.
32. Tidak ada tombol atau menu yang tidak melakukan apa-apa.
33. `flutter analyze` bersih dan aplikasi berjalan tanpa exception di console.

Laporkan hasil QA per poin dengan bukti singkat. Jangan menulis PASS tanpa bukti.

## 16. Urutan kerja

1. Siapkan proyek, tema, font, routing, dan klien Supabase.
2. Jalankan migrasi bagian 12, lalu verifikasi dengan query sederhana dan satu uji RPC manual.
3. Auth, guard role, dan layar blokir.
4. Model dan repository.
5. Shell navigasi karyawan dan admin.
6. Persetujuan, lalu layar Absen, lalu Riwayat.
7. Beranda karyawan, Beranda admin, data karyawan, rekap, penggajian, setelan.
8. Peninjauan bukti foto dan peta eksternal.
9. Ekspor CSV, slip PDF, berbagi file.
10. Edge Function pembersih foto lama.
11. QA lengkap dan perbaikan.

Kerjakan berurutan dan jangan menandai tahap selesai sebelum aplikasi dijalankan dan perilakunya diperiksa.
