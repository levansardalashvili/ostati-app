import type { ChatEntry, ChatMsg } from '../types/chat';
import { CHATS_LIST, CHAT_MESSAGES } from '../data/mockChats';

export interface ChatService {
  listChats(): ChatEntry[];
  getChatById(chatId: string): ChatEntry | undefined;
  getMessages(chatId: string): ChatMsg[];
}

// TODO: ჩანაცვლდება Firestore-ის conversations/messages collections-ით.
export const chatService: ChatService = {
  listChats: () => CHATS_LIST,
  getChatById: (chatId) => CHATS_LIST.find((c) => c.id === chatId),
  getMessages: (chatId) => CHAT_MESSAGES[chatId] ?? [],
};
