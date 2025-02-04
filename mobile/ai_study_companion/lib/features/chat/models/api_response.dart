class ApiResponse {
  final String status;
  final List<Result>? results;
  final List<ProcessedFile>? processedFiles;
  final String? message;
  final String? type;

  ApiResponse({
    required this.status,
    this.results,
    this.processedFiles,
    this.message,
    this.type,
  });

  factory ApiResponse.fromJson(Map<String, dynamic> json) {
    return ApiResponse(
      status: json['status'],
      results: json['results'] != null
          ? (json['results'] as List).map((result) => Result.fromJson(result)).toList()
          : null,
      processedFiles: json['processedFiles'] != null
          ? (json['processedFiles'] as List).map((file) => ProcessedFile.fromJson(file)).toList()
          : null,
      message: json['message'],
      type: json['type'],
    );
  }
}

class Result {
  final String status;
  final String message;
  final List<String> fileNames;
  final String documentId;

  Result({
    required this.status,
    required this.message,
    required this.fileNames,
    required this.documentId,
  });

  factory Result.fromJson(Map<String, dynamic> json) {
    return Result(
      status: json['status'],
      message: json['message'],
      fileNames: List<String>.from(json['fileNames']),
      documentId: json['documentId'],
    );
  }
}

class ProcessedFile {
  final String documentId;
  final String fileName;
  final String status;

  ProcessedFile({
    required this.documentId,
    required this.fileName,
    required this.status,
  });

  factory ProcessedFile.fromJson(Map<String, dynamic> json) {
    return ProcessedFile(
      documentId: json['documentId'],
      fileName: json['fileName'],
      status: json['status'],
    );
  }
}
