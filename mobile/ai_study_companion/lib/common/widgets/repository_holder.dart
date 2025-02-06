import 'package:ai_study_companion/features/qiz/repositories/quiz_repository.dart';
import 'package:ai_study_companion/features/welcome/repositories/creds_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../features/chat/repositories/chat_repository.dart';
import '../../services/api_service.dart';

class RepositoriesHolder extends StatelessWidget {
  final Widget child;

  const RepositoriesHolder({
    super.key,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final ApiService apiService = GetIt.I<ApiService>();

    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<ChatRepository>(
          create: (context) => ChatRepositoryImpl(
            apiService: apiService,
          ),
        ),
        RepositoryProvider<QuizRepository>(
          create: (context) => QuizRepositoryImpl(
            apiService: apiService,
          ),
        ),
        RepositoryProvider<CredsRepository>(
          create: (context) => CredsRepositoryImpl(
            apiService: apiService,
          ),
        ),
      ],
      child: child,
    );
  }
}
