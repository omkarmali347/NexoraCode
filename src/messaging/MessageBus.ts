import * as vscode from "vscode";
import {
    ErrorPayload,
    ExtensionMessagePayloadMap,
    ExtensionMessageType,
    ExtensionMessageTypes,
    ExtensionToWebviewMessage,
    MessageEnvelope,
    StatusLevel
} from "../protocol/messageTypes";

export class MessageBus {
    constructor(
        private readonly webview: vscode.Webview
    ) {}

    public post<Type extends keyof ExtensionMessagePayloadMap>(
        type: Type & ExtensionMessageType,
        payload: ExtensionMessagePayloadMap[Type]
    ): void {
        const message: MessageEnvelope<Type & ExtensionMessageType, ExtensionMessagePayloadMap[Type]> = {
            id: createMessageId("extension"),
            type,
            payload,
            timestamp: Date.now()
        };

        void this.webview.postMessage(message as ExtensionToWebviewMessage).then((delivered) => {
            if (!delivered) {
                console.warn("[MessageBus] Webview message was not delivered.", type);
            }
        });
    }

    public status(level: StatusLevel, message: string): void {
        this.post(ExtensionMessageTypes.STATUS, {
            level,
            message
        });
    }

    public error(error: ErrorPayload): void {
        this.post(ExtensionMessageTypes.ERROR, error);
    }
}

export function createMessageId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 10);

    return `${prefix}_${timestamp}_${random}`;
}
