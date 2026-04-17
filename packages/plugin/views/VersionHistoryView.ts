import { ItemView, WorkspaceLeaf, Notice, TFile } from 'obsidian';
import CollaborativePlugin from '../main';
import { request } from 'obsidian';
import { VersionDiffModal } from './VersionDiffModal';

export const VIEW_TYPE_VERSION_HISTORY = 'collaborative-version-history';

interface FileVersion {
    version_number: number;
    created_at: string;
    change_summary: string | null;
    author: string | null;
}

export class VersionHistoryView extends ItemView {
    plugin: CollaborativePlugin;
    activeFile: TFile | null = null;
    versions: FileVersion[] = [];

    constructor(leaf: WorkspaceLeaf, plugin: CollaborativePlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_VERSION_HISTORY;
    }

    getDisplayText(): string {
        return 'Version History';
    }

    getIcon(): string {
        return 'history';
    }

    async setFile(file: TFile | null) {
        this.activeFile = file;
        await this.loadVersions();
        this.render();
    }

    async loadVersions() {
        if (!this.activeFile || !this.plugin.settings.token) {
            this.versions = [];
            return;
        }

        try {
            const remoteFile = await this.plugin.syncManager.ensureRemoteFileRecord(this.activeFile, {
                uploadIfMissing: true
            });
            if (!remoteFile) {
                this.versions = [];
                return;
            }

            const response = await request({
                url: `${this.plugin.settings.apiUrl}/api/files/versions`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.plugin.settings.token}`
                },
                body: JSON.stringify({ fileId: remoteFile.id })
            });
            const data = JSON.parse(response);
            this.versions = data.versions || [];
        } catch (e) {
            console.error('Failed to load versions', e);
            this.versions = [];
        }
    }

    async downloadAndDecryptVersion(versionNumber: number) {
        if (!this.activeFile || !this.plugin.settings.token) return;

        const encryptionReady = await this.plugin.ensureEncryptionReady({
            interactive: true,
            reason: 'Unlock vault encryption to decrypt the restored version.'
        });
        if (!encryptionReady) return;

        try {
            const remoteFile = await this.plugin.syncManager.ensureRemoteFileRecord(this.activeFile, {
                uploadIfMissing: true
            });
            if (!remoteFile) {
                throw new Error('File is not available for version download.');
            }

            const response = await request({
                url: `${this.plugin.settings.apiUrl}/api/files/download-version`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.plugin.settings.token}`
                },
                body: JSON.stringify({ fileId: remoteFile.id, version: versionNumber })
            });

            const data = JSON.parse(response);
            if (data.content) {
                const encrypted = JSON.parse(data.content);
                const decryptedContent = await this.plugin.encryptionService.decrypt(encrypted.data, encrypted.iv);
                return decryptedContent;
            }
        } catch (e) {
            console.error('Download failed', e);
            throw e;
        }
        throw new Error('No content returned');
    }

    async restoreVersion(versionNumber: number) {
        if (!this.activeFile || !this.plugin.settings.token) return;

        try {
            const decryptedContent = await this.downloadAndDecryptVersion(versionNumber);
            if (decryptedContent) {
                await this.plugin.app.vault.modify(this.activeFile, decryptedContent);
                new Notice(`Restored to version ${versionNumber}`);
            }
        } catch (e) {
            new Notice('Failed to restore version');
        }
    }

    async viewDiff(versionNumber: number) {
        if (!this.activeFile || !this.plugin.settings.token) return;

        try {
            const currentContent = await this.plugin.app.vault.read(this.activeFile);
            const decryptedContent = await this.downloadAndDecryptVersion(versionNumber);
            
            if (decryptedContent) {
                new VersionDiffModal(this.plugin.app, decryptedContent, currentContent, versionNumber).open();
            }
        } catch (e) {
            new Notice('Failed to fetch version for diff');
        }
    }

    render() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h4', { text: 'Version History' });

        if (!this.plugin.settings.token) {
            contentEl.createEl('p', { text: 'Please sign in to view history.' });
            return;
        }

        if (!this.activeFile) {
            contentEl.createEl('p', { text: 'No active file.' });
            return;
        }

        contentEl.createEl('p', { text: `File: ${this.activeFile.name}` });

        if (this.versions.length === 0) {
            contentEl.createEl('p', { text: 'No versions found.' });
            return;
        }

        const list = contentEl.createEl('ul', { cls: 'collaborative-version-list' });
        for (const v of this.versions) {
            const li = list.createEl('li', { attr: { style: 'margin-bottom: 15px; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 10px;' } });
            li.createEl('div', { text: `Version: ${v.version_number}`, cls: 'nav-file-title' });
            li.createEl('div', { text: `Date: ${new Date(v.created_at).toLocaleString()}`, cls: 'nav-file-title-content', attr: { style: 'font-size: 0.8em; color: var(--text-muted);' } });
            
            const btnContainer = li.createEl('div', { attr: { style: 'margin-top: 5px;' } });
            
            const restoreBtn = btnContainer.createEl('button', { text: 'Restore' });
            restoreBtn.onClickEvent(() => {
                if (confirm(`Are you sure you want to restore Version ${v.version_number}? This will overwrite your current file.`)) {
                    this.restoreVersion(v.version_number);
                }
            });
            
            const diffBtn = btnContainer.createEl('button', { text: 'View Diff', attr: { style: 'margin-left: 5px;' } });
            diffBtn.onClickEvent(() => {
                this.viewDiff(v.version_number);
            });
        }
    }
}
