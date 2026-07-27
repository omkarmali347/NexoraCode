import * as vscode from "vscode";
import { ChatController } from "../controllers/ChatController";
import { MessageBus } from "../messaging/MessageBus";
import { getWebviewContent } from "../webview/getWebviewContent";
import { MessageHandler } from "./MessageHandler";

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "nexoracode.sidebar";

    constructor(
        private readonly extensionUri: vscode.Uri
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView
    ): void {

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.extensionUri, "media")
            ]
        };

        webviewView.webview.html = getWebviewContent(
            webviewView.webview,
            this.extensionUri
        );

        const messageBus = new MessageBus(webviewView.webview);
        const chatController = new ChatController(messageBus);
        const messageHandler = new MessageHandler(chatController, messageBus);

        webviewView.webview.onDidReceiveMessage((message: unknown) => {
            messageHandler.handle(message);
        });
    }
}
