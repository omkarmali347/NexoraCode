import * as vscode from "vscode";
import { SidebarProvider } from "./sidebar/SidebarProvider";

export function activate(context: vscode.ExtensionContext) {

    console.log("NexoraCode extension is now active!");

    // Register Sidebar
    const sidebarProvider = new SidebarProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SidebarProvider.viewType,
            sidebarProvider
        )
    );

    // Hello World Command
    const helloWorld = vscode.commands.registerCommand(
        "nexoracode.helloWorld",
        () => {
            vscode.window.showInformationMessage(
                "Hello World from NexoraCode!"
            );
        }
    );

    // Open Sidebar Command
    const openSidebar = vscode.commands.registerCommand(
        "nexoracode.openSidebar",
        async () => {
            await vscode.commands.executeCommand(
                "workbench.view.extension.nexoracode"
            );
        }
    );

    context.subscriptions.push(
        helloWorld,
        openSidebar
    );
}

export function deactivate() {}