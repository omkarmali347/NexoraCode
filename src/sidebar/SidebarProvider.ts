import * as vscode from "vscode";

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "nexoracode.sidebar";

    constructor(
        private readonly extensionUri: vscode.Uri
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView
    ): void {

        webviewView.webview.options = {
            enableScripts: true
        };

        webviewView.webview.html = this.getHtml();
    }

    private getHtml(): string {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body{
                    font-family:Segoe UI;
                    padding:20px;
                    text-align:center;
                    color:white;
                    background:#1e1e1e;
                }

                h1{
                    color:#4FC3F7;
                }

                button{
                    margin-top:20px;
                    padding:10px 18px;
                    border:none;
                    border-radius:8px;
                    cursor:pointer;
                    background:#007ACC;
                    color:white;
                    font-size:15px;
                }
            </style>
        </head>

        <body>

            <h1>🚀 NexoraCode</h1>

            <h3>Next-generation AI Coding Assistant</h3>

            <p>Welcome!</p>

            <button>New Chat</button>

        </body>

        </html>
        `;
    }
}