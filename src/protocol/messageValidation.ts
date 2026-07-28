import {
    AttachPayload,
    AttachmentReference,
    EmptyPayload,
    NewChatPayload,
    PingPayload,
    ProviderSettingsPayload,
    RemoveAttachmentPayload,
    RequestWorkspacePayload,
    SendMessagePayload,
    StopGenerationPayload,
    WebviewMessageType,
    WebviewMessageTypes,
    WebviewToExtensionMessage
} from "./messageTypes";

export interface ProtocolValidationSuccess {
    readonly ok: true;
    readonly message: WebviewToExtensionMessage;
}

export interface ProtocolValidationFailure {
    readonly ok: false;
    readonly code: string;
    readonly message: string;
}

export type ProtocolValidationResult =
    | ProtocolValidationSuccess
    | ProtocolValidationFailure;

interface MessageRecord {
    readonly id: string;
    readonly type: WebviewMessageType;
    readonly payload: unknown;
    readonly timestamp: number;
}

export function validateWebviewMessage(
    candidate: unknown
): ProtocolValidationResult {
    const envelope = parseEnvelope(candidate);

    if (!envelope.ok) {
        return envelope;
    }

    const message = envelope.message;

    switch (message.type) {
        case WebviewMessageTypes.SEND_MESSAGE:
            return withPayload(message, isSendMessagePayload, "Invalid SEND_MESSAGE payload.");

        case WebviewMessageTypes.NEW_CHAT:
            return withPayload(message, isNewChatPayload, "Invalid NEW_CHAT payload.");

        case WebviewMessageTypes.ATTACH:
            return withPayload(message, isAttachPayload, "Invalid ATTACH payload.");

        case WebviewMessageTypes.REMOVE_ATTACHMENT:
            return withPayload(
                message,
                isRemoveAttachmentPayload,
                "Invalid REMOVE_ATTACHMENT payload."
            );

        case WebviewMessageTypes.OPEN_SETTINGS:
        case WebviewMessageTypes.REQUEST_MODELS:
            return withPayload(message, isEmptyPayload, `Invalid ${message.type} payload.`);

        case WebviewMessageTypes.SAVE_SETTINGS:
        case WebviewMessageTypes.TEST_CONNECTION:
            return withPayload(
                message,
                isProviderSettingsPayload,
                `Invalid ${message.type} payload.`
            );

        case WebviewMessageTypes.STOP_GENERATION:
            return withPayload(
                message,
                isStopGenerationPayload,
                "Invalid STOP_GENERATION payload."
            );

        case WebviewMessageTypes.REQUEST_WORKSPACE:
            return withPayload(
                message,
                isRequestWorkspacePayload,
                "Invalid REQUEST_WORKSPACE payload."
            );

        case WebviewMessageTypes.PING:
            return withPayload(message, isPingPayload, "Invalid PING payload.");
    }
}

function parseEnvelope(candidate: unknown): ProtocolValidationResult | {
    readonly ok: true;
    readonly message: MessageRecord;
} {
    if (!isRecord(candidate)) {
        return invalid("MALFORMED_MESSAGE", "Expected a message object.");
    }

    const id = candidate.id;
    const type = candidate.type;
    const timestamp = candidate.timestamp;

    if (typeof id !== "string" || id.trim().length === 0) {
        return invalid("MALFORMED_MESSAGE", "Message id is required.");
    }

    if (!isWebviewMessageType(type)) {
        return invalid("UNKNOWN_MESSAGE_TYPE", "Unknown webview message type.");
    }

    if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
        return invalid("MALFORMED_MESSAGE", "Message timestamp is invalid.");
    }

    return {
        ok: true,
        message: {
            id,
            type,
            payload: candidate.payload,
            timestamp
        }
    };
}

function withPayload<TPayload>(
    message: MessageRecord,
    guard: (payload: unknown) => payload is TPayload,
    failureMessage: string
): ProtocolValidationResult {
    if (!guard(message.payload)) {
        return invalid("INVALID_PAYLOAD", failureMessage);
    }

    return {
        ok: true,
        message: {
            id: message.id,
            type: message.type,
            payload: message.payload,
            timestamp: message.timestamp
        } as WebviewToExtensionMessage
    };
}

function invalid(code: string, message: string): ProtocolValidationFailure {
    return {
        ok: false,
        code,
        message
    };
}

function isWebviewMessageType(candidate: unknown): candidate is WebviewMessageType {
    return typeof candidate === "string"
        && Object.values(WebviewMessageTypes).includes(candidate as WebviewMessageType);
}

function isSendMessagePayload(candidate: unknown): candidate is SendMessagePayload {
    if (!isRecord(candidate)) {
        return false;
    }

    return isNullableString(candidate.chatId)
        && typeof candidate.content === "string"
        && candidate.content.trim().length > 0
        && Array.isArray(candidate.attachments)
        && candidate.attachments.every(isAttachmentReference);
}

function isNewChatPayload(candidate: unknown): candidate is NewChatPayload {
    return isRecord(candidate)
        && (candidate.source === "header" || candidate.source === "command");
}

function isAttachPayload(candidate: unknown): candidate is AttachPayload {
    return isRecord(candidate)
        && (
            candidate.source === "toolbar"
            || candidate.source === "drop"
            || candidate.source === "paste"
        );
}

function isRemoveAttachmentPayload(candidate: unknown): candidate is RemoveAttachmentPayload {
    return isRecord(candidate)
        && typeof candidate.attachmentId === "string"
        && candidate.attachmentId.trim().length > 0;
}

function isStopGenerationPayload(candidate: unknown): candidate is StopGenerationPayload {
    return isRecord(candidate) && isNullableString(candidate.chatId);
}

function isRequestWorkspacePayload(candidate: unknown): candidate is RequestWorkspacePayload {
    return isRecord(candidate)
        && (
            typeof candidate.query === "undefined"
            || typeof candidate.query === "string"
        );
}

function isPingPayload(candidate: unknown): candidate is PingPayload {
    return isRecord(candidate)
        && typeof candidate.sentAt === "number"
        && Number.isFinite(candidate.sentAt);
}

function isProviderSettingsPayload(candidate: unknown): candidate is ProviderSettingsPayload {
    return isRecord(candidate)
        && optionalStringOrNull(candidate.apiKey)
        && typeof candidate.baseUrl === "string"
        && candidate.baseUrl.trim().length > 0
        && typeof candidate.model === "string";
}

function isEmptyPayload(candidate: unknown): candidate is EmptyPayload {
    return isRecord(candidate);
}

function isAttachmentReference(candidate: unknown): candidate is AttachmentReference {
    if (!isRecord(candidate)) {
        return false;
    }

    return typeof candidate.id === "string"
        && candidate.id.trim().length > 0
        && typeof candidate.name === "string"
        && candidate.name.trim().length > 0
        && optionalString(candidate.uri)
        && optionalString(candidate.mimeType)
        && optionalNumber(candidate.size);
}

function isNullableString(candidate: unknown): candidate is string | null {
    return candidate === null || typeof candidate === "string";
}

function optionalString(candidate: unknown): boolean {
    return typeof candidate === "undefined" || typeof candidate === "string";
}

function optionalStringOrNull(candidate: unknown): boolean {
    return candidate === null || optionalString(candidate);
}

function optionalNumber(candidate: unknown): boolean {
    return typeof candidate === "undefined"
        || (typeof candidate === "number" && Number.isFinite(candidate));
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
    return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
}
