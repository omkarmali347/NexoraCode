import {
    BuiltPrompt,
    ConversationMessage,
    ConversationSnapshot,
    ProviderPromptMessage
} from "../ai/types";

export class PromptBuilder {
    public build(conversation: ConversationSnapshot): BuiltPrompt {
        const system = conversation.systemMessages
            .map((message) => message.content)
            .join("\n\n");
        const messages: ProviderPromptMessage[] = conversation.messages
            .filter(isProviderMessage)
            .map((message) => ({
                role: message.role,
                content: message.content
            }));

        return {
            system,
            messages
        };
    }
}

function isProviderMessage(
    message: ConversationMessage
): message is ConversationMessage & ProviderPromptMessage {
    return message.role === "user" || message.role === "assistant";
}
