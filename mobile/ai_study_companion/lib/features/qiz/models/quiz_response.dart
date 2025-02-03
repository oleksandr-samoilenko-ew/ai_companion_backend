class QuizResponse {
  final String status;
  final String quizId;
  final List<QuizQuestion> quiz;

  QuizResponse({
    required this.status,
    required this.quizId,
    required this.quiz,
  });

  factory QuizResponse.fromJson(Map<String, dynamic> json) {
    return QuizResponse(
      status: json['status'],
      quizId: json['quizId'],
      quiz: (json['quiz'] as List)
          .map((questionJson) => QuizQuestion.fromJson(questionJson))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'status': status,
      'quizId': quizId,
      'quiz': quiz.map((question) => question.toJson()).toList(),
    };
  }
}

class QuizQuestion {
  final String question;
  final Map<String, String> options;

  QuizQuestion({
    required this.question,
    required this.options,
  });

  factory QuizQuestion.fromJson(Map<String, dynamic> json) {
    return QuizQuestion(
      question: json['question'],
      options: Map<String, String>.from(json['options']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'question': question,
      'options': options,
    };
  }
}
