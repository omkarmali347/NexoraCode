import { createMessageId } from "../messaging/MessageBus";
import {
    ConversationMessage,
    ConversationRole,
    ConversationSnapshot
} from "../ai/types";

const DEFAULT_SYSTEM_PROMPT =
    "You are NexoraCode, a precise and helpful AI coding assistant inside VS Code. Keep answers practical, concise, and focused on software engineering tasks.";

export class ConversationManager {
    private readonly conversations = new Map<string, ConversationSnapshot>();

    public createConversation(chatId: string): ConversationSnapshot {
        const conversation: ConversationSnapshot = {
            id: chatId,
            systemMessages: [
                this.createMessage("system", DEFAULT_SYSTEM_PROMPT)
            ],
            messages: []
        };

        this.conversations.set(chatId, conversation);
        return conversation;
    }

    public getOrCreateConversation(chatId: string): ConversationSnapshot {
        return this.conversations.get(chatId) ?? this.createConversation(chatId);
    }

    public addUserMessage(chatId: string, content: string): ConversationMessage {
        return this.addMessage(chatId, "user", content);
    }

    public addAssistantMessage(chatId: string, content: string): ConversationMessage {
        return this.addMessage(chatId, "assistant", content);
    }

    private addMessage(
        chatId: string,
        role: ConversationRole,
        content: string
    ): ConversationMessage {
        const conversation = this.getOrCreateConversation(chatId);
        const message = this.createMessage(role, content);
        const next: ConversationSnapshot = {
            ...conversation,
            messages: [
                ...conversation.messages,
                message
            ]
        };

        this.conversations.set(chatId, next);
        return message;
    }

    private createMessage(role: ConversationRole, content: string): ConversationMessage {
        return {
            id: createMessageId(role),
            role,
            content,
            timestamp: Date.now()
        };
    }
}
