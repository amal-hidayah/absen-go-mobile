import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../app/theme.dart';
import '../../core/jakarta_time.dart';
import '../../data/models/attendance.dart';
import '../../data/models/attendance_evidence.dart';
import '../../data/repositories/attendance_repository.dart';

final signedPhotoUrlProvider = FutureProvider.autoDispose.family<String?, String?>((ref, photoPath) async {
  if (photoPath == null) return null;
  return ref.watch(attendanceRepositoryProvider).getSignedPhotoUrl(photoPath);
});

class EvidenceDetailSheet extends ConsumerWidget {
  final Attendance attendance;

  const EvidenceDetailSheet({super.key, required this.attendance});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final emp = attendance.employee;
    final evidences = attendance.evidences;

    return Padding(
      padding: const EdgeInsets.all(20.0),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Bukti Foto & Lokasi Presensi',
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${emp?.fullName ?? "Karyawan"} (${attendance.attendDate})',
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const Divider(),
          const SizedBox(height: 12),

          if (evidences.isEmpty) ...[
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24.0),
              child: Center(
                child: Text('Tidak ada bukti foto tercatat untuk presensi ini.'),
              ),
            ),
          ] else ...[
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: evidences.length,
                separatorBuilder: (_, _) => const SizedBox(height: 16),
                itemBuilder: (context, index) {
                  final ev = evidences[index];
                  return _EvidenceItemCard(evidence: ev);
                },
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _EvidenceItemCard extends ConsumerWidget {
  final AttendanceEvidence evidence;

  const _EvidenceItemCard({required this.evidence});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final signedUrlAsync = ref.watch(signedPhotoUrlProvider(evidence.photoPath));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: evidence.kind == 'masuk'
                        ? AppColors.statusHadirBg
                        : AppColors.statusSakitBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Absen ${evidence.kind.toLowerCase()}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: evidence.kind == 'masuk'
                          ? AppColors.statusHadirText
                          : AppColors.statusSakitText,
                    ),
                  ),
                ),
                Text(
                  JakartaTime.formatTime(evidence.capturedAt),
                  style: AppTheme.tabularFigures(theme.textTheme.bodySmall!),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Foto Selfie
            signedUrlAsync.when(
              data: (url) {
                if (url == null) {
                  return Container(
                    height: 160,
                    color: Colors.grey.shade200,
                    child: const Center(child: Text('Foto telah dihapus (retensi 90 hari)')),
                  );
                }
                return ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: AspectRatio(
                    aspectRatio: 3 / 4,
                    child: Image.network(
                      url,
                      fit: BoxFit.cover,
                      loadingBuilder: (_, child, progress) {
                        if (progress == null) return child;
                        return Container(
                          color: Colors.grey.shade100,
                          child: const Center(child: CircularProgressIndicator()),
                        );
                      },
                      errorBuilder: (_, _, _) => Container(
                        height: 160,
                        color: Colors.grey.shade200,
                        child: const Center(child: Text('Gagal memuat foto')),
                      ),
                    ),
                  ),
                );
              },
              loading: () => Container(
                height: 160,
                color: Colors.grey.shade100,
                child: const Center(child: CircularProgressIndicator()),
              ),
              error: (_, _) => const Text('Gagal memuat URL foto'),
            ),
            const SizedBox(height: 12),

            // Rincian Lokasi
            Text(
              'Jarak ke kantor: ${evidence.distanceM} meter',
              style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
            ),
            const SizedBox(height: 2),
            Text(
              'Akurasi GPS: ±${evidence.accuracyM?.round() ?? "-"} m · Koordinat: ${evidence.lat.toStringAsFixed(5)}, ${evidence.lng.toStringAsFixed(5)}',
              style: theme.textTheme.bodySmall,
            ),
            if (evidence.isMocked) ...[
              const SizedBox(height: 4),
              const Text(
                'Terdeteksi menggunakan aplikasi lokasi palsu (Mock Location)',
                style: TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.w500),
              ),
            ],
            const SizedBox(height: 12),

            // Tombol Buka di Peta (URI geo:)
            OutlinedButton.icon(
              onPressed: () async {
                final uri = Uri.parse(evidence.geoUri);
                if (await canLaunchUrl(uri)) {
                  await launchUrl(uri);
                } else {
                  // Fallback ke browser google maps
                  final webUri = Uri.parse(
                    'https://www.google.com/maps/search/?api=1&query=${evidence.lat},${evidence.lng}',
                  );
                  await launchUrl(webUri, mode: LaunchMode.externalApplication);
                }
              },
              icon: const Icon(Icons.map_outlined, size: 16),
              label: const Text('Buka Titik Koordinat di Peta'),
            ),
          ],
        ),
      ),
    );
  }
}
