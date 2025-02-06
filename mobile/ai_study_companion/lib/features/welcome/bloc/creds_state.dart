part of 'creds_cubit.dart';


class CredsState {
  final String openAiKey;
  final String pineconeApiKey;
  final String pineconeIndexName;
  final LoadingStatus status;
  final String? error;

  CredsState({
    required this.openAiKey,
    required this.pineconeApiKey,
    required this.pineconeIndexName,
    required this.status,
    this.error,
  });

  factory CredsState.initial() => CredsState(
    openAiKey: '',
    pineconeApiKey: '',
    pineconeIndexName: '',
    status: LoadingStatus.initial,
  );

  CredsState copyWith({
    String? openAiKey,
    String? pineconeApiKey,
    String? pineconeIndexName,
    LoadingStatus? status,
    String? error,
  }) {
    return CredsState(
      openAiKey: openAiKey ?? this.openAiKey,
      pineconeApiKey: pineconeApiKey ?? this.pineconeApiKey,
      pineconeIndexName: pineconeIndexName ?? this.pineconeIndexName,
      status: status ?? this.status,
      error: error ?? this.error,
    );
  }
}
