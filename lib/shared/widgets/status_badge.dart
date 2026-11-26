import 'package:flutter/material.dart';
import '../../app/theme.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final int? lateMinutes;

  const StatusBadge({
    super.key,
    required this.status,
    this.lateMinutes,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    Color bg;
    Color textColor;
    String label;

    switch (status.toLowerCase()) {
      case 'hadir':
        bg = AppColors.statusHadirBg;
        textColor = AppColors.statusHadirText;
        label = 'Hadir';
        break;
      case 'terlambat':
        bg = AppColors.statusTerlambatBg;
        textColor = AppColors.statusTerlambatText;
        if (lateMinutes != null && lateMinutes! > 0) {
          label = 'Terlambat $lateMinutes mnt';
        } else {
          label = 'Terlambat';
        }
        break;
      case 'sakit':
        bg = AppColors.statusSakitBg;
        textColor = AppColors.statusSakitText;
        label = 'Sakit';
        break;
      case 'izin':
        bg = AppColors.statusIzinBg;
        textColor = AppColors.statusIzinText;
        label = 'Izin';
        break;
      case 'alfa':
        bg = AppColors.statusAlfaBg;
        textColor = AppColors.statusAlfaText;
        label = 'Alfa';
        break;
      default:
        bg = theme.colorScheme.secondary;
        textColor = theme.colorScheme.onSurfaceVariant;
        label = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: theme.textTheme.bodySmall?.copyWith(color: textColor),
      ),
    );
  }
}
