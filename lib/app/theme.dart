import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  // Permukaan netral bertint hijau sangat tipis; aksen hanya untuk aksi utama
  static const lightBackground = Color(0xFFF7F9F8);
  static const lightCard = Color(0xFFFFFFFF);
  static const lightForeground = Color(0xFF101B18);
  static const lightMuted = Color(0xFFEEF2F0);
  static const lightMutedForeground = Color(0xFF5B6A65);
  static const lightPrimary = Color(0xFF00836C);
  static const lightOnPrimary = Color(0xFFF6FEFB);
  static const lightSecondary = Color(0xFFE8EFEC);
  static const lightSecondaryForeground = Color(0xFF003D33);
  static const lightAccent = Color(0xFFF2B036);
  static const lightDestructive = Color(0xFFC5343B);
  static const lightBorder = Color(0x141F1A17);

  static const darkBackground = Color(0xFF0E1413);
  static const darkCard = Color(0xFF151C1A);
  static const darkForeground = Color(0xFFE8EFEC);
  static const darkMuted = Color(0xFF1B2623);
  static const darkMutedForeground = Color(0xFF93A29C);
  static const darkPrimary = Color(0xFF21BFA0);
  static const darkBorder = Color(0x1FFFFFFF);

  // Status: warna hanya membawa makna, bukan dekorasi
  static const statusHadirBg = Color(0xFFE6F2ED);
  static const statusHadirText = Color(0xFF145C49);

  static const statusTerlambatBg = Color(0xFFFAF1DF);
  static const statusTerlambatText = Color(0xFF6B4A00);

  static const statusSakitBg = Color(0xFFEAF0F8);
  static const statusSakitText = Color(0xFF24456E);

  static const statusIzinBg = Color(0xFFEAF3F6);
  static const statusIzinText = Color(0xFF24596B);

  static const statusAlfaBg = Color(0xFFF8E8EA);
  static const statusAlfaText = Color(0xFF7A2B33);

  static const employeeCard = Color(0xFF005C4C);
}

class AppRadius {
  static const double chip = 8;
  static const double input = 10;
  static const double button = 10;
  static const double standard = 12;
  static const double card = 16;
}

class AppTheme {
  static ThemeData get lightTheme {
    final textTheme = TextTheme(
      headlineLarge: GoogleFonts.sora(
        fontSize: 22,
        fontWeight: FontWeight.w500,
        color: AppColors.lightForeground,
      ),
      headlineMedium: GoogleFonts.sora(
        fontSize: 18,
        fontWeight: FontWeight.w500,
        color: AppColors.lightForeground,
      ),
      titleLarge: GoogleFonts.sora(
        fontSize: 16,
        fontWeight: FontWeight.w500,
        color: AppColors.lightForeground,
      ),
      titleMedium: GoogleFonts.plusJakartaSans(
        fontSize: 14,
        fontWeight: FontWeight.w500,
        color: AppColors.lightForeground,
      ),
      bodyLarge: GoogleFonts.plusJakartaSans(
        fontSize: 14,
        height: 1.5,
        color: AppColors.lightForeground,
      ),
      bodyMedium: GoogleFonts.plusJakartaSans(
        fontSize: 14,
        height: 1.5,
        color: AppColors.lightMutedForeground,
      ),
      bodySmall: GoogleFonts.plusJakartaSans(
        fontSize: 12,
        height: 1.4,
        color: AppColors.lightMutedForeground,
      ),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      fontFamily: GoogleFonts.plusJakartaSans().fontFamily,
      textTheme: textTheme,
      scaffoldBackgroundColor: AppColors.lightBackground,
      colorScheme: const ColorScheme.light(
        primary: AppColors.lightPrimary,
        onPrimary: AppColors.lightOnPrimary,
        secondary: AppColors.lightSecondary,
        onSecondary: AppColors.lightSecondaryForeground,
        surface: AppColors.lightCard,
        onSurface: AppColors.lightForeground,
        error: AppColors.lightDestructive,
        outline: AppColors.lightBorder,
      ),
      cardTheme: CardThemeData(
        color: AppColors.lightCard,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.card),
          side: const BorderSide(color: AppColors.lightBorder, width: 1),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.lightBackground,
        foregroundColor: AppColors.lightForeground,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.sora(
          fontSize: 18,
          fontWeight: FontWeight.w500,
          color: AppColors.lightForeground,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.lightMuted,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.input),
          borderSide: const BorderSide(color: AppColors.lightBorder, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.input),
          borderSide: const BorderSide(color: AppColors.lightBorder, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.input),
          borderSide: const BorderSide(
            color: AppColors.lightPrimary,
            width: 1.5,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.input),
          borderSide: const BorderSide(
            color: AppColors.lightDestructive,
            width: 1,
          ),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.lightPrimary,
          foregroundColor: AppColors.lightOnPrimary,
          elevation: 0,
          minimumSize: const Size(0, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.input),
          ),
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.lightPrimary,
          foregroundColor: AppColors.lightOnPrimary,
          minimumSize: const Size(0, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.input),
          ),
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          minimumSize: const Size(48, 48),
          tapTargetSize: MaterialTapTargetSize.padded,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.lightPrimary,
          minimumSize: const Size(0, 48),
          side: const BorderSide(color: AppColors.lightBorder, width: 1),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.input),
          ),
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  static ThemeData get darkTheme {
    final textTheme = TextTheme(
      headlineLarge: GoogleFonts.sora(
        fontSize: 22,
        fontWeight: FontWeight.w500,
        color: AppColors.darkForeground,
      ),
      headlineMedium: GoogleFonts.sora(
        fontSize: 18,
        fontWeight: FontWeight.w500,
        color: AppColors.darkForeground,
      ),
      titleLarge: GoogleFonts.sora(
        fontSize: 16,
        fontWeight: FontWeight.w500,
        color: AppColors.darkForeground,
      ),
      titleMedium: GoogleFonts.plusJakartaSans(
        fontSize: 14,
        fontWeight: FontWeight.w500,
        color: AppColors.darkForeground,
      ),
      bodyLarge: GoogleFonts.plusJakartaSans(
        fontSize: 14,
        height: 1.5,
        color: AppColors.darkForeground,
      ),
      bodyMedium: GoogleFonts.plusJakartaSans(
        fontSize: 14,
        height: 1.5,
        color: AppColors.darkMutedForeground,
      ),
      bodySmall: GoogleFonts.plusJakartaSans(
        fontSize: 12,
        height: 1.4,
        color: AppColors.darkMutedForeground,
      ),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      fontFamily: GoogleFonts.plusJakartaSans().fontFamily,
      textTheme: textTheme,
      scaffoldBackgroundColor: AppColors.darkBackground,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.darkPrimary,
        onPrimary: Color(0xFF00382E),
        secondary: Color(0xFF0A3D36),
        onSecondary: Color(0xFFC7F2E6),
        surface: AppColors.darkCard,
        onSurface: AppColors.darkForeground,
        error: AppColors.lightDestructive,
        outline: AppColors.darkBorder,
      ),
      cardTheme: CardThemeData(
        color: AppColors.darkCard,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.card),
          side: const BorderSide(color: AppColors.darkBorder, width: 1),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.darkBackground,
        foregroundColor: AppColors.darkForeground,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.sora(
          fontSize: 18,
          fontWeight: FontWeight.w500,
          color: AppColors.darkForeground,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.darkMuted,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.input),
          borderSide: const BorderSide(color: AppColors.darkBorder, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.input),
          borderSide: const BorderSide(color: AppColors.darkBorder, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.input),
          borderSide: const BorderSide(
            color: AppColors.darkPrimary,
            width: 1.5,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.input),
          borderSide: const BorderSide(
            color: AppColors.lightDestructive,
            width: 1,
          ),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.darkPrimary,
          foregroundColor: const Color(0xFF00382E),
          elevation: 0,
          minimumSize: const Size(0, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.input),
          ),
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.darkPrimary,
          foregroundColor: const Color(0xFF00382E),
          minimumSize: const Size(0, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.input),
          ),
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          minimumSize: const Size(48, 48),
          tapTargetSize: MaterialTapTargetSize.padded,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.darkPrimary,
          minimumSize: const Size(0, 48),
          side: const BorderSide(color: AppColors.darkBorder, width: 1),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.input),
          ),
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  /// Style helper untuk tabular figures (angka tanggal, jam, nominal uang)
  static TextStyle tabularFigures(TextStyle baseStyle) {
    return baseStyle.copyWith(
      fontFeatures: [const FontFeature.tabularFigures()],
    );
  }
}
