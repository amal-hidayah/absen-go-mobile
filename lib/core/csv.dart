import 'dart:convert';
import 'dart:typed_data';

class CsvUtil {
  /// Membungkus baris sel menjadi baris CSV dengan kutip ganda dan escape
  static String encodeRow(List<dynamic> cells) {
    return cells.map((c) {
      final str = c?.toString() ?? '';
      final escaped = str.replaceAll('"', '""');
      return '"$escaped"';
    }).join(',');
  }

  /// Membuat konten CSV lengkap dengan BOM UTF-8
  static String createCsvDocument({
    required List<String> headers,
    required List<List<dynamic>> rows,
  }) {
    final buffer = StringBuffer();
    // BOM UTF-8 untuk kompatibilitas Microsoft Excel
    buffer.write('\uFEFF');
    buffer.writeln(encodeRow(headers));
    for (final row in rows) {
      buffer.writeln(encodeRow(row));
    }
    return buffer.toString();
  }

  /// Menghasilkan bytes UTF-8 BOM untuk pengujian dan penyimpanan file
  static Uint8List generate({
    required List<String> headers,
    required List<List<dynamic>> rows,
  }) {
    final str = createCsvDocument(headers: headers, rows: rows);
    return Uint8List.fromList(utf8.encode(str));
  }
}

typedef CsvGenerator = CsvUtil;

