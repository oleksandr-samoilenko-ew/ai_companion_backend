part of "chat_cubit.dart";

class ChatWidgetState {
  final List<types.Message> messages;
  final List<String> attachedFilePaths;
  final String? documentId;
  final String currentMessageText;
  final LoadingStatus status;

  ChatWidgetState({
    required this.messages,
    required this.attachedFilePaths,
    required this.documentId,
    this.currentMessageText = '',
    this.status = LoadingStatus.initial,
  });

  ChatWidgetState copyWith({
    List<types.Message>? messages,
    List<String>? attachedFilePaths,
    String? documentId,
    String? currentMessageText,
    LoadingStatus? status,

  }) {
    return ChatWidgetState(
      messages: messages ?? this.messages,
      attachedFilePaths: attachedFilePaths ?? this.attachedFilePaths,
      documentId: documentId ?? this.documentId,
      currentMessageText: currentMessageText ?? this.currentMessageText,
      status: status ?? this.status,

    );
  }
}
