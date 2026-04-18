import { App, Modal, Setting } from 'obsidian';
import { SharePermissionType } from './sharing';

interface ShareAccessModalOptions {
    targetLabel: string;
    fileCount: number;
    currentPermissionType?: SharePermissionType;
    currentRole?: string;
}

export class ShareAccessModal extends Modal {
    private readonly options: ShareAccessModalOptions;
    private permissionType: SharePermissionType;
    private resolver: ((value: SharePermissionType | null) => void) | null = null;
    private resolved = false;

    constructor(app: App, options: ShareAccessModalOptions) {
        super(app);
        this.options = options;
        this.permissionType = options.currentPermissionType || 'private';
    }

    openAndWait(): Promise<SharePermissionType | null> {
        return new Promise((resolve) => {
            this.resolver = resolve;
            this.open();
        });
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Share & Access Control' });
        contentEl.createEl('p', {
            text: this.options.fileCount === 1
                ? `Target: ${this.options.targetLabel}`
                : `Target: ${this.options.targetLabel} | Files: ${this.options.fileCount}`
        });

        if (this.options.currentPermissionType || this.options.currentRole) {
            contentEl.createEl('p', {
                text: `Current access: ${this.options.currentRole || 'unknown'} (${this.options.currentPermissionType || 'private'})`,
                attr: { style: 'color: var(--text-muted);' }
            });
        }

        new Setting(contentEl)
            .setName('Permission')
            .setDesc('Choose the default access level to apply.')
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions({
                        private: 'Private Invite',
                        public_view: 'Public View',
                        public_edit: 'Public Edit'
                    })
                    .setValue(this.permissionType)
                    .onChange((value) => {
                        this.permissionType = value as SharePermissionType;
                    });
            });

        new Setting(contentEl)
            .addButton((button) => {
                button
                    .setButtonText('Apply')
                    .setCta()
                    .onClick(() => {
                        this.resolve(this.permissionType);
                        this.close();
                    });
            })
            .addButton((button) => {
                button
                    .setButtonText('Cancel')
                    .onClick(() => {
                        this.resolve(null);
                        this.close();
                    });
            });
    }

    onClose(): void {
        this.contentEl.empty();
        if (!this.resolved) {
            this.resolve(null);
        }
    }

    private resolve(value: SharePermissionType | null): void {
        if (this.resolved) {
            return;
        }

        this.resolved = true;
        this.resolver?.(value);
        this.resolver = null;
    }
}
