import Anthropic, {
    APIConnectionError,
    APIConnectionTimeoutError,
    APIError,
    AuthenticationError,
    BadRequestError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError
} from "@anthropic-ai/sdk";
import { AIProviderError } from "../AIProviderError";
import {
    IAIProvider,
    ProviderCompletionRequest,
    ProviderCompletionResponse,
    ProviderPromptMessage
} from "../types";

type ProviderOperation = "validateConnection" | "complete";
const MAX_TOKEN_FALLBACKS = [4096, 2048, 1024] as const;

const PYTHON_COMPATIBLE_HEADERS = {
    "User-Agent": "Anthropic/Python 0.120.0",
    "X-Stainless-Lang": "python",
    "X-Stainless-Package-Version": "0.120.0",
    "X-Stainless-OS": "Windows",
    "X-Stainless-Arch": "other:amd64",
    "X-Stainless-Runtime": "CPython",
    "X-Stainless-Runtime-Version": "3.11.0",
    "X-Stainless-Async": "false"
} as const;

interface ParsedAnthropicMessage {
    readonly content: string;
    readonly model: string | null;
}

export class AnthropicProvider implements IAIProvider {
    private readonly client: Anthropic;
    private readonly bearerClient: Anthropic;

    constructor(
        apiKey: string,
        baseUrl: string
    ) {
        validateClientConfiguration(apiKey, baseUrl, "Anthropic-compatible");

        this.client = new Anthropic({
            apiKey: apiKey.trim(),
            baseURL: baseUrl.trim(),
            defaultHeaders: PYTHON_COMPATIBLE_HEADERS
        });
        this.bearerClient = new Anthropic({
            apiKey: null,
            authToken: apiKey.trim(),
            baseURL: baseUrl.trim(),
            defaultHeaders: PYTHON_COMPATIBLE_HEADERS
        });
    }

    public async validateConnection(model: string): Promise<void> {
        try {
            await this.complete({
                model,
                system: "",
                messages: [
                    {
                        role: "user",
                        content: "Explain the difference between a list and a tuple in Python."
                    }
                ],
                maxTokens: 100
            });
        } catch (error: unknown) {
            if (error instanceof AIProviderError) {
                throw error;
            }

            throw this.normalizeError(error, "validateConnection");
        }
    }

    public async complete(
        request: ProviderCompletionRequest
    ): Promise<ProviderCompletionResponse> {
        validateCompletionRequest(request, "Anthropic-compatible");

        try {
            const response = await this.createMessage(this.client, request);
            const parsed = this.parseMessageResponse(response);

            return {
                content: parsed.content,
                model: parsed.model ?? request.model
            };
        } catch (error: unknown) {
            if (error instanceof AIProviderError) {
                throw error;
            }

            if (error instanceof AuthenticationError) {
                return this.retryWithBearerAuth(request, error);
            }

            const retriedResponse = await this.retryWithLowerMaxTokens(
                this.client,
                request,
                error
            );

            if (retriedResponse) {
                return retriedResponse;
            }

            throw this.normalizeError(error, "complete");
        }
    }

    private async retryWithBearerAuth(
        request: ProviderCompletionRequest,
        originalError: AuthenticationError
    ): Promise<ProviderCompletionResponse> {
        try {
            const response = await this.createMessage(this.bearerClient, request);
            const parsed = this.parseMessageResponse(response);

            return {
                content: parsed.content,
                model: parsed.model ?? request.model
            };
        } catch (retryError: unknown) {
            if (retryError instanceof AIProviderError) {
                throw retryError;
            }

            const retriedResponse = await this.retryWithLowerMaxTokens(
                this.bearerClient,
                request,
                retryError
            );

            if (retriedResponse) {
                return retriedResponse;
            }

            throw this.normalizeError(
                retryError instanceof AuthenticationError ? retryError : originalError,
                "complete"
            );
        }
    }

    private async createMessage(
        client: Anthropic,
        request: ProviderCompletionRequest
    ): Promise<unknown> {
        return client.messages.create({
            model: request.model,
            messages: this.toAnthropicMessages(request.messages),
            max_tokens: request.maxTokens
        });
    }

    private async retryWithLowerMaxTokens(
        client: Anthropic,
        request: ProviderCompletionRequest,
        error: unknown
    ): Promise<ProviderCompletionResponse | null> {
        if (!shouldRetryWithLowerMaxTokens(error)) {
            return null;
        }

        let lastError: unknown = error;

        for (const fallback of MAX_TOKEN_FALLBACKS) {
            if (fallback >= request.maxTokens) {
                continue;
            }

            try {
                const response = await this.createMessage(client, {
                    ...request,
                    maxTokens: fallback
                });
                const parsed = this.parseMessageResponse(response);

                return {
                    content: parsed.content,
                    model: parsed.model ?? request.model
                };
            } catch (retryError: unknown) {
                lastError = retryError;

                if (!shouldRetryWithLowerMaxTokens(retryError)) {
                    throw this.normalizeError(retryError, "complete");
                }
            }
        }

        throw this.normalizeError(lastError, "complete");
    }

    private toAnthropicMessages(
        messages: readonly ProviderPromptMessage[]
    ): Array<{ readonly role: "user" | "assistant"; readonly content: string }> {
        return messages
            .map((message) => ({
                role: message.role,
                content: message.content.trim()
            }))
            .filter((message) => message.content.length > 0);
    }

    private parseMessageResponse(response: unknown): ParsedAnthropicMessage {
        if (typeof response === "string") {
            const content = extractTextFromString(response);

            if (content) {
                return {
                    content,
                    model: null
                };
            }
        }

        if (!isRecord(response)) {
            throw new AIProviderError(
                "MALFORMED_RESPONSE",
                `The provider returned an invalid chat response: ${describeResponseShape(response)}.`
            );
        }

        const providerError = extractProviderError(response);

        if (providerError) {
            throw providerError;
        }

        const content = extractAssistantText(response);

        if (content.length === 0) {
            throw new AIProviderError(
                "EMPTY_RESPONSE",
                `The provider returned a response without assistant text: ${describeResponseShape(response)}.`
            );
        }

        return {
            content,
            model: typeof response.model === "string" ? response.model : null
        };
    }

    private normalizeError(error: unknown, operation: ProviderOperation): AIProviderError {
        if (error instanceof AuthenticationError) {
            const detail = getApiErrorDetail(error);

            return new AIProviderError(
                "UNAUTHORIZED",
                detail
                    ? `AgentRouter returned 401: ${detail}`
                    : "AgentRouter returned 401 for both Anthropic API-key and Bearer authentication. Verify the exact key, base URL, and model used by the working Python script."
            );
        }

        if (error instanceof PermissionDeniedError) {
            return new AIProviderError(
                "FORBIDDEN",
                "The API key does not have permission for this request."
            );
        }

        if (error instanceof RateLimitError) {
            return new AIProviderError(
                "RATE_LIMIT",
                "Provider rate limit reached. Wait a moment and try again."
            );
        }

        if (error instanceof NotFoundError) {
            return normalizeNotFound(error, operation);
        }

        if (error instanceof BadRequestError) {
            return normalizeBadRequest(error);
        }

        if (error instanceof APIConnectionTimeoutError) {
            return new AIProviderError(
                "TIMEOUT",
                "The provider took too long to respond. Try again in a moment."
            );
        }

        if (error instanceof APIConnectionError) {
            return new AIProviderError(
                "NETWORK_ERROR",
                "NexoraCode could not reach the provider. Check the base URL and network connection."
            );
        }

        if (error instanceof APIError && error.status === 404) {
            return normalizeNotFound(error, operation);
        }

        if (error instanceof APIError && error.status >= 500) {
            const detail = getApiErrorDetail(error);

            return new AIProviderError(
                "PROVIDER_UNAVAILABLE",
                detail
                    ? `AgentRouter returned ${error.status}: ${detail}`
                    : "The provider is temporarily unavailable. Try again shortly."
            );
        }

        if (error instanceof APIError) {
            const detail = getApiErrorDetail(error);

            return new AIProviderError(
                "UNEXPECTED_RESPONSE",
                detail
                    ? `AgentRouter returned ${error.status}: ${detail}`
                    : `AgentRouter returned ${error.status ?? "an"} error.`
            );
        }

        if (error instanceof Error && error.message.trim().length > 0) {
            return new AIProviderError(
                "UNEXPECTED_RESPONSE",
                `Provider request failed: ${error.message}`
            );
        }

        return new AIProviderError(
            "UNEXPECTED_RESPONSE",
            "The provider returned an unexpected error."
        );
    }
}

export function isRecord(candidate: unknown): candidate is Record<string, unknown> {
    return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
}

export function validateClientConfiguration(
    apiKey: string,
    baseUrl: string,
    providerLabel: string
): void {
    if (apiKey.trim().length === 0) {
        throw new AIProviderError(
            "VALIDATION_ERROR",
            `${providerLabel} API key is required.`
        );
    }

    if (baseUrl.trim().length === 0) {
        throw new AIProviderError(
            "VALIDATION_ERROR",
            `${providerLabel} base URL is required.`
        );
    }
}

export function validateCompletionRequest(
    request: ProviderCompletionRequest,
    providerLabel: string
): void {
    if (request.model.trim().length === 0) {
        throw new AIProviderError(
            "VALIDATION_ERROR",
            `${providerLabel} model is required before sending a message.`
        );
    }

    const hasPrompt = request.messages.some((message) => (
        message.role === "user" && message.content.trim().length > 0
    ));

    if (!hasPrompt) {
        throw new AIProviderError(
            "VALIDATION_ERROR",
            "Enter a message before sending a chat request."
        );
    }
}

function extractTextFromContentBlock(block: unknown): string | null {
    if (typeof block === "string") {
        return extractTextFromString(block);
    }

    if (!isRecord(block)) {
        return null;
    }

    if (block.type === "text" && typeof block.text === "string") {
        return extractTextFromString(block.text);
    }

    if (typeof block.text === "string") {
        return extractTextFromString(block.text);
    }

    if (typeof block.content === "string") {
        return extractTextFromString(block.content);
    }

    return null;
}

function extractAssistantText(response: Record<string, unknown>): string {
    if (Array.isArray(response.content)) {
        return response.content
            .map(extractTextFromContentBlock)
            .filter((text): text is string => text !== null)
            .join("\n")
            .trim();
    }

    if (typeof response.content === "string") {
        return extractTextFromString(response.content) ?? "";
    }

    if (typeof response.completion === "string") {
        return extractTextFromString(response.completion) ?? "";
    }

    if (typeof response.output === "string") {
        return extractTextFromString(response.output) ?? "";
    }

    if (typeof response.response === "string") {
        return extractTextFromString(response.response) ?? "";
    }

    if (Array.isArray(response.choices)) {
        return response.choices
            .map(extractTextFromChoice)
            .filter((text): text is string => text !== null)
            .join("\n")
            .trim();
    }

    return "";
}

function extractTextFromChoice(choice: unknown): string | null {
    if (!isRecord(choice)) {
        return null;
    }

    if (typeof choice.text === "string") {
        return extractTextFromString(choice.text);
    }

    if (isRecord(choice.message) && typeof choice.message.content === "string") {
        return extractTextFromString(choice.message.content);
    }

    if (isRecord(choice.delta) && typeof choice.delta.content === "string") {
        return extractTextFromString(choice.delta.content);
    }

    return null;
}

function extractTextFromString(value: string): string | null {
    const text = normalizeText(value);

    if (!text) {
        return null;
    }

    const parsed = parseJsonEnvelope(text);

    if (parsed === null) {
        return text;
    }

    if (Array.isArray(parsed)) {
        const nested = parsed
            .map(extractTextFromContentBlock)
            .filter((item): item is string => item !== null)
            .join("\n")
            .trim();

        return nested.length > 0 ? nested : text;
    }

    if (isRecord(parsed)) {
        const providerError = extractProviderError(parsed);

        if (providerError) {
            throw providerError;
        }

        const nested = extractAssistantText(parsed);
        return nested.length > 0 ? nested : text;
    }

    return text;
}

function parseJsonEnvelope(text: string): unknown | null {
    if (!text.startsWith("{") && !text.startsWith("[")) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function extractProviderError(response: Record<string, unknown>): AIProviderError | null {
    const error = response.error;

    if (typeof error === "string") {
        return createProviderBodyError(error);
    }

    if (isRecord(error)) {
        const message = typeof error.message === "string"
            ? error.message
            : JSON.stringify(error);

        return createProviderBodyError(message);
    }

    if (typeof response.message === "string" && typeof response.type === "string" && response.type.includes("error")) {
        return createProviderBodyError(response.message);
    }

    return null;
}

function createProviderBodyError(message: string): AIProviderError {
    const normalized = message.toLowerCase();

    if (normalized.includes("model")) {
        return new AIProviderError("UNKNOWN_MODEL", message);
    }

    if (normalized.includes("auth") || normalized.includes("unauthorized") || normalized.includes("api key")) {
        return new AIProviderError("UNAUTHORIZED", message);
    }

    return new AIProviderError("UNEXPECTED_RESPONSE", message);
}

function describeResponseShape(response: unknown): string {
    if (response === null) {
        return "null";
    }

    if (typeof response !== "object") {
        return typeof response;
    }

    if (Array.isArray(response)) {
        return `array(length=${response.length})`;
    }

    const keys = Object.keys(response).slice(0, 8);
    return keys.length > 0 ? `object keys [${keys.join(", ")}]` : "empty object";
}

function normalizeText(value: string): string | null {
    const text = value.trim();
    return text.length > 0 ? text : null;
}

function getApiErrorDetail(error: APIError): string | null {
    const body = error.error;

    if (isRecord(body)) {
        const nestedError = body.error;

        if (isRecord(nestedError) && typeof nestedError.message === "string") {
            return nestedError.message;
        }

        if (typeof body.message === "string") {
            return body.message;
        }
    }

    return error.message || null;
}

function shouldRetryWithLowerMaxTokens(error: unknown): boolean {
    if (!(error instanceof APIError)) {
        return false;
    }

    if (
        error.status !== 400
        && error.status !== 413
        && error.status !== 422
        && error.status !== 500
    ) {
        return false;
    }

    const detail = getApiErrorDetail(error)?.toLowerCase() ?? "";

    return detail.includes("max_tokens")
        || detail.includes("max tokens")
        || detail.includes("output")
        || detail.includes("token");
}

function normalizeNotFound(
    error: NotFoundError | APIError<404, Headers>,
    operation: ProviderOperation
): AIProviderError {
    const message = error.message.toLowerCase();

        if (message.includes("model")) {
            return new AIProviderError(
                "UNKNOWN_MODEL",
            "The provider could not find the selected model. Use the exact configured model id."
        );
    }

    return new AIProviderError(
        "INVALID_ENDPOINT",
        "The chat endpoint was not found. Check the AgentRouter base URL."
    );
}

function normalizeBadRequest(error: BadRequestError): AIProviderError {
    const detail = getApiErrorDetail(error);
    const message = `${error.message} ${detail ?? ""}`.toLowerCase();

    if (message.includes("model")) {
        return new AIProviderError(
            "UNKNOWN_MODEL",
            detail ?? "The selected model was not accepted. Use the exact provider model id."
        );
    }

    if (
        message.includes("max_tokens")
        || message.includes("max tokens")
        || message.includes("token")
        || message.includes("output")
    ) {
        return new AIProviderError(
            "VALIDATION_ERROR",
            detail ?? "The selected output token limit was not accepted by AgentRouter."
        );
    }

    if (message.includes("url") || message.includes("endpoint") || message.includes("not found")) {
        return new AIProviderError(
            "INVALID_ENDPOINT",
            detail ?? "The provider rejected the endpoint. Check the AgentRouter base URL."
        );
    }

    return new AIProviderError(
        "UNEXPECTED_RESPONSE",
        detail ?? "The provider rejected the chat request. Check the base URL and model, then try again."
    );
}
