import 'dart:io';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../../../common/consts.dart';
import '../../../network/utils/network_util.dart';
import '../repositories/chat_repository.dart';

part 'chat_state.dart';

class ChatCubit extends Cubit<ChatWidgetState> {
  final ChatRepository chatRepository;

  ChatCubit({required this.chatRepository})
      : super(
          ChatWidgetState(
            messages: [],
            attachedFilePaths: [],
            documentId: '',
          ),
        );

  void updateMessageText(String text) {
    emit(state.copyWith(currentMessageText: text));
  }

  void handleSendPressed() {
    if (state.currentMessageText.isNotEmpty) {
      sendMessage(types.PartialText(text: state.currentMessageText), user);
      emit(state.copyWith(currentMessageText: ''));
    }
  }

  void addMessage(types.Message message) {
    final updatedMessages = [message, ...state.messages];
    emit(state.copyWith(messages: updatedMessages));
  }

  void attachFile(String filePath) {
    final updatedFilePaths = [...state.attachedFilePaths, filePath];
    emit(state.copyWith(attachedFilePaths: updatedFilePaths));
  }

  void clearAttachedFiles() {
    emit(state.copyWith(attachedFilePaths: []));
  }

  Future<void> sendMessage(types.PartialText message, types.User user) async {
    final textMessage = types.TextMessage(
      author: user,
      createdAt: DateTime.now().millisecondsSinceEpoch,
      id: const Uuid().v4(),
      text: message.text,
    );
    addMessage(textMessage);

    // Set status to loading
    emit(state.copyWith(status: LoadingStatus.loading));

    try {
      final response = await chatRepository.apiService.sendMessage(
        query: message.text,
        files: state.attachedFilePaths,
      );

      emit(
        state.copyWith(
          status: LoadingStatus.success,
        ),
      );

      if (response.results != null) {
        emit(
          state.copyWith(
            documentId: response.results![0].documentId,
          ),
        );
        for (final result in response.results!) {
          final aiMessage = types.TextMessage(
            author: const types.User(id: 'ai'),
            createdAt: DateTime.now().millisecondsSinceEpoch,
            id: const Uuid().v4(),
            text: result.message,
          );
          addMessage(aiMessage);
        }
      } else {
        final aiMessage = types.TextMessage(
          author: const types.User(id: 'ai'),
          createdAt: DateTime.now().millisecondsSinceEpoch,
          id: const Uuid().v4(),
          text: response.message!,
        );
        addMessage(aiMessage);
      }
    } catch (e) {
      final errorMessage = types.TextMessage(
        author: const types.User(id: 'system'),
        createdAt: DateTime.now().millisecondsSinceEpoch,
        id: const Uuid().v4(),
        text: 'Error: $e',
      );
      addMessage(errorMessage);

      // Set status to failure in case of error
      emit(state.copyWith(status: LoadingStatus.failure));
    }

    clearAttachedFiles();
  }

  void handlePreviewDataFetched(
    types.TextMessage message,
    types.PreviewData previewData,
  ) {
    final messages = List<types.Message>.from(state.messages);
    final index = messages.indexWhere((element) => element.id == message.id);
    final updatedMessage = (messages[index] as types.TextMessage).copyWith(
      previewData: previewData,
    );
    messages[index] = updatedMessage;
    emit(state.copyWith(messages: messages));
  }

  Future<void> handleMessageTap(types.FileMessage message) async {
    var localPath = message.uri;

    if (message.uri.startsWith('http')) {
      try {
        final messages = List<types.Message>.from(state.messages);
        final index =
            messages.indexWhere((element) => element.id == message.id);
        final updatedMessage = (messages[index] as types.FileMessage).copyWith(
          isLoading: true,
        );
        messages[index] = updatedMessage;
        emit(state.copyWith(messages: messages));

        final client = http.Client();
        final request = await client.get(Uri.parse(message.uri));
        final bytes = request.bodyBytes;
        final documentsDir = (await getApplicationDocumentsDirectory()).path;
        localPath = '$documentsDir/${message.name}';

        if (!File(localPath).existsSync()) {
          final file = File(localPath);
          await file.writeAsBytes(bytes);
        }
      } finally {
        final messages = List<types.Message>.from(state.messages);
        final index =
            messages.indexWhere((element) => element.id == message.id);
        final updatedMessage = messages[index] as types.FileMessage;
        messages[index] = updatedMessage;
        emit(state.copyWith(messages: messages));
      }
    }

    await OpenFilex.open(localPath);
  }
}
