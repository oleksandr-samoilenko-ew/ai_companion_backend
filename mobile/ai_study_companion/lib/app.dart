import 'package:ai_study_companion/common/pages/home_page.dart';
import 'package:flutter/material.dart';

import 'common/widgets/global_bloc_provider.dart';

class Application extends StatelessWidget {
  const Application({super.key});

  @override
  Widget build(BuildContext context) {
    return GlobalBlocProvider(
      child: MaterialApp(
        title: 'Ai Assistant',
        theme: ThemeData(
          primarySwatch: Colors.blue,
        ),
        home: const HomePage(),
      ),
    );
  }
}
