import 'package:intl/intl.dart';

class JakartaTime {
  static const int utcOffsetHours = 7;
  static const Duration offsetDuration = Duration(hours: utcOffsetHours);

  /// Menghasilkan waktu saat ini dalam zona Asia/Jakarta
  static DateTime now() {
    return DateTime.now().toUtc().add(offsetDuration);
  }

  /// Menghasilkan tanggal hari ini (jam 00:00:00) zona Asia/Jakarta
  static DateTime today() {
    final j = now();
    return DateTime(j.year, j.month, j.day);
  }

  /// Format tanggal Indonesia: "Senin, 1 Oktober 2026"
  static String formatFullDate(DateTime date) {
    return DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(date);
  }

  /// Format tanggal singkat: "10 Nov 2026"
  static String formatShortDate(DateTime date) {
    return DateFormat('d MMM yyyy', 'id_ID').format(date);
  }

  /// Format ISO: "yyyy-MM-dd"
  static String formatIsoDate(DateTime date) {
    return DateFormat('yyyy-MM-dd').format(date);
  }

  /// Parse dari string ISO "yyyy-MM-dd"
  static DateTime? parseIsoDate(String? str) {
    if (str == null || str.trim().isEmpty) return null;
    try {
      return DateTime.parse(str);
    } catch (_) {
      return null;
    }
  }

  /// Format jam "HH:mm"
  static String formatTime(DateTime date) {
    return DateFormat('HH:mm').format(date);
  }

  /// Format dari string waktu database "HH:mm:ss" menjadi "HH:mm"
  static String formatTimeString(String? timeStr) {
    if (timeStr == null || timeStr.trim().isEmpty) return '-';
    final parts = timeStr.trim().split(':');
    if (parts.length >= 2) {
      final h = parts[0].padLeft(2, '0');
      final m = parts[1].padLeft(2, '0');
      return '$h:$m';
    }
    return timeStr;
  }

  /// Menghitung menit dari string "HH:mm:ss"
  static int timeToMinutes(String timeStr) {
    final parts = timeStr.trim().split(':');
    if (parts.length >= 2) {
      final h = int.tryParse(parts[0]) ?? 0;
      final m = int.tryParse(parts[1]) ?? 0;
      return h * 60 + m;
    }
    return 0;
  }

  /// Preset periode: 2 Minggu Ini (tanggal 1-15 atau 16-akhir bulan)
  static (DateTime start, DateTime end) presetTwoWeeks([DateTime? refDate]) {
    final ref = refDate ?? today();
    final year = ref.year;
    final month = ref.month;
    if (ref.day <= 15) {
      return (DateTime(year, month, 1), DateTime(year, month, 15));
    } else {
      final lastDay = DateTime(year, month + 1, 0).day;
      return (DateTime(year, month, 16), DateTime(year, month, lastDay));
    }
  }

  /// Preset periode: 1 Bulan Penuh (tanggal 1 sampai akhir bulan)
  static (DateTime start, DateTime end) presetOneMonth([DateTime? refDate]) {
    final ref = refDate ?? today();
    final year = ref.year;
    final month = ref.month;
    final lastDay = DateTime(year, month + 1, 0).day;
    return (DateTime(year, month, 1), DateTime(year, month, lastDay));
  }
}
