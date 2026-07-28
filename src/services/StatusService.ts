import { MessageBus } from "../messaging/MessageBus";
import { StatusLevel } from "../protocol/messageTypes";

export type AIStatus =
    | "connecting"
    | "authenticating"
    | "sending"
    | "generating"
    | "completed"
    | "error";

const STATUS_LABELS: Record<AIStatus, string> = {
    connecting: "Connecting",
    authenticating: "Authenticating",
    sending: "Sending",
    generating: "Generating",
    completed: "Ready",
    error: "Error"
};

const STATUS_LEVELS: Record<AIStatus, StatusLevel> = {
    connecting: "working",
    authenticating: "working",
    sending: "working",
    generating: "working",
    completed: "ready",
    error: "error"
};

export class StatusService {
    constructor(
        private readonly messageBus: MessageBus
    ) {}

    public set(status: AIStatus, detail?: string): void {
        this.messageBus.status(
            STATUS_LEVELS[status],
            detail ?? STATUS_LABELS[status]
        );
    }
}
