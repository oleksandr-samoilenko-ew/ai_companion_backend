import 'dart:convert';
import 'dart:developer';

import 'package:http/http.dart' as http;

import '../features/chat/models/api_response.dart';
import '../features/qiz/models/quiz_response.dart';
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

  Future<QuizResponse> generateQuiz({
    required String documentId,
  }) async {
    log('Generating quiz for document: $documentId');

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/quiz/generate'),
        headers: <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: jsonEncode(<String, dynamic>{
          'documentId': documentId,
        }),
      );
      final decodedResponse = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return QuizResponse.fromJson(decodedResponse);
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

  Future<Map<String, dynamic>> evaluateQuiz({
    required String quizId,
    required List<String> answers,
  }) async {
    log('Evaluating quiz: $quizId with answers: $answers');

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/quiz/evaluate'),
        headers: <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: jsonEncode(<String, dynamic>{
          'quizId': quizId,
          'answers': answers,
        }),
      );

      final decodedResponse = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return decodedResponse;
      } else {
        final errorMessage = decodedResponse['message'] ?? 'Unknown error occurred';
        throw ApiException('Server error: $errorMessage', statusCode: response.statusCode);
      }
    } catch (e) {
      throw ApiException('Error evaluating quiz: $e');
    }
  }
}
