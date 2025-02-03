import 'package:flutter/material.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;

import '../../qiz/screens/quiz_screen.dart';

class CustomChatBottomWidget extends StatefulWidget {
  final void Function() onAttachmentPressed;
  final Future<void> Function(types.PartialText) onSendPressed;
  final String? documentId;
  final bool isMessagesEmpty;

  const CustomChatBottomWidget({
    super.key,
    required this.onAttachmentPressed,
    required this.onSendPressed,
    this.documentId,
    this.isMessagesEmpty = false,
  });

  @override
  _CustomChatBottomWidgetState createState() => _CustomChatBottomWidgetState();
}

class _CustomChatBottomWidgetState extends State<CustomChatBottomWidget> {
  final TextEditingController _textController = TextEditingController();

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  void _handleSendPressed() {
    final text = _textController.text.trim();
    if (text.isNotEmpty) {
      widget.onSendPressed(types.PartialText(text: text));
      _textController.clear();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (widget.documentId != null && widget.isMessagesEmpty)
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: ElevatedButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (context) => QuizScreen(
                      documentId: widget.documentId!,
                    ),
                  ),
                );
              },
              child: const Text('Start Quiz'),
            ),
          ),
        Container(
          color: Colors.black,
          padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(Icons.attach_file),
                onPressed: widget.onAttachmentPressed,
              ),
              Expanded(
                child: TextField(
                  controller: _textController,
                  decoration: const InputDecoration(
                    hintText: 'Type a message',
                    border: InputBorder.none,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.send),
                onPressed: _handleSendPressed,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
