import 'package:intl/intl.dart';

class CurrencyUtil {
  /// Format rupiah tanpa desimal: "Rp150.000"
  static String formatRupiah(num amount) {
    final formatter = NumberFormat.currency(
      locale: 'id_ID',
      symbol: 'Rp',
      decimalDigits: 0,
    );
    return formatter.format(amount);
  }

  /// Parse dari input text ke angka numeric
  static double parseRupiah(String input) {
    final clean = input.replaceAll(RegExp(r'[^0-9]'), '');
    return double.tryParse(clean) ?? 0.0;
  }
}

typedef CurrencyFormat = CurrencyUtil;

