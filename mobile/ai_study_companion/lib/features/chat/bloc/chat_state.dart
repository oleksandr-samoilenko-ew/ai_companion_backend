part of "chat_cubit.dart";

class ChatWidgetState {
  final List<types.Message> messages;
  final List<String> attachedFilePaths;
  final String? documentId;

  ChatWidgetState({
    required this.messages,
    required this.attachedFilePaths,
    required this.documentId,
  });

  ChatWidgetState copyWith({
    List<types.Message>? messages,
    List<String>? attachedFilePaths,
    String? documentId,
  }) {
    return ChatWidgetState(
      messages: messages ?? this.messages,
      attachedFilePaths: attachedFilePaths ?? this.attachedFilePaths,
      documentId: documentId ?? this.documentId,
    );
  }
}
