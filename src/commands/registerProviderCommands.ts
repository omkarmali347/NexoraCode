import * as vscode from "vscode";
import { ProviderConfigurationService } from "../services/ProviderConfigurationService";
import { SecretService } from "../services/SecretService";

export function registerProviderCommands(
    context: vscode.ExtensionContext
): vscode.Disposable[] {
    const secretService = new SecretService(context.secrets);
    const configurationService = new ProviderConfigurationService(secretService);

    const configureProvider = vscode.commands.registerCommand(
        "nexoracode.configureProvider",
        async () => {
            const current = await configurationService.getSettingsState();
            const apiKey = await vscode.window.showInputBox({
                title: "NexoraCode Anthropic Auth Token",
                prompt: current.hasApiKey
                    ? "Enter a new Anthropic Auth Token, or cancel to keep the existing token."
                    : "Enter your Anthropic Auth Token.",
                password: true,
                ignoreFocusOut: true
            });

            const baseUrl = await vscode.window.showInputBox({
                title: "NexoraCode Anthropic Base URL",
                prompt: "Enter the AgentRouter base URL, for example https://agentrouter.org.",
                value: current.baseUrl,
                ignoreFocusOut: true
            });

            if (typeof baseUrl === "undefined") {
                return;
            }

            const model = await vscode.window.showInputBox({
                title: "NexoraCode Anthropic Model",
                prompt: "Enter the exact AgentRouter Claude model id.",
                value: current.model,
                ignoreFocusOut: true
            });

            if (typeof model === "undefined") {
                return;
            }

            await configurationService.saveSettings({
                apiKey,
                baseUrl,
                model
            });
            vscode.window.showInformationMessage("NexoraCode AgentRouter settings saved.");
        }
    );

    return [
        configureProvider
    ];
}
