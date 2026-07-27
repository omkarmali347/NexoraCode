import {
    AttachPayload,
    EmptyPayload,
    ExtensionMessageTypes,
    NewChatPayload,
    PingPayload,
    RemoveAttachmentPayload,
    RequestWorkspacePayload,
    SendMessagePayload,
    StopGenerationPayload
} from "../protocol/messageTypes";
import { createMessageId, MessageBus } from "../messaging/MessageBus";

const PHASE_TWO_RESPONSE =
    "Phase 2 communication successful. AI integration will be implemented in Phase 3.";

const ATTACHMENT_PLACEHOLDER =
    "Attachment service will be implemented in Phase 4.";

export class ChatController {
    private activeChatId: string | null = null;

    constructor(
        private readonly messageBus: MessageBus
    ) {}

    public createNewChat(payload: NewChatPayload): void {
        const chatId = createMessageId("chat");
        this.activeChatId = chatId;

        console.log("[Extension] New chat requested.", {
            chatId,
            source: payload.source
        });

        this.messageBus.post(ExtensionMessageTypes.CHAT_CREATED, {
            chatId
        });
        this.messageBus.status("ready", "New chat ready.");
    }

    public receiveMessage(payload: SendMessagePayload): void {
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
        this.messageBus.post(ExtensionMessageTypes.MESSAGE_RESPONSE, {
            chatId,
            message: {
                id: createMessageId("assistant"),
                role: "assistant",
                content: PHASE_TWO_RESPONSE,
                timestamp: Date.now(),
                codeBlock: {
                    language: "ts",
                    fileName: "phase-2.ts",
                    label: "placeholder",
                    content: "// Extension messaging is connected. AI arrives in Phase 3."
                }
            }
        });
        this.messageBus.status("ready", "Ready");
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

    public openSettings(_payload: EmptyPayload): void {
        console.log("[Extension] Open settings requested.");
        this.messageBus.status("warning", "Settings will be implemented in a future phase.");
    }

    public stopGeneration(payload: StopGenerationPayload): void {
        console.log("[Extension] Stop generation requested.", {
            chatId: payload.chatId
        });
        this.messageBus.status("idle", "No generation is currently running.");
    }

    public requestModels(_payload: EmptyPayload): void {
        console.log("[Extension] Models requested.");
        this.messageBus.post(ExtensionMessageTypes.MODELS, {
            models: [
                {
                    id: "nexora-preview",
                    name: "Nexora Preview",
                    provider: "NexoraCode",
                    isDefault: true
                }
            ]
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
        return chatId;
    }
}
