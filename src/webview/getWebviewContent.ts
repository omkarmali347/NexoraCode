import * as vscode from "vscode";

export function getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri
): string {
    const nonce = getNonce();
    const stylesheetUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "media", "webview", "sidebar.css")
    );
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "media", "webview", "sidebar.js")
    );
    const logoUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "media", "icons", "nexora.png")
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta
        http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"
    >
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${stylesheetUri}">
    <title>NexoraCode Chat</title>
</head>
<body>
    <div class="app-shell">
        <header class="topbar">
            <div class="brand">
                <div class="brand-logo" aria-hidden="true">
                    <img src="${logoUri}" alt="">
                </div>
                <div class="brand-copy">
                    <h1>NexoraCode</h1>
                    <div class="status-line" aria-label="NexoraCode is ready">
                        <span class="status-dot" aria-hidden="true"></span>
                        <span id="statusText">Ready</span>
                    </div>
                </div>
            </div>

            <div class="header-actions">
                <button
                    class="icon-button header-icon-button"
                    id="settingsButton"
                    type="button"
                    aria-label="Open settings"
                    title="Settings"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>

                <button class="new-chat-button" id="newChatButton" type="button">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 5v14M5 12h14"></path>
                    </svg>
                    <span>New Chat</span>
                </button>
            </div>
        </header>

        <main class="chat-main" aria-label="NexoraCode chat">
            <section
                class="messages"
                id="messages"
                role="log"
                aria-live="polite"
                aria-relevant="additions"
            >
                <div class="empty-state" id="emptyState">
                    <div class="empty-mark" aria-hidden="true">
                        <img src="${logoUri}" alt="">
                    </div>
                    <h2>How can NexoraCode help?</h2>
                    <p>Start with a coding task, ask for a review, or describe the file you want to improve.</p>

                    <div class="suggestion-grid" aria-label="Sample prompts">
                        <button
                            class="suggestion-card"
                            type="button"
                            data-prompt="Review the current file and suggest improvements."
                        >
                            <span class="suggestion-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24">
                                    <path d="M9 11l3 3L22 4"></path>
                                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                                </svg>
                            </span>
                            <strong>Review code</strong>
                            <span>Find risks, edge cases, and polish opportunities.</span>
                        </button>

                        <button
                            class="suggestion-card"
                            type="button"
                            data-prompt="Explain how this code works step by step."
                        >
                            <span class="suggestion-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24">
                                    <path d="M8 6h13M8 12h13M8 18h13"></path>
                                    <path d="M3 6h.01M3 12h.01M3 18h.01"></path>
                                </svg>
                            </span>
                            <strong>Explain code</strong>
                            <span>Break down behavior in plain language.</span>
                        </button>

                        <button
                            class="suggestion-card"
                            type="button"
                            data-prompt="Draft a test plan for this feature."
                        >
                            <span class="suggestion-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <path d="M14 2v6h6"></path>
                                    <path d="M9 15l2 2 4-4"></path>
                                </svg>
                            </span>
                            <strong>Plan tests</strong>
                            <span>Cover expected behavior before implementation.</span>
                        </button>
                    </div>
                </div>
            </section>
        </main>

        <form class="composer" id="chatForm">
            <div class="composer-toolbar">
                <button
                    class="icon-button"
                    id="attachButton"
                    type="button"
                    aria-label="Attach context"
                    title="Attach context"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                    </svg>
                </button>

                <label class="model-selector">
                    <span class="sr-only">Model selector placeholder</span>
                    <select aria-label="Model selector placeholder">
                        <option>Nexora Preview</option>
                    </select>
                </label>

                <span class="character-count" id="characterCount">0 / 8000</span>
            </div>

            <div class="input-row">
                <textarea
                    id="messageInput"
                    maxlength="8000"
                    rows="1"
                    placeholder="Ask NexoraCode to review, explain, or draft..."
                    aria-label="Chat message"
                ></textarea>

                <button class="send-button" id="sendButton" type="submit" aria-label="Send message" disabled>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M22 2L11 13"></path>
                        <path d="M22 2l-7 20-4-9-9-4z"></path>
                    </svg>
                </button>
            </div>
        </form>

        <footer class="footer">
            Powered by NexoraCode
        </footer>

        <div class="settings-backdrop" id="settingsPanel" hidden>
            <section
                class="settings-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="settingsTitle"
            >
                <header class="settings-header">
                    <h2 id="settingsTitle">Settings</h2>
                    <button
                        class="icon-button"
                        id="settingsCloseButton"
                        type="button"
                        aria-label="Close settings"
                        title="Close"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M18 6L6 18"></path>
                            <path d="M6 6l12 12"></path>
                        </svg>
                    </button>
                </header>

                <form class="settings-form" id="settingsForm">
                    <label>
                        <span>Anthropic Auth Token</span>
                        <input
                            id="settingsApiKey"
                            type="password"
                            autocomplete="off"
                            placeholder="Enter Anthropic Auth Token"
                            aria-label="Anthropic Auth Token"
                        >
                    </label>

                    <label>
                        <span>Anthropic Base URL</span>
                        <input
                            id="settingsBaseUrl"
                            type="url"
                            placeholder="https://agentrouter.org"
                            aria-label="Anthropic Base URL"
                        >
                    </label>

                    <label>
                        <span>Anthropic Model</span>
                        <input
                            id="settingsModel"
                            autocomplete="off"
                            placeholder="claude-opus-4-6"
                            aria-label="Anthropic Model"
                        >
                    </label>

                    <p class="settings-status" id="settingsStatus" role="status"></p>

                    <div class="settings-actions">
                        <button class="secondary-button" id="settingsCancelButton" type="button">Cancel</button>
                        <button class="secondary-button" id="testConnectionButton" type="button">Test Connection</button>
                        <button class="primary-button" type="submit">Save</button>
                    </div>
                </form>
            </section>
        </div>
    </div>

    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let nonce = "";

    for (let index = 0; index < 32; index++) {
        nonce += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return nonce;
}
