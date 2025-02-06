import 'package:ai_study_companion/features/chat/repositories/chat_repository.dart';
import 'package:ai_study_companion/features/qiz/repositories/quiz_repository.dart';
import 'package:ai_study_companion/features/welcome/bloc/creds_cubit.dart';
import 'package:ai_study_companion/features/welcome/repositories/creds_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../features/chat/bloc/chat_cubit.dart';
import '../../features/qiz/bloc/quiz_cubit.dart';

class GlobalBlocProvider extends StatelessWidget {
  const GlobalBlocProvider({
    super.key,
    required this.child,
  });

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<ChatCubit>(
          create: (context) =>
              ChatCubit(chatRepository: context.read<ChatRepository>()),
        ),
        BlocProvider<QuizCubit>(
          create: (context) =>
              QuizCubit(quizRepository: context.read<QuizRepository>()),
        ),
        BlocProvider<CredsCubit>(
          create: (context) =>
              CredsCubit(credsRepository: context.read<CredsRepository>()),
        ),
      ],
      child: child,
    );
  }
}
