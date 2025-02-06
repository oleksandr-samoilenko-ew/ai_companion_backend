import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../network/utils/network_util.dart';
import '../repositories/creds_repository.dart';

part 'creds_state.dart';

class CredsCubit extends Cubit<CredsState> {
  final CredsRepository credsRepository;

  CredsCubit({required this.credsRepository}) : super(CredsState.initial());

  void updateOpenAiKey(String value) {
    emit(state.copyWith(openAiKey: value));
  }

  void updatePineconeApiKey(String value) {
    emit(state.copyWith(pineconeApiKey: value));
  }

  void updatePineconeIndexName(String value) {
    emit(state.copyWith(pineconeIndexName: value));
  }

  Future<void> submitCreds() async {
    emit(state.copyWith(status: LoadingStatus.loading));
    try {
      await credsRepository.submitCredentials(
        state.openAiKey,
        state.pineconeApiKey,
        state.pineconeIndexName,
      );
      emit(state.copyWith(status: LoadingStatus.success));
    } catch (e) {
      emit(state.copyWith(status: LoadingStatus.failure, error: e.toString()));
    }
  }
}
