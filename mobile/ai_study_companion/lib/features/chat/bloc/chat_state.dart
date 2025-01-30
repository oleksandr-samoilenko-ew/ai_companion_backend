part of "chat_cubit.dart";

class ChatWidgetState {
  final List<types.Message> messages;
  final List<String> attachedFilePaths;

  ChatWidgetState({required this.messages, required this.attachedFilePaths});

  ChatWidgetState copyWith({
    List<types.Message>? messages,
    List<String>? attachedFilePaths,
  }) {
    return ChatWidgetState(
      messages: messages ?? this.messages,
      attachedFilePaths: attachedFilePaths ?? this.attachedFilePaths,
    );
  }
}
