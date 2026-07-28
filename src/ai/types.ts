export type ConversationRole = "system" | "user" | "assistant";

export interface ProviderSettings {
    readonly baseUrl: string | null;
    readonly selectedModel: string | null;
}

export interface ResolvedProviderConfiguration extends ProviderSettings {
    readonly apiKey: string | null;
}

export interface CompleteProviderConfiguration extends ProviderSettings {
    readonly apiKey: string;
    readonly baseUrl: string;
    readonly selectedModel: string;
}

export interface ConversationMessage {
    readonly id: string;
    readonly role: ConversationRole;
    readonly content: string;
    readonly timestamp: number;
}

export interface ConversationSnapshot {
    readonly id: string;
    readonly systemMessages: readonly ConversationMessage[];
    readonly messages: readonly ConversationMessage[];
}

export interface BuiltPrompt {
    readonly system: string;
    readonly messages: readonly ProviderPromptMessage[];
}

export interface ProviderPromptMessage {
    readonly role: "user" | "assistant";
    readonly content: string;
}

export interface AIRequest {
    readonly conversationId: string;
    readonly userMessage: string;
}

export interface AIResponse {
    readonly conversationId: string;
    readonly messageId: string;
    readonly content: string;
    readonly model: string;
}

export interface ProviderCompletionRequest {
    readonly model: string;
    readonly system: string;
    readonly messages: readonly ProviderPromptMessage[];
    readonly maxTokens: number;
}

export interface ProviderCompletionResponse {
    readonly content: string;
    readonly model: string;
}

export interface IAIProvider {
    validateConnection(model: string): Promise<void>;
    complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResponse>;
}
