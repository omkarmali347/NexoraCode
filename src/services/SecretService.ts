import * as vscode from "vscode";

const ANTHROPIC_AUTH_TOKEN_KEY = "ANTHROPIC_AUTH_TOKEN";
const LEGACY_AGENTROUTER_KEY = "nexoracode.provider.agentrouter.apiKey";
const LEGACY_ANTHROPIC_KEY = "nexoracode.provider.anthropic.apiKey";

export class SecretService {
    constructor(
        private readonly secrets: vscode.SecretStorage
    ) {}

    public async getApiKey(): Promise<string | null> {
        const value = await this.secrets.get(ANTHROPIC_AUTH_TOKEN_KEY);

        if (value) {
            return value;
        }

        const legacyValue = await this.secrets.get(LEGACY_ANTHROPIC_KEY)
            ?? await this.secrets.get(LEGACY_AGENTROUTER_KEY);

        if (legacyValue) {
            await this.storeApiKey(legacyValue);
            return legacyValue;
        }

        return null;
    }

    public async storeApiKey(apiKey: string): Promise<void> {
        await this.secrets.store(ANTHROPIC_AUTH_TOKEN_KEY, apiKey);
    }

    public async deleteApiKey(): Promise<void> {
        await this.secrets.delete(ANTHROPIC_AUTH_TOKEN_KEY);
    }
}
