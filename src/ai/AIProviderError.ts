export type AIProviderErrorCode =
    | "INVALID_API_KEY"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "TIMEOUT"
    | "NETWORK_ERROR"
    | "RATE_LIMIT"
    | "UNKNOWN_MODEL"
    | "INVALID_ENDPOINT"
    | "VALIDATION_ERROR"
    | "MALFORMED_RESPONSE"
    | "EMPTY_RESPONSE"
    | "PROVIDER_UNAVAILABLE"
    | "UNEXPECTED_RESPONSE";

export class AIProviderError extends Error {
    constructor(
        public readonly code: AIProviderErrorCode,
        message: string,
        public readonly recoverable = true
    ) {
        super(message);
        this.name = "AIProviderError";
    }
}
