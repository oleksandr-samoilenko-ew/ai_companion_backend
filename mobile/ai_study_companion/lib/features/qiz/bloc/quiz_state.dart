part of 'quiz_cubit.dart';
enum QuizStatus { initial, loading, success, evaluated, failure }

class QuizState extends Equatable {
  final QuizStatus status;
  final QuizResponse? quizResponse;
  final List<String> selectedAnswers;
  final Map<String, dynamic>? evaluationResult;
  final String? error;

  const QuizState({
    this.status = QuizStatus.initial,
    this.quizResponse,
    this.selectedAnswers = const [],
    this.evaluationResult,
    this.error,
  });

  QuizState copyWith({
    QuizStatus? status,
    QuizResponse? quizResponse,
    List<String>? selectedAnswers,
    Map<String, dynamic>? evaluationResult,
    String? error,
  }) {
    return QuizState(
      status: status ?? this.status,
      quizResponse: quizResponse ?? this.quizResponse,
      selectedAnswers: selectedAnswers ?? this.selectedAnswers,
      evaluationResult: evaluationResult ?? this.evaluationResult,
      error: error ?? this.error,
    );
  }

  @override
  List<Object?> get props => [status, quizResponse, selectedAnswers, evaluationResult, error];
}