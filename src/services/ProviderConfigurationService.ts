import * as vscode from "vscode";
import {
    CompleteProviderConfiguration,
    ProviderSettings,
    ResolvedProviderConfiguration
} from "../ai/types";
import { SecretService } from "./SecretService";

const CONFIG_SECTION = "nexoracode";
const DEFAULT_BASE_URL = "https://agentrouter.org";
const DEFAULT_MODEL = "claude-opus-4-6";
const DEFAULT_SETTINGS: ProviderSettings = {
    baseUrl: DEFAULT_BASE_URL,
    selectedModel: DEFAULT_MODEL
};

export interface SaveProviderSettingsInput {
    readonly apiKey?: string | null;
    readonly baseUrl: string;
    readonly model: string;
}

export interface ProviderSettingsState {
    readonly baseUrl: string;
    readonly model: string;
    readonly hasApiKey: boolean;
}

export class ProviderConfigurationService {
    constructor(
        private readonly secretService: SecretService
    ) {}

    public async getSettingsState(): Promise<ProviderSettingsState> {
        const settings = await this.getSettings();
        const apiKey = await this.secretService.getApiKey();

        return {
            baseUrl: settings.baseUrl ?? DEFAULT_BASE_URL,
            model: settings.selectedModel ?? DEFAULT_MODEL,
            hasApiKey: Boolean(apiKey)
        };
    }

    public async getSettings(): Promise<ProviderSettings> {
        const configuration = vscode.workspace.getConfiguration(CONFIG_SECTION);

        return {
            baseUrl: this.normalizeString(configuration.get("anthropic.baseUrl")) ?? DEFAULT_SETTINGS.baseUrl,
            selectedModel: this.normalizeString(configuration.get("anthropic.model")) ?? DEFAULT_SETTINGS.selectedModel
        };
    }

    public async getResolvedConfiguration(): Promise<ResolvedProviderConfiguration> {
        const settings = await this.getSettings();
        const apiKey = await this.secretService.getApiKey();

        return {
            ...settings,
            apiKey
        };
    }

    public async getCompleteConfiguration(): Promise<CompleteProviderConfiguration> {
        const configuration = await this.getConnectionConfiguration();

        if (!configuration.selectedModel) {
            throw new Error("AgentRouter model is not configured.");
        }

        return {
            ...configuration,
            selectedModel: configuration.selectedModel
        };
    }

    public async getConnectionConfiguration(): Promise<CompleteProviderConfiguration> {
        const configuration = await this.getResolvedConfiguration();

        if (!configuration.apiKey) {
            throw new Error("AgentRouter API key is not configured.");
        }

        if (!configuration.baseUrl) {
            throw new Error("AgentRouter base URL is not configured.");
        }

        if (!configuration.selectedModel) {
            throw new Error("AgentRouter model is not configured.");
        }

        return {
            ...configuration,
            apiKey: configuration.apiKey,
            baseUrl: configuration.baseUrl,
            selectedModel: configuration.selectedModel
        };
    }

    public async saveSettings(input: SaveProviderSettingsInput): Promise<ProviderSettingsState> {
        const apiKey = await this.resolveApiKey(input.apiKey);

        if (!apiKey) {
            throw new Error("AgentRouter API key is required.");
        }

        if (input.baseUrl.trim().length === 0) {
            throw new Error("AgentRouter base URL is required.");
        }

        if (input.model.trim().length === 0) {
            throw new Error("AgentRouter model is required.");
        }

        if (input.apiKey && input.apiKey.trim().length > 0) {
            await this.secretService.storeApiKey(input.apiKey.trim());
        }

        const configuration = vscode.workspace.getConfiguration(CONFIG_SECTION);

        await configuration.update(
            "anthropic.baseUrl",
            input.baseUrl.trim(),
            vscode.ConfigurationTarget.Global
        );
        await configuration.update(
            "anthropic.model",
            input.model.trim(),
            vscode.ConfigurationTarget.Global
        );

        return this.getSettingsState();
    }

    public async updateSelectedModel(model: string): Promise<void> {
        const configuration = vscode.workspace.getConfiguration(CONFIG_SECTION);

        await configuration.update(
            "anthropic.model",
            model.trim(),
            vscode.ConfigurationTarget.Global
        );
    }

    public async resolveApiKey(apiKey?: string | null): Promise<string | null> {
        if (apiKey && apiKey.trim().length > 0) {
            return apiKey.trim();
        }

        return this.secretService.getApiKey();
    }

    private normalizeString(candidate: unknown): string | null {
        if (typeof candidate !== "string") {
            return null;
        }

        const trimmed = candidate.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
}
