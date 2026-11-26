import 'package:flutter/material.dart';
import 'empty_state.dart';
import 'error_state.dart';
import 'loading_state.dart';

class DataList<T> extends StatelessWidget {
  final bool isLoading;
  final String? error;
  final String? nextStep;
  final List<T> items;
  final Future<void> Function() onRefresh;
  final Widget Function(BuildContext context, T item, int index) itemBuilder;
  final String emptyTitle;
  final String emptyDescription;
  final String? emptyActionLabel;
  final VoidCallback? onEmptyAction;
  final EdgeInsetsGeometry padding;

  const DataList({
    super.key,
    required this.isLoading,
    this.error,
    this.nextStep,
    required this.items,
    required this.onRefresh,
    required this.itemBuilder,
    required this.emptyTitle,
    required this.emptyDescription,
    this.emptyActionLabel,
    this.onEmptyAction,
    this.padding = const EdgeInsets.all(16.0),
  });

  @override
  Widget build(BuildContext context) {
    if (isLoading && items.isEmpty) {
      return const LoadingState();
    }

    if (error != null && items.isEmpty) {
      return ErrorState(
        message: error!,
        nextStep: nextStep,
        onRetry: onRefresh,
      );
    }

    if (items.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: SizedBox(
            height: MediaQuery.of(context).size.height * 0.6,
            child: EmptyState(
              title: emptyTitle,
              description: emptyDescription,
              actionLabel: emptyActionLabel,
              onAction: onEmptyAction,
            ),
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: padding,
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, index) => itemBuilder(context, items[index], index),
      ),
    );
  }
}
