class AppStrings {
  // App
  static const appName = 'AbsenGo Corporate';

  // Auth & Login
  static const loginTitle = 'AbsenGo Corporate';
  static const loginSubtitle = 'Presensi harian dan penggajian karyawan kantor';
  static const usernameLabel = 'Username';
  static const usernameHint = 'Email akun atau username karyawan';
  static const passwordLabel = 'Kata sandi';
  static const passwordHint = 'Kata sandi akun';
  static const loginButton = 'Masuk';
  static const loginProcessing = 'Memproses';
  static const loginHelpText = 'Belum punya akun? Hubungi administrator kantor.';
  static const userNotFound = 'Username tidak ditemukan atau akun sudah dinonaktifkan.';
  static const invalidCredentials = 'Username atau kata sandi salah.';
  static const accountInactive = 'Akun ini belum aktif. Hubungi administrator kantor.';
  static const sessionExpired = 'Sesi Anda telah berakhir. Silakan masuk kembali.';
  static const logout = 'Keluar';

  // Blocked / Guard Screens
  static const noProfileTitle = 'Akun belum terdaftar sebagai karyawan';
  static const noProfileDesc =
      'Akun login Anda berhasil diverifikasi, namun data profil karyawan belum ditautkan di sistem oleh administrator.';
  static const adminOnlyTitle = 'Halaman khusus administrator';
  static const adminOnlyDesc =
      'Halaman yang Anda tuju memerlukan hak akses administrator kantor.';
  static const backToHome = 'Kembali ke Beranda';

  // Navigation
  static const navHome = 'Beranda';
  static const navAttendance = 'Absen';
  static const navHistory = 'Riwayat';
  static const navEmployees = 'Karyawan';
  static const navPayroll = 'Gaji';
  static const navRecap = 'Rekap';
  static const navSettings = 'Setelan';

  // Navigation aliases
  static const tabHome = navHome;
  static const tabAttendance = navAttendance;
  static const tabHistory = navHistory;
  static const tabEmployees = navEmployees;
  static const tabPayroll = navPayroll;
  static const tabRecap = navRecap;
  static const tabSettings = navSettings;

  // Aliases for titles & common buttons
  static const adminDashboard = 'Presensi hari ini';
  static const clockInButton = 'Absen sekarang';
  static const employeeListTitle = 'Karyawan dan tarif gaji';
  static const addEmployee = 'Tambah karyawan';
  static const noSelfRegisterNote = loginHelpText;

  // Status Labels
  static const statusHadir = 'Hadir';
  static const statusTerlambat = 'Terlambat';
  static const statusIzin = 'Izin';
  static const statusSakit = 'Sakit';
  static const statusAlfa = 'Alfa';

  // Employee Dashboard
  static const employeeDashboardTitle = 'Presensi karyawan';
  static const attendanceToday = 'Absensi hari ini';
  static const checkIn = 'Jam Masuk';
  static const checkOut = 'Jam Pulang';
  static const attendNow = 'Absen sekarang';
  static const monthlyDaysPresent = 'Hari hadir bulan ini';
  static const estimatedSalary = 'Estimasi Gaji';
  static const incompleteWarning = 'Ada hari presensi belum lengkap. Lengkapi jam masuk dan jam pulang agar gaji harian dihitung.';
  static const recentHistory = 'Riwayat presensi bulan ini';

  // Admin Dashboard
  static const adminDashboardTitle = 'Presensi hari ini';
  static const manualAttendanceBtn = 'Input izin atau cuti';
  static const statActiveEmployees = 'Karyawan aktif';
  static const statCheckedIn = 'Sudah masuk';
  static const statLate = 'Terlambat';
  static const statLeave = 'Izin, sakit, alfa';
  static const statPending = 'Belum presensi';
  static const todayAttendanceList = 'Presensi karyawan hari ini';
  static const seeRecap = 'Lihat rekap lengkap';
  static const emptyTodayAttendance = 'Belum ada presensi hari ini. Catatan akan muncul setelah karyawan melakukan absen dari aplikasi mobile.';
  static const emptyEmployeePrompt = 'Belum ada data karyawan di sistem kantor.';

  // Attendance Screen
  static const locationCardTitle = 'Radius kantor';
  static const refreshLocation = 'Perbarui lokasi';
  static const insideRadius = 'Di dalam radius';
  static const outsideRadius = 'Di luar radius';
  static const lowAccuracy = 'Akurasi rendah';
  static const outsideWarning = 'Perangkat Anda terdeteksi di luar batas radius kantor. Presensi akan ditolak oleh server jika Anda tetap melanjutkan.';
  static const takeSelfie = 'Ambil selfie';
  static const retakeSelfie = 'Ulangi foto';
  static const submitAttendance = 'Kirim absen';
  static const selfieHelpText = 'Selfie dipakai sebagai bukti kehadiran dan hanya bisa dilihat admin.';
  static const locationOffTitle = 'Lokasi GPS tidak aktif';
  static const locationOffDesc = 'Aktifkan layanan lokasi GPS pada pengaturan perangkat Anda untuk melanjutkan presensi.';
  static const locationPermissionTitle = 'Izin lokasi diperlukan';
  static const locationPermissionDesc = 'Aplikasi memerlukan izin akses lokasi saat digunakan agar server dapat memvalidasi radius kantor.';
  static const cameraPermissionTitle = 'Izin kamera diperlukan';
  static const cameraPermissionDesc = 'Aplikasi memerlukan izin kamera untuk mengambil foto bukti kehadiran saat absen.';
  static const retryButton = 'Coba lagi';
  static const openSettings = 'Buka pengaturan';

  // Attendance Results & Codes
  static const codeDiLuarRadius = 'Di luar radius kantor';
  static const codeLokasiTidakAkurat = 'Sinyal GPS lemah';
  static const codeLokasiPalsu = 'Lokasi palsu terdeteksi';
  static const codeFotoTidakAda = 'Foto absen tidak ditemukan';
  static const codeFotoTidakValid = 'Foto absen tidak valid';
  static const codeBelumBuka = 'Presensi belum dibuka';
  static const codeBelumWaktuPulang = 'Belum waktunya pulang';
  static const codeSudahLengkap = 'Presensi sudah lengkap';
  static const codeSudahTercatat = 'Presensi sudah tercatat';
  static const codeTanpaProfil = 'Profil belum terdaftar';
  static const codeNonaktif = 'Akun sedang tidak aktif';
  static const codePengaturan = 'Pengaturan belum lengkap';

  // Consent Screen
  static const consentTitle = 'Persetujuan penggunaan data presensi';
  static const consentSubtitle = 'Sebelum melakukan absensi pertama kali, mohon pelajari dan setujui ketentuan berikut:';
  static const consentDataCollected = 'Data yang dikumpulkan: Titik koordinat lokasi saat menekan tombol Absen dan satu foto selfie.';
  static const consentPurpose = 'Tujuan penggunaan: Mencatat waktu kehadiran kerja dan menghitung besaran gaji harian.';
  static const consentAccess = 'Pihak yang dapat melihat: Anda sendiri dan administrator kantor.';
  static const consentRetention = 'Lama penyimpanan: Foto bukti disimpan selama 90 hari dan otomatis dibersihkan secara berkala.';
  static const consentAgreeButton = 'Saya mengerti dan setuju';

  // Common UI
  static const filter = 'Filter';
  static const search = 'Cari';
  static const save = 'Simpan';
  static const cancel = 'Batal';
  static const edit = 'Ubah';
  static const delete = 'Hapus';
  static const close = 'Tutup';
  static const exportCsv = 'Export CSV';
  static const sharePdf = 'Bagikan PDF';
  static const printPdf = 'Cetak Slip';
  static const loading = 'Memuat data...';
  static const emptyData = 'Tidak ada data untuk ditampilkan.';
  static const errorOccurred = 'Terjadi kesalahan saat memuat data.';
}
