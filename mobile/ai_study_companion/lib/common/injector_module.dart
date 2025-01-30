import 'package:get_it/get_it.dart';

import '../services/api_service.dart';

final GetIt locator = GetIt.asNewInstance();

Future<void> injectDependencies() async {
  GetIt.I.registerLazySingleton<ApiService>(() => ApiService());
}
