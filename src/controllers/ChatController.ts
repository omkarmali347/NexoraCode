import {
    AttachPayload,
    EmptyPayload,
    ErrorPayload,
    ExtensionMessageTypes,
    NewChatPayload,
    PingPayload,
    ProviderSettingsPayload,
    RemoveAttachmentPayload,
    RequestWorkspacePayload,
    SendMessagePayload,
    StopGenerationPayload
} from "../protocol/messageTypes";
import { AIProviderError } from "../ai/AIProviderError";
import { createMessageId, MessageBus } from "../messaging/MessageBus";
import { AIService, ProviderConnectionInput } from "../services/AIService";

const ATTACHMENT_PLACEHOLDER =
    "Attachment service will be implemented in Phase 4.";

export class ChatController {
    private activeChatId: string | null = null;

    constructor(
        private readonly messageBus: MessageBus,
        private readonly aiService: AIService
    ) {}

    public createNewChat(payload: NewChatPayload): void {
        const chatId = createMessageId("chat");
        this.activeChatId = chatId;
        this.aiService.createConversation(chatId);

        console.log("[Extension] New chat requested.", {
            chatId,
            source: payload.source
        });

        this.messageBus.post(ExtensionMessageTypes.CHAT_CREATED, {
            chatId
        });
        this.messageBus.status("ready", "New chat ready.");
    }

    public async receiveMessage(payload: SendMessagePayload): Promise<void> {
        const chatId = this.resolveChatId(payload.chatId);
        const messageId = createMessageId("user");

        console.log("[Extension] Message received from webview.", {
            chatId,
            messageId,
            characterCount: payload.content.length,
            attachmentCount: payload.attachments.length
        });

        this.messageBus.status("working", "Message received.");
        this.messageBus.post(ExtensionMessageTypes.MESSAGE_RECEIVED, {
            chatId,
            messageId
        });

        try {
            const response = await this.aiService.sendMessage({
                conversationId: chatId,
                userMessage: payload.content
            });

            this.messageBus.post(ExtensionMessageTypes.MESSAGE_RESPONSE, {
                chatId,
                message: {
                    id: response.messageId,
                    role: "assistant",
                    content: response.content,
                    timestamp: Date.now()
                }
            });
        } catch (error: unknown) {
            const payload = this.toErrorPayload(error);

            console.error("[Extension] AI request failed.", payload.code);
            this.messageBus.error(payload);
        }
    }

    public attach(payload: AttachPayload): void {
        const chatId = this.resolveChatId(null);

        console.log("[Extension] Attach requested.", {
            chatId,
            source: payload.source
        });

        this.messageBus.post(ExtensionMessageTypes.MESSAGE_RESPONSE, {
            chatId,
            message: {
                id: createMessageId("system"),
                role: "system",
                content: ATTACHMENT_PLACEHOLDER,
                timestamp: Date.now()
            }
        });
        this.messageBus.status("ready", "Attachment placeholder shown.");
    }

    public removeAttachment(payload: RemoveAttachmentPayload): void {
        console.log("[Extension] Remove attachment requested.", {
            attachmentId: payload.attachmentId
        });
        this.messageBus.status("warning", "Attachment removal is not implemented yet.");
    }

    public async openSettings(_payload: EmptyPayload): Promise<void> {
        console.log("[Extension] Open settings requested.");
        await this.postSettingsState();
    }

    public async saveSettings(payload: ProviderSettingsPayload): Promise<void> {
        console.log("[Extension] Save provider settings requested.", {
            hasApiKey: Boolean(payload.apiKey),
            baseUrlConfigured: payload.baseUrl.trim().length > 0,
            modelConfigured: payload.model.trim().length > 0
        });

        try {
            await this.aiService.saveSettings(this.toConnectionInput(payload));
            await this.postSettingsState("Settings saved.");
            this.messageBus.status("ready", "Settings saved.");
        } catch (error: unknown) {
            this.messageBus.error(this.toErrorPayload(error));
        }
    }

    public async testConnection(payload: ProviderSettingsPayload): Promise<void> {
        console.log("[Extension] Test AgentRouter connection requested.", {
            baseUrlConfigured: payload.baseUrl.trim().length > 0,
            modelConfigured: payload.model.trim().length > 0
        });

        try {
            await this.aiService.testConnection(this.toConnectionInput(payload));
            await this.postSettingsState("Connection succeeded.");
            this.messageBus.status("ready", "Connection succeeded.");
        } catch (error: unknown) {
            this.messageBus.error(this.toErrorPayload(error));
        }
    }

    public async refreshModels(payload: ProviderSettingsPayload): Promise<void> {
        console.log("[Extension] Ignored model refresh request.", {
            baseUrlConfigured: payload.baseUrl.trim().length > 0
        });
        await this.postSettingsState("Model discovery is not used for this Anthropic integration.");
    }

    public stopGeneration(payload: StopGenerationPayload): void {
        console.log("[Extension] Stop generation requested.", {
            chatId: payload.chatId
        });
        this.messageBus.status("idle", "No generation is currently running.");
    }

    public requestModels(_payload: EmptyPayload): void {
        console.log("[Extension] Ignored models request.");
        this.messageBus.post(ExtensionMessageTypes.MODELS, {
            models: []
        });
    }

    public requestWorkspace(payload: RequestWorkspacePayload): void {
        console.log("[Extension] Workspace requested.", {
            query: payload.query ?? ""
        });
        this.messageBus.post(ExtensionMessageTypes.WORKSPACE_FILES, {
            files: []
        });
    }

    public ping(payload: PingPayload): void {
        console.log("[Extension] Ping received.", {
            sentAt: payload.sentAt
        });
        this.messageBus.post(ExtensionMessageTypes.PONG, {
            receivedAt: Date.now()
        });
    }

    private resolveChatId(candidate: string | null): string {
        if (candidate && candidate.trim().length > 0) {
            this.activeChatId = candidate;
            return candidate;
        }

        if (this.activeChatId) {
            return this.activeChatId;
        }

        const chatId = createMessageId("chat");
        this.activeChatId = chatId;
        this.aiService.createConversation(chatId);
        return chatId;
    }

    private async postSettingsState(status?: string): Promise<void> {
        const state = await this.aiService.getSettingsState();

        this.messageBus.post(ExtensionMessageTypes.SETTINGS_STATE, {
            baseUrl: state.baseUrl,
            model: state.model,
            hasApiKey: state.hasApiKey,
            status
        });
    }

    private toConnectionInput(payload: ProviderSettingsPayload): ProviderConnectionInput {
        return {
            apiKey: payload.apiKey,
            baseUrl: payload.baseUrl,
            model: payload.model
        };
    }

    private toErrorPayload(error: unknown): ErrorPayload {
        if (error instanceof AIProviderError) {
            return {
                code: error.code,
                message: error.message,
                recoverable: error.recoverable
            };
        }

        const message = error instanceof Error
            ? error.message
            : "NexoraCode encountered an unexpected provider error.";

        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("api key") || lowerMessage.includes("unauthorized") || lowerMessage.includes("authentication")) {
            return {
                code: "UNAUTHORIZED",
                message: "AgentRouter authentication failed. Check your API key and try again.",
                recoverable: true
            };
        }

        if (lowerMessage.includes("timeout")) {
            return {
                code: "TIMEOUT",
                message: "AgentRouter took too long to respond. Try again in a moment.",
                recoverable: true
            };
        }

        if (lowerMessage.includes("model")) {
            return {
                code: "UNKNOWN_MODEL",
                message: "The selected model was not accepted by AgentRouter. Use the exact configured model id.",
                recoverable: true
            };
        }

        if (lowerMessage.includes("network") || lowerMessage.includes("connection")) {
            return {
                code: "NETWORK_ERROR",
                message: "NexoraCode could not reach AgentRouter. Check the base URL and network connection.",
                recoverable: true
            };
        }

        return {
            code: "PROVIDER_ERROR",
            message,
            recoverable: true
        };
    }
}
