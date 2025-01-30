


import '../../../services/api_service.dart';
import '../models/api_response.dart';

abstract class ChatRepository {
  final ApiService apiService;

  ChatRepository(this.apiService);

  Future<ApiResponse> fetchChatResponse(String query, List<String> files);
}

class ChatRepositoryImpl implements ChatRepository {
  @override
  final ApiService apiService;

  ChatRepositoryImpl({required this.apiService});

  @override
  Future<ApiResponse> fetchChatResponse(String query, List<String> files) async {
    return await apiService.sendMessage(query: query, files: files);
  }
}
