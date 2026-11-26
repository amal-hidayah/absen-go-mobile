import 'package:flutter/material.dart';
import '../../core/strings.dart';

class LoadingState extends StatelessWidget {
  final String label;

  const LoadingState({
    super.key,
    this.label = AppStrings.loading,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 16),
            Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}
