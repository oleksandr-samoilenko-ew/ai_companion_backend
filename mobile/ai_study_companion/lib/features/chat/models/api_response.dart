class ApiResponse {
  final String status;
  final List<Result> results;
  final List<ProcessedFile> processedFiles;

  ApiResponse({
    required this.status,
    required this.results,
    required this.processedFiles,
  });

  factory ApiResponse.fromJson(Map<String, dynamic> json) {
    return ApiResponse(
      status: json['status'],
      results: (json['results'] as List)
          .map((result) => Result.fromJson(result))
          .toList(),
      processedFiles: (json['processedFiles'] as List)
          .map((file) => ProcessedFile.fromJson(file))
          .toList(),
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