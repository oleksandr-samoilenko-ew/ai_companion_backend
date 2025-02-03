
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../bloc/quiz_cubit.dart';

class QuizScreen extends StatefulWidget {
  final String documentId;

  const QuizScreen({super.key, required this.documentId});

  @override
  State<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends State<QuizScreen> {
  @override
  void initState() {
    context.read<QuizCubit>().generateQuiz(widget.documentId);
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    return const QuizScreenContent();
  }
}

class QuizScreenContent extends StatelessWidget {
  const QuizScreenContent({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Quiz')),
      body: BlocBuilder<QuizCubit, QuizState>(
        builder: (context, state) {
          switch (state.status) {
            case QuizStatus.initial:
            case QuizStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case QuizStatus.success:
            case QuizStatus.evaluated:
              return Column(
                children: [
                  Expanded(
                    child: _buildQuizContent(context, state),
                  ),
                  ElevatedButton(
                    onPressed: state.status == QuizStatus.evaluated
                        ? null
                        : () => context.read<QuizCubit>().evaluateQuiz(),
                    child: const Text('Submit'),
                  ),
                  const SizedBox(height: 16),
                ],
              );
            case QuizStatus.failure:
              return Center(child: Text('Error: ${state.error}'));
          }
        },
      ),
    );
  }

  Widget _buildQuizContent(BuildContext context, QuizState state) {
    final quizResponse = state.quizResponse!;
    final evaluationResult = state.evaluationResult?['evaluation'];

    return ListView.builder(
      itemCount: quizResponse.quiz.length,
      itemBuilder: (context, questionIndex) {
        final question = quizResponse.quiz[questionIndex];
        final isEvaluated = state.status == QuizStatus.evaluated;
        Map<String, dynamic>? evaluationDetail;

        if (isEvaluated && evaluationResult != null) {
          final details = evaluationResult['details'] as List?;
          if (details != null && questionIndex < details.length) {
            evaluationDetail = details[questionIndex] as Map<String, dynamic>?;
          }
        }

        return Card(
          margin: const EdgeInsets.all(8.0),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  question.question,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                ...question.options.entries.map((entry) {
                  final isSelected =
                      state.selectedAnswers[questionIndex] == entry.key;
                  final isCorrect = isEvaluated &&
                      evaluationDetail?['correctAnswer'] == entry.key;

                  return RadioListTile<String>(
                    title: Text(
                      entry.value,
                      style: TextStyle(
                        color: isEvaluated
                            ? (isCorrect
                                ? Colors.green
                                : (isSelected ? Colors.red : null))
                            : null,
                      ),
                    ),
                    value: entry.key,
                    groupValue: state.selectedAnswers[questionIndex],
                    onChanged: isEvaluated
                        ? null
                        : (value) {
                            if (value != null) {
                              context
                                  .read<QuizCubit>()
                                  .updateAnswer(questionIndex, value);
                            }
                          },
                  );
                }),
                if (isEvaluated && evaluationDetail != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Explanation: ${evaluationDetail['explanation']}',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
