const MAX_CHARACTERS = 4000;

const WebviewMessageTypes = Object.freeze({
    SEND_MESSAGE: "SEND_MESSAGE",
    NEW_CHAT: "NEW_CHAT",
    ATTACH: "ATTACH",
    PING: "PING"
});

const ExtensionMessageTypes = Object.freeze({
    CHAT_CREATED: "CHAT_CREATED",
    MESSAGE_RESPONSE: "MESSAGE_RESPONSE",
    STATUS: "STATUS",
    ERROR: "ERROR",
    MODELS: "MODELS",
    WORKSPACE_FILES: "WORKSPACE_FILES",
    PONG: "PONG"
});

class WebviewApi {
    constructor(api) {
        this.api = api;
    }

    static create() {
        if (typeof acquireVsCodeApi !== "function") {
            console.warn("[Webview] VS Code API is not available.");
            return new WebviewApi(null);
        }

        return new WebviewApi(acquireVsCodeApi());
    }

    post(type, payload) {
        const message = {
            id: createMessageId("webview"),
            type,
            payload,
            timestamp: Date.now()
        };

        if (!this.api) {
            console.warn("[Webview] Message was not posted outside VS Code.", type);
            return;
        }

        console.log("[Webview] Posting message.", type);
        this.api.postMessage(message);
    }
}

class ChatView {
    constructor(elements, webviewApi) {
        this.elements = elements;
        this.webviewApi = webviewApi;
        this.activeChatId = null;
    }

    initialize() {
        this.elements.textarea.addEventListener("input", () => this.updateComposerState());

        this.elements.textarea.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                this.submitMessage();
            }
        });

        this.elements.form.addEventListener("submit", (event) => {
            event.preventDefault();
            this.submitMessage();
        });

        this.elements.newChatButton.addEventListener("click", () => {
            this.webviewApi.post(WebviewMessageTypes.NEW_CHAT, {
                source: "header"
            });
        });

        this.elements.attachButton.addEventListener("click", () => {
            this.webviewApi.post(WebviewMessageTypes.ATTACH, {
                source: "toolbar"
            });
        });

        this.elements.suggestionCards.forEach((card) => {
            card.addEventListener("click", () => {
                this.elements.textarea.value = card.dataset.prompt ?? "";
                this.updateComposerState();
                this.elements.textarea.focus();
            });
        });

        window.addEventListener("message", (event) => {
            this.handleExtensionMessage(event.data);
        });

        this.updateComposerState();
        this.webviewApi.post(WebviewMessageTypes.PING, {
            sentAt: Date.now()
        });
    }

    handleExtensionMessage(message) {
        if (!isRecord(message) || typeof message.type !== "string") {
            console.warn("[Webview] Ignored malformed extension message.");
            return;
        }

        console.log("[Webview] Extension message received.", message.type);

        switch (message.type) {
            case ExtensionMessageTypes.CHAT_CREATED:
                this.handleChatCreated(message.payload);
                return;

            case ExtensionMessageTypes.MESSAGE_RESPONSE:
                this.handleMessageResponse(message.payload);
                return;

            case ExtensionMessageTypes.STATUS:
                this.handleStatus(message.payload);
                return;

            case ExtensionMessageTypes.ERROR:
                this.handleError(message.payload);
                return;

            case ExtensionMessageTypes.MODELS:
            case ExtensionMessageTypes.WORKSPACE_FILES:
            case ExtensionMessageTypes.PONG:
                return;

            default:
                console.warn("[Webview] Unknown extension message type.", message.type);
        }
    }

    submitMessage() {
        const text = this.elements.textarea.value.trim();

        if (!text) {
            return;
        }

        this.hideEmptyState();
        this.addMessage({
            role: "user",
            content: text,
            timestamp: Date.now()
        });

        this.webviewApi.post(WebviewMessageTypes.SEND_MESSAGE, {
            chatId: this.activeChatId,
            content: text,
            attachments: []
        });

        this.elements.textarea.value = "";
        this.updateComposerState();
        this.scrollToLatest();
    }

    handleChatCreated(payload) {
        if (!isRecord(payload) || typeof payload.chatId !== "string") {
            this.addSystemMessage("Unable to start a new chat. Invalid chat response received.");
            return;
        }

        this.activeChatId = payload.chatId;
        this.clearConversation();
        this.showEmptyState();
        this.updateStatus("Ready");
        this.elements.textarea.focus();
    }

    handleMessageResponse(payload) {
        if (!isRecord(payload) || !isRecord(payload.message)) {
            this.addSystemMessage("NexoraCode returned an invalid placeholder response.");
            return;
        }

        const role = normalizeRole(payload.message.role);
        const content = typeof payload.message.content === "string"
            ? payload.message.content
            : "NexoraCode returned an empty response.";
        const timestamp = typeof payload.message.timestamp === "number"
            ? payload.message.timestamp
            : Date.now();

        this.hideEmptyState();
        this.addMessage({
            role,
            content,
            timestamp,
            codeBlock: normalizeCodeBlock(payload.message.codeBlock)
        });
        this.scrollToLatest();
    }

    handleStatus(payload) {
        if (!isRecord(payload) || typeof payload.message !== "string") {
            return;
        }

        this.updateStatus(payload.message);
    }

    handleError(payload) {
        const message = isRecord(payload) && typeof payload.message === "string"
            ? payload.message
            : "NexoraCode encountered a recoverable communication error.";

        this.addSystemMessage(message);
        this.updateStatus("Error");
    }

    addSystemMessage(content) {
        this.hideEmptyState();
        this.addMessage({
            role: "system",
            content,
            timestamp: Date.now()
        });
        this.scrollToLatest();
    }

    addMessage(message) {
        const rendered = this.createMessage(message);
        this.elements.messages.append(rendered);
    }

    createMessage(message) {
        const role = normalizeRole(message.role);
        const article = createElement("article", `message ${role}`);
        const avatar = createElement("div", "avatar", getAvatarText(role));
        const body = createElement("div", "message-body");
        const meta = createElement("div", "message-meta");
        const author = createElement("span", "message-author", getAuthorText(role));
        const timestamp = createElement("span", "message-time", formatTimestamp(message.timestamp));
        const bubble = createElement("div", "bubble");

        article.setAttribute("aria-label", `${author.textContent} message`);
        avatar.setAttribute("aria-hidden", "true");

        meta.append(author, timestamp);
        bubble.append(createElement("p", "", message.content));

        if (message.codeBlock) {
            bubble.append(createCodeBlock(message.codeBlock));
        }

        body.append(meta, bubble);

        if (role === "user") {
            article.append(body, avatar);
        } else {
            article.append(avatar, body);
        }

        return article;
    }

    clearConversation() {
        this.elements.messages.querySelectorAll(".message").forEach((message) => {
            message.remove();
        });
        this.elements.textarea.value = "";
        this.updateComposerState();
    }

    hideEmptyState() {
        this.elements.emptyState.hidden = true;
    }

    showEmptyState() {
        this.elements.emptyState.hidden = false;
    }

    updateStatus(message) {
        this.elements.statusText.textContent = message;
    }

    updateComposerState() {
        const currentLength = this.elements.textarea.value.length;

        this.elements.characterCount.textContent = `${currentLength} / ${MAX_CHARACTERS}`;
        this.elements.sendButton.disabled = this.elements.textarea.value.trim().length === 0;

        this.elements.textarea.style.height = "auto";
        this.elements.textarea.style.height = `${this.elements.textarea.scrollHeight}px`;
    }

    scrollToLatest() {
        requestAnimationFrame(() => {
            this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
        });
    }
}

function getElements() {
    return {
        messages: getRequiredElement("#messages"),
        emptyState: getRequiredElement("#emptyState"),
        form: getRequiredElement("#chatForm"),
        textarea: getRequiredElement("#messageInput"),
        sendButton: getRequiredElement("#sendButton"),
        characterCount: getRequiredElement("#characterCount"),
        newChatButton: getRequiredElement("#newChatButton"),
        attachButton: getRequiredElement("#attachButton"),
        statusText: getRequiredElement("#statusText"),
        suggestionCards: document.querySelectorAll(".suggestion-card")
    };
}

function getRequiredElement(selector) {
    const element = document.querySelector(selector);

    if (!element) {
        throw new Error(`Missing required webview element: ${selector}`);
    }

    return element;
}

function createElement(tagName, className, textContent) {
    const element = document.createElement(tagName);

    if (className) {
        element.className = className;
    }

    if (textContent) {
        element.textContent = textContent;
    }

    return element;
}

function createCodeBlock(codeBlock) {
    const wrapper = createElement("div", "code-block");
    const header = createElement("div", "code-block-header");
    const label = createElement("span", "", codeBlock.fileName);
    const status = createElement("span", "", codeBlock.label);
    const pre = document.createElement("pre");
    const code = document.createElement("code");

    code.textContent = codeBlock.content;

    header.append(label, status);
    pre.append(code);
    wrapper.append(header, pre);

    return wrapper;
}

function normalizeCodeBlock(candidate) {
    if (!isRecord(candidate)) {
        return null;
    }

    return {
        language: typeof candidate.language === "string" ? candidate.language : "text",
        fileName: typeof candidate.fileName === "string" ? candidate.fileName : "preview.txt",
        label: typeof candidate.label === "string" ? candidate.label : "placeholder",
        content: typeof candidate.content === "string" ? candidate.content : ""
    };
}

function normalizeRole(candidate) {
    if (candidate === "user" || candidate === "assistant" || candidate === "system") {
        return candidate;
    }

    return "assistant";
}

function getAuthorText(role) {
    if (role === "user") {
        return "You";
    }

    if (role === "system") {
        return "NexoraCode";
    }

    return "NexoraCode";
}

function getAvatarText(role) {
    if (role === "user") {
        return "U";
    }

    if (role === "system") {
        return "i";
    }

    return "N";
}

function formatTimestamp(timestamp) {
    return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit"
    }).format(new Date(timestamp));
}

function createMessageId(prefix) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 10);

    return `${prefix}_${timestamp}_${random}`;
}

function isRecord(candidate) {
    return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
}

const chatView = new ChatView(getElements(), WebviewApi.create());
chatView.initialize();
