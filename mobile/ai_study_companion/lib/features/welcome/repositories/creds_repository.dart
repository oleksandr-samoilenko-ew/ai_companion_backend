import '../../../services/api_service.dart';

abstract class CredsRepository {
  final ApiService apiService;

  CredsRepository(this.apiService);

  Future<bool> submitCredentials(
    String openAiKey,
    String pineconeApiKey,
    String pineconeIndexname,
  );
}

class CredsRepositoryImpl implements CredsRepository {
  @override
  final ApiService apiService;

  CredsRepositoryImpl({required this.apiService});

  @override
  Future<bool> submitCredentials(
    String openAiKey,
    String pineconeApiKey,
    String pineconeIndexname,
  ) async {
    return await apiService.submitCreds(
      openAiKey: openAiKey,
      pineconeApiKey: pineconeApiKey,
      pineconeIndexname: pineconeIndexname,
    );
  }
}
