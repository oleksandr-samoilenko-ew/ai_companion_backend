import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../network/utils/network_util.dart';
import '../../qiz/screens/quiz_screen.dart';
import '../bloc/chat_cubit.dart';

class CustomChatBottomWidget extends StatelessWidget {
  final void Function() onAttachmentPressed;

  const CustomChatBottomWidget({
    super.key,
    required this.onAttachmentPressed,
  });

  @override
  Widget build(BuildContext context) {
    final chatCubit = context.watch<ChatCubit>();

    return Column(
      children: [
        if (chatCubit.state.status == LoadingStatus.loading)
          const Padding(
            padding: EdgeInsets.all(8.0),
            child: Center(
              child: CircularProgressIndicator(),
            ),
          ),
        if (chatCubit.state.documentId != null &&
            chatCubit.state.documentId!.isNotEmpty)
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (context) => QuizScreen(
                      documentId: chatCubit.state.documentId!,
                    ),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                shape: const RoundedRectangleBorder(),
                backgroundColor: Colors.blue,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: const Text(
                'Start Quiz',
                style: TextStyle(color: Colors.white),
              ),
            ),
          ),
        Container(
          color: Colors.black,
          padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(
                  Icons.attach_file,
                  color: Colors.grey,
                ),
                onPressed: onAttachmentPressed,
              ),
              Expanded(
                child: TextField(
                  decoration: const InputDecoration(
                    hintText: 'Type a message',
                    hintStyle: TextStyle(color: Colors.grey),
                    border: InputBorder.none,
                  ),
                  style: const TextStyle(color: Colors.grey),
                  onChanged: (value) => chatCubit.updateMessageText(value),
                ),
              ),
              IconButton(
                icon: const Icon(
                  Icons.send,
                  color: Colors.grey,
                ),
                onPressed: () => chatCubit.handleSendPressed(),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
