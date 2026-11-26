import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../../app/theme.dart';
import '../../core/currency.dart';
import '../../core/jakarta_time.dart';
import '../../core/strings.dart';
import '../../data/repositories/payroll_repository.dart';

class PayrollSlipDialog extends StatelessWidget {
  final String companyName;
  final DateTime startDate;
  final DateTime endDate;
  final PayrollEmployeeSummary summary;

  const PayrollSlipDialog({
    super.key,
    required this.companyName,
    required this.startDate,
    required this.endDate,
    required this.summary,
  });

  Future<Uint8List> _generatePdfDoc() async {
    final pdf = pw.Document();
    final emp = summary.employee;
    final periodStr =
        '${JakartaTime.formatShortDate(startDate)} - ${JakartaTime.formatShortDate(endDate)}';

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              // Header Perusahaan
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text(
                        companyName,
                        style: pw.TextStyle(
                          fontSize: 18,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                      pw.SizedBox(height: 2),
                      pw.Text('SLIP GAJI KARYAWAN', style: const pw.TextStyle(fontSize: 14)),
                    ],
                  ),
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.end,
                    children: [
                      pw.Text('Periode:', style: const pw.TextStyle(fontSize: 11)),
                      pw.Text(
                        periodStr,
                        style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12),
                      ),
                    ],
                  ),
                ],
              ),
              pw.Divider(thickness: 1),
              pw.SizedBox(height: 16),

              // Identitas Karyawan
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('NIK: ${emp.nik}'),
                      pw.SizedBox(height: 4),
                      pw.Text('Nama: ${emp.fullName}', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                    ],
                  ),
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('Departemen: ${emp.department}'),
                      pw.SizedBox(height: 4),
                      pw.Text('Jabatan: ${emp.position}'),
                    ],
                  ),
                ],
              ),
              pw.SizedBox(height: 24),

              // Rincian Kehadiran
              pw.Text(
                'RINCIAN KEHADIRAN & PENGGAJIAN',
                style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12),
              ),
              pw.SizedBox(height: 8),

              pw.Table(
                border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
                children: [
                  pw.TableRow(
                    decoration: const pw.BoxDecoration(color: PdfColors.grey200),
                    children: [
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('Deskripsi Komponen', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('Jumlah / Keterangan', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('Nominal Subtotal', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                      ),
                    ],
                  ),
                  pw.TableRow(
                    children: [
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('Tarif Gaji Harian'),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text(CurrencyUtil.formatRupiah(emp.dailySalary)),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('-'),
                      ),
                    ],
                  ),
                  pw.TableRow(
                    children: [
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('Hadir Tepat Waktu (Lengkap)'),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('${summary.onTimeCount} Hari'),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text(CurrencyUtil.formatRupiah(summary.onTimeCount * emp.dailySalary)),
                      ),
                    ],
                  ),
                  pw.TableRow(
                    children: [
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('Hadir Terlambat (Lengkap)'),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('${summary.lateCount} Hari'),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text(CurrencyUtil.formatRupiah(summary.lateCount * emp.dailySalary)),
                      ),
                    ],
                  ),
                  pw.TableRow(
                    children: [
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('Presensi Belum Lengkap (Tidak dibayar)'),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('${summary.incompleteCount} Hari'),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('Rp0'),
                      ),
                    ],
                  ),
                  pw.TableRow(
                    children: [
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('Izin, sakit, alfa (Tidak dibayar)'),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('${summary.leaveCount} Hari'),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('Rp0'),
                      ),
                    ],
                  ),
                ],
              ),
              pw.SizedBox(height: 16),

              // Total Penerimaan
              pw.Container(
                padding: const pw.EdgeInsets.all(12),
                decoration: const pw.BoxDecoration(
                  color: PdfColors.grey100,
                ),
                child: pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text(
                      'TOTAL GAJI DITERIMA (${summary.daysPaid} Hari Kerja):',
                      style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 13),
                    ),
                    pw.Text(
                      CurrencyUtil.formatRupiah(summary.totalSalary),
                      style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 16),
                    ),
                  ],
                ),
              ),
              pw.SizedBox(height: 48),

              // Dua Kolom Tanda Tangan
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.center,
                    children: [
                      pw.Text('Diterima Oleh,'),
                      pw.SizedBox(height: 48),
                      pw.Text('( ${emp.fullName} )', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                    ],
                  ),
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.center,
                    children: [
                      pw.Text('Disetujui Oleh (HRD/Admin),'),
                      pw.SizedBox(height: 48),
                      pw.Text('( ......................................... )'),
                    ],
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );

    return pdf.save();
  }

  @override
  Widget build(BuildContext context) {
    final emp = summary.employee;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    'Slip Gaji: ${emp.fullName}',
                    style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 16),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const Divider(),
            const SizedBox(height: 8),

            Text(
              'Periode: ${JakartaTime.formatShortDate(startDate)} - ${JakartaTime.formatShortDate(endDate)}',
              style: const TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 4),
            Text(
              'Total Hari Hadir Lengkap: ${summary.daysPaid} Hari',
              style: const TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 4),
            Text(
              'Total Diterima: ${CurrencyUtil.formatRupiah(summary.totalSalary)}',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: AppColors.lightPrimary),
            ),
            const SizedBox(height: 20),

            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final bytes = await _generatePdfDoc();
                      final fileName =
                          'slip-gaji-${emp.nik}-${JakartaTime.formatIsoDate(startDate)}.pdf';
                      await Printing.sharePdf(bytes: bytes, filename: fileName);
                    },
                    icon: const Icon(Icons.share_outlined, size: 16),
                    label: const Text(AppStrings.sharePdf),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () async {
                      final bytes = await _generatePdfDoc();
                      await Printing.layoutPdf(onLayout: (_) => bytes);
                    },
                    icon: const Icon(Icons.print_outlined, size: 16),
                    label: const Text(AppStrings.printPdf),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
