import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import CollaborativePlugin from "../main";

export const VIEW_TYPE_SHARED_NOTES = "shared-notes-view";

export class SharedNotesView extends ItemView {
    plugin: CollaborativePlugin;

    constructor(leaf: WorkspaceLeaf, plugin: CollaborativePlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_SHARED_NOTES;
    }

    getDisplayText() {
        return "Shared Notes";
    }

    getIcon() {
        return "users";
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl("h4", { text: "Shared with Me" });

        if (!this.plugin.settings.token) {
            container.createEl("p", { text: "Please login to view shared notes." });
            return;
        }

        const list = container.createEl("ul");

        try {
            const notes = await this.plugin.sharingService.listSharedFiles();
            if (notes.length === 0) {
                container.createEl("p", { text: "No shared notes found yet." });
            } else {
                notes.forEach(note => {
                    const item = list.createEl("li");
                    item.createEl("a", { text: `${note.path} (${note.role})`, href: "#" })
                        .onClickEvent(async () => {
                            const file = this.plugin.app.vault.getAbstractFileByPath(note.path);
                            if (file) {
                                await this.plugin.app.workspace.getLeaf().openFile(file as any);
                            } else {
                                new Notice(`File ${note.path} not found locally.`);
                            }
                        });
                });
            }
        } catch (error: any) {
            console.error(error);
            container.createEl("p", { text: "Failed to load shared notes." });
        }

        // Add a refresh button
        const btnContainer = container.createEl("div");
        btnContainer.createEl("button", { text: "Refresh" })
            .addEventListener("click", () => {
                new Notice("Refreshed shared notes list");
                this.onOpen();
            });
    }

    async onClose() {
        // Cleanup
    }
}
