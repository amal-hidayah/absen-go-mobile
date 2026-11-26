class Failure {
  final String code;
  final String message;
  final String? nextStep;

  const Failure({
    required this.code,
    required this.message,
    this.nextStep,
  });

  @override
  String toString() => 'Failure(code: $code, message: $message, nextStep: $nextStep)';
}
