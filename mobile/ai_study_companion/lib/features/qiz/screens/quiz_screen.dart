import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:simple_grid/simple_grid.dart';

import '../../../network/utils/network_util.dart';
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
  const QuizScreenContent({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Scaffold(
        appBar: AppBar(title: const Text('Quiz')),
        body: LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            return SpGrid(
              width: MediaQuery.of(context).size.width,
              alignment: WrapAlignment.center,
              children: [
                SpGridItem(
                  sm: 10,
                  md: 8,
                  lg: 6,
                  child: SizedBox(
                    height: constraints.maxHeight,
                    child: BlocBuilder<QuizCubit, QuizState>(
                      builder: (context, state) {
                        switch (state.status) {
                          case LoadingStatus.initial:
                          case LoadingStatus.loading:
                            return const Center(
                              child: CircularProgressIndicator(),
                            );
                          case LoadingStatus.success:
                          case LoadingStatus.evaluated:
                            return Column(
                              children: [
                                Expanded(
                                  child: _buildQuizContent(context, state),
                                ),
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton(
                                    onPressed:
                                        state.status == LoadingStatus.evaluated
                                            ? null
                                            : () => context
                                                .read<QuizCubit>()
                                                .evaluateQuiz(),
                                    style: ElevatedButton.styleFrom(
                                      shape: const RoundedRectangleBorder(),
                                      backgroundColor: Colors.blue,
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 16,
                                      ),
                                    ),
                                    child: const Text(
                                      'Submit',
                                      style: TextStyle(color: Colors.white),
                                    ),
                                  ),
                                ),
                              ],
                            );
                          case LoadingStatus.failure:
                            return Center(child: Text('Error: ${state.error}'));
                        }
                      },
                    ),
                  ),
                ),
              ],
            );
          },
        ),
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
        final isEvaluated = state.status == LoadingStatus.evaluated;
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
