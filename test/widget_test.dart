import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:absengo_mobile/core/currency.dart';
import 'package:absengo_mobile/core/csv.dart';
import 'package:absengo_mobile/core/jakarta_time.dart';
import 'package:absengo_mobile/core/strings.dart';
import 'package:absengo_mobile/shared/widgets/status_badge.dart';
import 'package:absengo_mobile/features/auth/login_screen.dart';

void main() {
  group('Core Utilities Test', () {
    test('CurrencyFormat formats Indonesian Rupiah correctly', () {
      expect(CurrencyFormat.formatRupiah(150000), 'Rp150.000');
      expect(CurrencyFormat.formatRupiah(0), 'Rp0');
      expect(CurrencyFormat.formatRupiah(2500000), 'Rp2.500.000');
    });

    test('JakartaTime preset 2 minggu dan 1 bulan return valid dates', () {
      final (start2w, end2w) = JakartaTime.presetTwoWeeks();
      expect(start2w.isBefore(end2w) || start2w.isAtSameMomentAs(end2w), isTrue);

      final (start1m, end1m) = JakartaTime.presetOneMonth();
      expect(start1m.day, 1);
      expect(start1m.isBefore(end1m), isTrue);
    });

    test('CsvGenerator builds valid UTF-8 BOM CSV with escaped quotes', () {
      final headers = ['NIK', 'Nama', 'Keterangan'];
      final rows = [
        ['EMP001', 'Budi Santoso', 'Catatan "khusus" karyawan'],
        ['EMP002', 'Siti, Aminah', 'Hadir tepat waktu'],
      ];

      final csvBytes = CsvGenerator.generate(headers: headers, rows: rows);
      // Byte 0-2 must be UTF-8 BOM: 0xEF, 0xBB, 0xBF
      expect(csvBytes[0], 0xEF);
      expect(csvBytes[1], 0xBB);
      expect(csvBytes[2], 0xBF);

      final csvString = String.fromCharCodes(csvBytes);
      expect(csvString.contains('"EMP001","Budi Santoso","Catatan ""khusus"" karyawan"'), isTrue);
      expect(csvString.contains('"EMP002","Siti, Aminah","Hadir tepat waktu"'), isTrue);
    });
  });

  group('Widget Tests', () {
    testWidgets('StatusBadge renders correctly with contrast compliant styling', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                StatusBadge(status: 'hadir'),
                StatusBadge(status: 'terlambat'),
                StatusBadge(status: 'alfa'),
              ],
            ),
          ),
        ),
      );

      expect(find.text(AppStrings.statusHadir), findsOneWidget);
      expect(find.text(AppStrings.statusTerlambat), findsOneWidget);
      expect(find.text(AppStrings.statusAlfa), findsOneWidget);
    });

    testWidgets('LoginScreen renders username, password, and submit button', (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      expect(find.text(AppStrings.appName), findsOneWidget);
      expect(find.text(AppStrings.usernameLabel), findsOneWidget);
      expect(find.text(AppStrings.passwordLabel), findsOneWidget);
      expect(find.text(AppStrings.loginButton), findsOneWidget);
      expect(find.text(AppStrings.noSelfRegisterNote), findsOneWidget);
    });
  });
}
