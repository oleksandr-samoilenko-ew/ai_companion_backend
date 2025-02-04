import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../network/utils/network_util.dart';
import '../models/quiz_response.dart';
import '../repositories/quiz_repository.dart';

part 'quiz_state.dart';

class QuizCubit extends Cubit<QuizState> {
  final QuizRepository quizRepository;

  QuizCubit({required this.quizRepository}) : super(const QuizState());

  Future<void> generateQuiz(String documentId) async {
    emit(state.copyWith(status: LoadingStatus.loading));

    try {
      final quizResponse =
          await quizRepository.apiService.generateQuiz(documentId: documentId);
      emit(
        state.copyWith(
          status: LoadingStatus.success,
          quizResponse: quizResponse,
          selectedAnswers: List.filled(quizResponse.quiz.length, ''),
        ),
      );
    } catch (e) {
      emit(
        state.copyWith(
          status: LoadingStatus.failure,
          error: e.toString(),
        ),
      );
    }
  }

  void updateAnswer(int questionIndex, String answer) {
    final updatedAnswers = List<String>.from(state.selectedAnswers);
    updatedAnswers[questionIndex] = answer;
    emit(state.copyWith(selectedAnswers: updatedAnswers));
  }

  Future<void> evaluateQuiz() async {
    if (state.quizResponse == null) return;

    emit(state.copyWith(status: LoadingStatus.loading));

    try {
      final evaluationResult = await quizRepository.apiService.evaluateQuiz(
        quizId: state.quizResponse!.quizId,
        answers: state.selectedAnswers,
      );
      emit(
        state.copyWith(
          status: LoadingStatus.evaluated,
          evaluationResult: evaluationResult,
        ),
      );
    } catch (e) {
      emit(
        state.copyWith(
          status: LoadingStatus.failure,
          error: e.toString(),
        ),
      );
    }
  }
}
