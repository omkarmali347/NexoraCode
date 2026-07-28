import * as vscode from "vscode";
import { ChatController } from "../controllers/ChatController";
import { MessageBus } from "../messaging/MessageBus";
import { AIService } from "../services/AIService";
import { ConversationManager } from "../services/ConversationManager";
import { PromptBuilder } from "../services/PromptBuilder";
import { ProviderConfigurationService } from "../services/ProviderConfigurationService";
import { SecretService } from "../services/SecretService";
import { StatusService } from "../services/StatusService";
import { getWebviewContent } from "../webview/getWebviewContent";
import { MessageHandler } from "./MessageHandler";

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "nexoracode.sidebar";

    constructor(
        private readonly context: vscode.ExtensionContext
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView
    ): void {

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, "media")
            ]
        };

        webviewView.webview.html = getWebviewContent(
            webviewView.webview,
            this.context.extensionUri
        );

        const messageBus = new MessageBus(webviewView.webview);
        const statusService = new StatusService(messageBus);
        const secretService = new SecretService(this.context.secrets);
        const configurationService = new ProviderConfigurationService(
            secretService
        );
        const aiService = new AIService(
            configurationService,
            new ConversationManager(),
            new PromptBuilder(),
            statusService
        );
        const chatController = new ChatController(messageBus, aiService);
        const messageHandler = new MessageHandler(chatController, messageBus);

        webviewView.webview.onDidReceiveMessage((message: unknown) => {
            void messageHandler.handle(message);
        });
    }
}
