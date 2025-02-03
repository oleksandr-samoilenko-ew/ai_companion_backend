import 'package:ai_study_companion/features/qiz/models/quiz_response.dart';

import '../../../services/api_service.dart';

abstract class QuizRepository {
  final ApiService apiService;

  QuizRepository(this.apiService);

  Future<QuizResponse> fetchQuiz(String id);
}

class QuizRepositoryImpl implements QuizRepository {
  @override
  final ApiService apiService;

  QuizRepositoryImpl({required this.apiService});

  @override
  Future<QuizResponse> fetchQuiz(String id) async {
    return await apiService.generateQuiz(documentId: id);
  }
}
