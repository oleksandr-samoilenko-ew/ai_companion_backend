import 'dart:convert';
import 'dart:developer';

import 'package:http/http.dart' as http;

import '../features/chat/models/api_response.dart';
import '../network/exceptions/api_exceptions.dart';

const String baseUrl = 'http://localhost:3000/api';

class ApiService {
  Future<ApiResponse> sendMessage({
    required String query,
    required List<String> files,
  }) async {
    log('Sending request>>> query: $query, files: $files');

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/chat-with-context'),
        headers: <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: jsonEncode(<String, dynamic>{
          'query': query,
          "filePaths": files,
        }),
      );

      log('Response status code: ${response.statusCode}');
      log('Response body: ${response.body}');

      final decodedResponse = jsonDecode(response.body);
      log('decodedResponse: ${decodedResponse}');

      if (response.statusCode == 200) {
        return ApiResponse.fromJson(decodedResponse);

      } else {
        // Handle the error response
        final errorMessage =
            decodedResponse['message'] ?? 'Unknown error occurred';
        throw ApiException(
          'Server error: $errorMessage',
          statusCode: response.statusCode,
        );
      }
    } on http.ClientException catch (e) {
      throw ApiException('Network error: ${e.message}');
    } on FormatException catch (_) {
      throw ApiException('Failed to parse response');
    } catch (e) {
      throw ApiException('Unexpected error occurred: $e');
    }
  }
}
