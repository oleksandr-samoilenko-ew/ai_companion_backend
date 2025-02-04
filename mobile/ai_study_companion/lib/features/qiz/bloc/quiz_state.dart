part of 'quiz_cubit.dart';

class QuizState extends Equatable {
  final LoadingStatus status;
  final QuizResponse? quizResponse;
  final List<String> selectedAnswers;
  final Map<String, dynamic>? evaluationResult;
  final String? error;

  const QuizState({
    this.status = LoadingStatus.initial,
    this.quizResponse,
    this.selectedAnswers = const [],
    this.evaluationResult,
    this.error,
  });

  QuizState copyWith({
    LoadingStatus? status,
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
