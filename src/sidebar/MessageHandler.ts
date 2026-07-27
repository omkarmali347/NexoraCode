import { ChatController } from "../controllers/ChatController";
import { MessageBus } from "../messaging/MessageBus";
import { validateWebviewMessage } from "../protocol/messageValidation";
import { WebviewMessageTypes } from "../protocol/messageTypes";

export class MessageHandler {
    constructor(
        private readonly chatController: ChatController,
        private readonly messageBus: MessageBus
    ) {}

    public handle(rawMessage: unknown): void {
        const validation = validateWebviewMessage(rawMessage);

        if (!validation.ok) {
            console.warn("[Webview] Invalid message received.", validation.code);
            this.messageBus.error({
                code: validation.code,
                message: validation.message,
                recoverable: true
            });
            return;
        }

        const message = validation.message;

        console.log("[Webview] Message received.", message.type);

        try {
            switch (message.type) {
                case WebviewMessageTypes.NEW_CHAT:
                    this.chatController.createNewChat(message.payload);
                    return;

                case WebviewMessageTypes.SEND_MESSAGE:
                    this.chatController.receiveMessage(message.payload);
                    return;

                case WebviewMessageTypes.ATTACH:
                    this.chatController.attach(message.payload);
                    return;

                case WebviewMessageTypes.REMOVE_ATTACHMENT:
                    this.chatController.removeAttachment(message.payload);
                    return;

                case WebviewMessageTypes.OPEN_SETTINGS:
                    this.chatController.openSettings(message.payload);
                    return;

                case WebviewMessageTypes.STOP_GENERATION:
                    this.chatController.stopGeneration(message.payload);
                    return;

                case WebviewMessageTypes.REQUEST_MODELS:
                    this.chatController.requestModels(message.payload);
                    return;

                case WebviewMessageTypes.REQUEST_WORKSPACE:
                    this.chatController.requestWorkspace(message.payload);
                    return;

                case WebviewMessageTypes.PING:
                    this.chatController.ping(message.payload);
                    return;
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error
                ? error.message
                : "Unexpected message handling error.";

            console.error("[MessageBus] Message handler failed.", errorMessage);
            this.messageBus.error({
                code: "HANDLER_ERROR",
                message: "NexoraCode could not process that request.",
                recoverable: true
            });
        }
    }
}
