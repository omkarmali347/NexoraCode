export const WebviewMessageTypes = {
    SEND_MESSAGE: "SEND_MESSAGE",
    NEW_CHAT: "NEW_CHAT",
    ATTACH: "ATTACH",
    REMOVE_ATTACHMENT: "REMOVE_ATTACHMENT",
    OPEN_SETTINGS: "OPEN_SETTINGS",
    SAVE_SETTINGS: "SAVE_SETTINGS",
    TEST_CONNECTION: "TEST_CONNECTION",
    STOP_GENERATION: "STOP_GENERATION",
    REQUEST_MODELS: "REQUEST_MODELS",
    REQUEST_WORKSPACE: "REQUEST_WORKSPACE",
    PING: "PING"
} as const;

export const ExtensionMessageTypes = {
    CHAT_CREATED: "CHAT_CREATED",
    MESSAGE_RECEIVED: "MESSAGE_RECEIVED",
    MESSAGE_RESPONSE: "MESSAGE_RESPONSE",
    STATUS: "STATUS",
    ERROR: "ERROR",
    SETTINGS_STATE: "SETTINGS_STATE",
    MODELS: "MODELS",
    WORKSPACE_FILES: "WORKSPACE_FILES",
    FILE_SELECTED: "FILE_SELECTED",
    STREAM_START: "STREAM_START",
    STREAM_CHUNK: "STREAM_CHUNK",
    STREAM_END: "STREAM_END",
    PONG: "PONG"
} as const;

export type WebviewMessageType =
    typeof WebviewMessageTypes[keyof typeof WebviewMessageTypes];

export type ExtensionMessageType =
    typeof ExtensionMessageTypes[keyof typeof ExtensionMessageTypes];

export type MessageRole = "user" | "assistant" | "system";
export type StatusLevel = "ready" | "working" | "idle" | "warning" | "error";

export interface EmptyPayload {
    readonly kind?: "empty";
}

export interface AttachmentReference {
    readonly id: string;
    readonly name: string;
    readonly uri?: string;
    readonly mimeType?: string;
    readonly size?: number;
}

export interface ChatMessage {
    readonly id: string;
    readonly role: MessageRole;
    readonly content: string;
    readonly timestamp: number;
    readonly codeBlock?: CodeBlockPlaceholder;
}

export interface CodeBlockPlaceholder {
    readonly language: string;
    readonly fileName: string;
    readonly content: string;
    readonly label: string;
}

export interface WorkspaceFile {
    readonly uri: string;
    readonly name: string;
    readonly relativePath: string;
}

export interface ModelDescriptor {
    readonly id: string;
    readonly name: string;
    readonly provider: string;
    readonly isDefault: boolean;
}

export interface SendMessagePayload {
    readonly chatId: string | null;
    readonly content: string;
    readonly attachments: readonly AttachmentReference[];
}

export interface NewChatPayload {
    readonly source: "header" | "command";
}

export interface AttachPayload {
    readonly source: "toolbar" | "drop" | "paste";
}

export interface RemoveAttachmentPayload {
    readonly attachmentId: string;
}

export interface StopGenerationPayload {
    readonly chatId: string | null;
}

export interface RequestWorkspacePayload {
    readonly query?: string;
}

export interface PingPayload {
    readonly sentAt: number;
}

export interface ProviderSettingsPayload {
    readonly apiKey?: string | null;
    readonly baseUrl: string;
    readonly model: string;
}

export interface ChatCreatedPayload {
    readonly chatId: string;
}

export interface MessageReceivedPayload {
    readonly chatId: string;
    readonly messageId: string;
}

export interface MessageResponsePayload {
    readonly chatId: string;
    readonly message: ChatMessage;
}

export interface StatusPayload {
    readonly level: StatusLevel;
    readonly message: string;
}

export interface ErrorPayload {
    readonly code: string;
    readonly message: string;
    readonly recoverable: boolean;
}

export interface SettingsStatePayload {
    readonly baseUrl: string;
    readonly model: string;
    readonly hasApiKey: boolean;
    readonly status?: string;
}

export interface ModelsPayload {
    readonly models: readonly ModelDescriptor[];
}

export interface WorkspaceFilesPayload {
    readonly files: readonly WorkspaceFile[];
}

export interface FileSelectedPayload {
    readonly file: WorkspaceFile;
}

export interface StreamStartPayload {
    readonly chatId: string;
    readonly messageId: string;
}

export interface StreamChunkPayload {
    readonly chatId: string;
    readonly messageId: string;
    readonly delta: string;
}

export interface StreamEndPayload {
    readonly chatId: string;
    readonly messageId: string;
}

export interface PongPayload {
    readonly receivedAt: number;
}

export interface MessageEnvelope<TType extends string, TPayload> {
    readonly id: string;
    readonly type: TType;
    readonly payload: TPayload;
    readonly timestamp: number;
}

export interface WebviewMessagePayloadMap {
    readonly [WebviewMessageTypes.SEND_MESSAGE]: SendMessagePayload;
    readonly [WebviewMessageTypes.NEW_CHAT]: NewChatPayload;
    readonly [WebviewMessageTypes.ATTACH]: AttachPayload;
    readonly [WebviewMessageTypes.REMOVE_ATTACHMENT]: RemoveAttachmentPayload;
    readonly [WebviewMessageTypes.OPEN_SETTINGS]: EmptyPayload;
    readonly [WebviewMessageTypes.SAVE_SETTINGS]: ProviderSettingsPayload;
    readonly [WebviewMessageTypes.TEST_CONNECTION]: ProviderSettingsPayload;
    readonly [WebviewMessageTypes.STOP_GENERATION]: StopGenerationPayload;
    readonly [WebviewMessageTypes.REQUEST_MODELS]: EmptyPayload;
    readonly [WebviewMessageTypes.REQUEST_WORKSPACE]: RequestWorkspacePayload;
    readonly [WebviewMessageTypes.PING]: PingPayload;
}

export interface ExtensionMessagePayloadMap {
    readonly [ExtensionMessageTypes.CHAT_CREATED]: ChatCreatedPayload;
    readonly [ExtensionMessageTypes.MESSAGE_RECEIVED]: MessageReceivedPayload;
    readonly [ExtensionMessageTypes.MESSAGE_RESPONSE]: MessageResponsePayload;
    readonly [ExtensionMessageTypes.STATUS]: StatusPayload;
    readonly [ExtensionMessageTypes.ERROR]: ErrorPayload;
    readonly [ExtensionMessageTypes.SETTINGS_STATE]: SettingsStatePayload;
    readonly [ExtensionMessageTypes.MODELS]: ModelsPayload;
    readonly [ExtensionMessageTypes.WORKSPACE_FILES]: WorkspaceFilesPayload;
    readonly [ExtensionMessageTypes.FILE_SELECTED]: FileSelectedPayload;
    readonly [ExtensionMessageTypes.STREAM_START]: StreamStartPayload;
    readonly [ExtensionMessageTypes.STREAM_CHUNK]: StreamChunkPayload;
    readonly [ExtensionMessageTypes.STREAM_END]: StreamEndPayload;
    readonly [ExtensionMessageTypes.PONG]: PongPayload;
}

export type WebviewToExtensionMessage = {
    readonly [Type in keyof WebviewMessagePayloadMap]: MessageEnvelope<
        Type & WebviewMessageType,
        WebviewMessagePayloadMap[Type]
    >;
}[keyof WebviewMessagePayloadMap];

export type ExtensionToWebviewMessage = {
    readonly [Type in keyof ExtensionMessagePayloadMap]: MessageEnvelope<
        Type & ExtensionMessageType,
        ExtensionMessagePayloadMap[Type]
    >;
}[keyof ExtensionMessagePayloadMap];
