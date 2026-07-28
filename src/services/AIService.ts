import { AnthropicProvider } from "../ai/providers/AnthropicProvider";
import {
    AIRequest,
    AIResponse,
    CompleteProviderConfiguration
} from "../ai/types";
import { ConversationManager } from "./ConversationManager";
import { PromptBuilder } from "./PromptBuilder";
import { ProviderConfigurationService } from "./ProviderConfigurationService";
import { StatusService } from "./StatusService";

const DEFAULT_MAX_TOKENS = 8192;

export interface ProviderConnectionInput {
    readonly apiKey?: string | null;
    readonly baseUrl: string;
    readonly model?: string | null;
}

interface AnthropicProviderCache {
    readonly apiKey: string;
    readonly baseUrl: string;
    readonly provider: AnthropicProvider;
}

export class AIService {
    private providerCache: AnthropicProviderCache | null = null;

    constructor(
        private readonly configurationService: ProviderConfigurationService,
        private readonly conversationManager: ConversationManager,
        private readonly promptBuilder: PromptBuilder,
        private readonly statusService: StatusService
    ) {}

    public createConversation(conversationId: string): void {
        this.conversationManager.createConversation(conversationId);
    }

    public async getSettingsState() {
        return this.configurationService.getSettingsState();
    }

    public async saveSettings(input: ProviderConnectionInput): Promise<void> {
        await this.configurationService.saveSettings({
            apiKey: input.apiKey,
            baseUrl: input.baseUrl,
            model: input.model ?? ""
        });
        this.providerCache = null;
    }

    public async testConnection(input: ProviderConnectionInput): Promise<void> {
        this.statusService.set("authenticating");

        const configuration = await this.resolveTransientConfiguration(input);
        const provider = this.getOrCreateProvider(configuration);
        await provider.validateConnection(configuration.selectedModel);
        this.statusService.set("completed");
    }

    public async sendMessage(request: AIRequest): Promise<AIResponse> {
        this.statusService.set("connecting");

        const configuration = await this.resolveConfiguration();
        const provider = this.getOrCreateProvider(configuration);

        this.statusService.set("sending");
        this.conversationManager.addUserMessage(
            request.conversationId,
            request.userMessage
        );

        const conversation = this.conversationManager.getOrCreateConversation(
            request.conversationId
        );
        const prompt = this.promptBuilder.build(conversation);

        this.statusService.set("generating");
        const response = await provider.complete({
            model: configuration.selectedModel,
            system: prompt.system,
            messages: prompt.messages,
            maxTokens: DEFAULT_MAX_TOKENS
        });

        const assistantMessage = this.conversationManager.addAssistantMessage(
            request.conversationId,
            response.content
        );

        this.statusService.set("completed");

        return {
            conversationId: request.conversationId,
            messageId: assistantMessage.id,
            content: response.content,
            model: response.model
        };
    }

    private async resolveTransientConfiguration(
        input: ProviderConnectionInput
    ): Promise<CompleteProviderConfiguration> {
        const apiKey = await this.configurationService.resolveApiKey(input.apiKey);

        if (!apiKey) {
            throw new Error("Anthropic Auth Token is required.");
        }

        if (!input.baseUrl || input.baseUrl.trim().length === 0) {
            throw new Error("Anthropic Base URL is required.");
        }

        if (!input.model || input.model.trim().length === 0) {
            throw new Error("Anthropic Model is required.");
        }

        return {
            apiKey,
            baseUrl: input.baseUrl.trim(),
            selectedModel: input.model.trim()
        };
    }

    private async resolveConfiguration(): Promise<CompleteProviderConfiguration> {
        const configuration = await this.configurationService.getResolvedConfiguration();

        if (!configuration.apiKey || !configuration.baseUrl || !configuration.selectedModel) {
            throw new Error("Configure Anthropic Auth Token, Base URL, and Model before sending messages.");
        }

        return {
            ...configuration,
            apiKey: configuration.apiKey,
            baseUrl: configuration.baseUrl,
            selectedModel: configuration.selectedModel
        };
    }

    private getOrCreateProvider(
        configuration: Pick<CompleteProviderConfiguration, "apiKey" | "baseUrl">
    ): AnthropicProvider {
        if (
            this.providerCache
            && this.providerCache.apiKey === configuration.apiKey
            && this.providerCache.baseUrl === configuration.baseUrl
        ) {
            return this.providerCache.provider;
        }

        const provider = new AnthropicProvider(
            configuration.apiKey,
            configuration.baseUrl
        );

        this.providerCache = {
            apiKey: configuration.apiKey,
            baseUrl: configuration.baseUrl,
            provider
        };

        return provider;
    }
}
