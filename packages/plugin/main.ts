import { Notice, Plugin, TAbstractFile, TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import { CollaborativeSettingsTab } from './settings';
import { CollaborativeSettings } from './types';
import { CollaborationManager } from './collaboration';
import { SyncManager } from './sync';
import { EncryptionService } from './encryption';
import { BackupService } from './backup';
import { SharePermissionType, SharingService } from './sharing';
import { SharedNotesView, VIEW_TYPE_SHARED_NOTES } from './views/SharedNotesView';
import { VersionHistoryView, VIEW_TYPE_VERSION_HISTORY } from './views/VersionHistoryView';
import { EncryptionPassphraseModal } from './EncryptionPassphraseModal';
import { SearchManager } from './search';
import { SmartSearchModal } from './SmartSearchModal';
import { ShareAccessModal } from './ShareAccessModal';

const DEFAULT_SETTINGS: CollaborativeSettings = {
    apiUrl: 'http://localhost:3008',
    token: '',
    user: null,
    syncFolders: [], // Empty means all
    syncExcludedFolders: [],
    syncFrequency: 'realtime',
    syncPaused: false,
    backupFrequency: 'realtime',
    fullVaultBackupEnabled: false,
    backupAllowedFrequencies: ['manual', 'daily'],
    planAllowsFullVaultBackup: false,
    planManagementUrl: '',
    encryptionSalt: '',
    encryptionUserId: '',
    encryptionVerifier: null,
    syncStateUserId: '',
    syncState: {},
    searchIndexBuiltAt: 0,
    searchIndex: {}
};

const ENCRYPTION_VERIFIER_TEXT = 'obsidian-collaborative-key-check';
const LEGACY_PLAN_MANAGEMENT_URL = 'https://obsidian-collaborative.com/account/plans';

interface SharedFileState {
    permissionType: SharePermissionType;
    role: string;
}

export default class CollaborativePlugin extends Plugin {
    settings: CollaborativeSettings;
    settingsTab: CollaborativeSettingsTab;
    collaborationManager: CollaborationManager;
    syncManager: SyncManager;
    encryptionService: EncryptionService;
    backupService: BackupService;
    sharingService: SharingService;
    searchManager: SearchManager;
    private shareStatusEl: HTMLElement;
    private syncStatusEl: HTMLElement;
    private sharedFileIndex = new Map<string, SharedFileState>();
    private encryptionPromptPromise: Promise<boolean> | null = null;
    private encryptionLockedNoticeShown = false;
    private syncStatusMessage = 'idle';

    async onload() {
        await this.loadSettings();

        this.collaborationManager = new CollaborationManager(this);
        this.encryptionService = new EncryptionService();
        this.syncManager = new SyncManager(this, this.encryptionService);
        this.backupService = new BackupService(this, this.encryptionService);
        this.sharingService = new SharingService(this);
        this.searchManager = new SearchManager(this);
        this.shareStatusEl = this.addStatusBarItem();
        this.syncStatusEl = this.addStatusBarItem();
        this.shareStatusEl.setText('Share: sign in');
        this.syncStatusEl.setText(`Sync: ${this.settings.syncPaused ? 'paused' : 'idle'}`);

        this.registerView(
            VIEW_TYPE_SHARED_NOTES,
            (leaf) => new SharedNotesView(leaf, this)
        );

        this.registerView(
            VIEW_TYPE_VERSION_HISTORY,
            (leaf) => new VersionHistoryView(leaf, this)
        );

        // Add Ribbon Icon for Shared Notes
        this.addRibbonIcon('users', 'Shared Notes', () => {
            this.activateSharedNotesView();
        });

        // Add Ribbon Icon for Version History
        this.addRibbonIcon('history', 'Version History', () => {
            this.activateVersionHistoryView();
        });

        this.addRibbonIcon('search', 'Smart Search', () => {
            void this.openSmartSearchModal();
        });

        this.settingsTab = new CollaborativeSettingsTab(this.app, this);
        this.addSettingTab(this.settingsTab);

        // Add command to test login status
        this.addCommand({
            id: 'check-auth-status',
            name: 'Check Authentication Status',
            callback: () => {
                if (this.settings.token) {
                    console.log('Logged in as:', this.settings.user?.email);
                } else {
                    console.log('Not logged in');
                }
            }
        });

        this.addCommand({
            id: 'open-shared-notes',
            name: 'Open Shared Notes',
            callback: () => {
                this.activateSharedNotesView();
            }
        });

        this.addCommand({
            id: 'open-version-history',
            name: 'Open Version History',
            callback: () => {
                this.activateVersionHistoryView();
            }
        });

        this.addCommand({
            id: 'open-smart-search',
            name: 'Open Smart Search',
            callback: () => {
                void this.openSmartSearchModal();
            }
        });

        this.addCommand({
            id: 'rebuild-smart-search-index',
            name: 'Rebuild Smart Search Index',
            callback: () => {
                void this.searchManager.rebuildIndex();
            }
        });

        this.addCommand({
            id: 'manual-sync-now',
            name: 'Sync Vault Now',
            callback: () => {
                void this.runManualSync();
            }
        });

        this.addCommand({
            id: 'toggle-sync-pause',
            name: 'Pause Or Resume Sync',
            callback: async () => {
                this.settings.syncPaused = !this.settings.syncPaused;
                await this.saveSettings();
                this.setSyncStatus(this.settings.syncPaused ? 'paused' : 'idle');
                this.refreshSettingsDisplay();
            }
        });

        this.registerEditorExtension(this.collaborationManager.getExtension());
        this.syncManager.registerEvents();
        this.searchManager.registerEvents();
        this.registerFileMenuActions();

        this.registerEvent(this.app.workspace.on('file-open', async (file) => {
            if (file) {
                await this.collaborationManager.joinDocument(file);
            } else {
                this.collaborationManager.leaveDocument();
            }
            await this.updateShareStatusIndicator(file?.path);
            
            // Update version history view
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_VERSION_HISTORY);
            if (leaves.length > 0) {
                const view = leaves[0].view as VersionHistoryView;
                await view.setFile(file);
            }
        }));

        if (this.settings.token) {
            await this.refreshSharedFileIndex();
        }
        await this.updateShareStatusIndicator(this.app.workspace.getActiveFile()?.path);
        void this.searchManager.ensureIndexReady();
        if (this.settings.token) {
            await this.ensureEncryptionReady({
                interactive: true,
                reason: this.hasStoredEncryptionSetup()
                    ? 'Enter your vault passphrase to unlock encrypted sync and backups.'
                    : 'Create a vault passphrase for encrypted sync and backups.'
            });
        }
    }

    private registerFileMenuActions() {
        this.registerEvent(this.app.workspace.on('file-menu', (menu, target) => {
            menu.addItem((item) => {
                item.setTitle('Share & Access Control')
                    .setIcon('share-2')
                    .onClick(async () => {
                        await this.openShareAccessControl(target);
                    });
            });
        }));
    }

    private async openShareAccessControl(target: TAbstractFile) {
        if (!this.settings.token) {
            new Notice('Please login first to share files.');
            return;
        }

        const targetFiles = this.getShareTargetFiles(target);
        if (targetFiles.length === 0) {
            new Notice('No files found to share in this selection.');
            return;
        }

        const targetLabel = target instanceof TFolder
            ? `${target.path} (${targetFiles.length} files)`
            : target.path;
        const existingShareState = target instanceof TFile
            ? this.sharedFileIndex.get(target.path)
            : undefined;
        const permissionType = await new ShareAccessModal(this.app, {
            targetLabel,
            fileCount: targetFiles.length,
            currentPermissionType: existingShareState?.permissionType,
            currentRole: existingShareState?.role
        }).openAndWait();

        if (!permissionType) {
            return;
        }

        const encryptionReady = await this.ensureEncryptionReady({
            interactive: true,
            reason: 'Unlock your vault passphrase before sharing encrypted files.'
        });
        if (!encryptionReady) {
            return;
        }

        try {
            let successCount = 0;
            const failedPaths: string[] = [];
            let lastResult: Awaited<ReturnType<SharingService['shareFile']>> | null = null;

            for (const file of targetFiles) {
                const uploaded = await this.syncManager.uploadFile(file, {
                    force: true,
                    ignoreSyncRules: true
                });
                if (!uploaded) {
                    failedPaths.push(file.path);
                    continue;
                }

                try {
                    const remoteFile = await this.syncManager.ensureRemoteFileRecord(file, {
                        uploadIfMissing: true
                    });
                    if (!remoteFile) {
                        failedPaths.push(file.path);
                        continue;
                    }

                    lastResult = await this.sharingService.shareFile(
                        { fileId: remoteFile.id, path: file.path },
                        permissionType
                    );
                    successCount += 1;
                } catch (error) {
                    console.error(error);
                    failedPaths.push(file.path);
                }
            }

            await this.refreshSharedFileIndex();
            await this.updateShareStatusIndicator(this.app.workspace.getActiveFile()?.path);

            if (successCount === 0) {
                new Notice(`Share failed for ${target.name}.`);
                return;
            }

            if (targetFiles.length === 1 && lastResult) {
                new Notice(
                    `Shared ${targetFiles[0].name} as ${lastResult.role} (${lastResult.permissionType}).`
                );
                return;
            }

            new Notice(
                failedPaths.length > 0
                    ? `Shared ${successCount} of ${targetFiles.length} files from ${target.name}.`
                    : `Shared ${successCount} files from ${target.name}.`
            );
        } catch (error: any) {
            console.error(error);
            new Notice(`Share failed: ${error.message || 'Unknown error'}`);
        }
    }

    async refreshSharedFileIndex() {
        if (!this.settings.token) {
            this.sharedFileIndex.clear();
            return;
        }

        try {
            const sharedFiles = await this.sharingService.listSharedFiles();
            this.sharedFileIndex.clear();

            sharedFiles.forEach((entry) => {
                this.sharedFileIndex.set(entry.path, {
                    permissionType: entry.permission_type,
                    role: entry.role
                });
            });
        } catch (error) {
            console.error('Failed to refresh shared files list', error);
        }
    }

    async updateShareStatusIndicator(path?: string) {
        if (!path) {
            this.shareStatusEl.setText('Share: no file');
            return;
        }

        if (!this.settings.token) {
            this.shareStatusEl.setText('Share: sign in');
            return;
        }

        let sharedState = this.sharedFileIndex.get(path);

        if (!sharedState) {
            try {
                const activeFile = this.app.workspace.getActiveFile();
                const remoteFile = activeFile && activeFile.path === path
                    ? await this.syncManager.ensureRemoteFileRecord(activeFile)
                    : null;
                const status = await this.sharingService.getShareStatus(
                    remoteFile ? { fileId: remoteFile.id, path } : { path }
                );
                if (status.isShared && status.role && status.permissionType) {
                    sharedState = {
                        role: status.role,
                        permissionType: status.permissionType
                    };
                    this.sharedFileIndex.set(path, sharedState);
                }
            } catch (error) {
                console.error('Failed to get shared status', error);
            }
        }

        if (!sharedState) {
            this.shareStatusEl.setText('Share: not shared');
            return;
        }

        this.shareStatusEl.setText(`Share: ${sharedState.role} (${sharedState.permissionType})`);
    }

    hasStoredEncryptionSetup(): boolean {
        return this.getStoredEncryptionSalt().length > 0;
    }

    lockEncryption(): void {
        this.encryptionService.clearKey();
        this.encryptionLockedNoticeShown = false;
    }

    getPlanManagementUrl(): string {
        const configured = this.settings.planManagementUrl.trim();
        if (configured.length > 0 && configured !== LEGACY_PLAN_MANAGEMENT_URL) {
            return configured;
        }

        try {
            const url = new URL(this.settings.apiUrl);
            if (url.port === '3008') {
                url.port = '3000';
            }
            url.pathname = '/backup-policies';
            url.search = '';
            url.hash = '';
            return url.toString();
        } catch (_error) {
            return 'http://localhost:3000/backup-policies';
        }
    }

    async ensureEncryptionReady(options: {
        interactive: boolean;
        reason: string;
    }): Promise<boolean> {
        if (this.encryptionService.isReady()) {
            return true;
        }

        if (!options.interactive) {
            if (!this.encryptionLockedNoticeShown) {
                new Notice(options.reason);
                this.encryptionLockedNoticeShown = true;
            }
            return false;
        }

        if (this.encryptionPromptPromise) {
            return this.encryptionPromptPromise;
        }

        this.encryptionPromptPromise = this.promptForEncryptionPassphrase(options.reason)
            .finally(() => {
                this.encryptionPromptPromise = null;
            });
        return this.encryptionPromptPromise;
    }

    private async promptForEncryptionPassphrase(reason: string): Promise<boolean> {
        const modal = new EncryptionPassphraseModal(this.app, {
            mode: this.hasStoredEncryptionSetup() ? 'unlock' : 'setup',
            reason
        });
        const passphrase = await modal.openAndWait();
        if (!passphrase) {
            return false;
        }

        try {
            const saltBase64 = await this.encryptionService.deriveKeyFromPassword(
                passphrase,
                this.getStoredEncryptionSalt() || undefined
            );

            const storedVerifier = this.getStoredEncryptionVerifier();
            if (storedVerifier) {
                const verifier = await this.encryptionService.decrypt(
                    storedVerifier.data,
                    storedVerifier.iv
                );
                if (verifier !== ENCRYPTION_VERIFIER_TEXT) {
                    this.lockEncryption();
                    new Notice('Incorrect vault passphrase.');
                    return false;
                }
            } else {
                this.settings.encryptionVerifier = await this.encryptionService.encrypt(ENCRYPTION_VERIFIER_TEXT);
            }

            this.settings.encryptionSalt = saltBase64;
            this.settings.encryptionUserId = this.settings.user?.id || '';
            await this.saveSettings();
            this.encryptionLockedNoticeShown = false;
            return true;
        } catch (error) {
            console.error('Failed to unlock encryption', error);
            this.lockEncryption();
            new Notice('Incorrect vault passphrase.');
            return false;
        }
    }

    private getShareTargetFiles(target: TAbstractFile): TFile[] {
        if (target instanceof TFile) {
            return [target];
        }

        if (target instanceof TFolder) {
            const prefix = target.path.length > 0 ? `${target.path}/` : '';
            return this.app.vault.getFiles().filter((file) => file.path.startsWith(prefix));
        }

        return [];
    }

    private getStoredEncryptionSalt(): string {
        const userId = this.settings.user?.id || '';
        if (!userId || this.settings.encryptionUserId !== userId) {
            return '';
        }

        return this.settings.encryptionSalt;
    }

    private getStoredEncryptionVerifier(): CollaborativeSettings['encryptionVerifier'] {
        const userId = this.settings.user?.id || '';
        if (!userId || this.settings.encryptionUserId !== userId) {
            return null;
        }

        return this.settings.encryptionVerifier;
    }

    refreshSettingsDisplay(): void {
        if (this.settingsTab?.containerEl?.isConnected) {
            void this.settingsTab.display();
        }
    }

    setSyncStatus(message: string): void {
        this.syncStatusMessage = message;
        if (this.syncStatusEl) {
            this.syncStatusEl.setText(`Sync: ${message}`);
        }
        this.refreshSettingsDisplay();
    }

    getSyncStatusSummary(): string {
        return this.syncStatusMessage;
    }

    async runManualSync(): Promise<void> {
        await this.syncManager.manualSyncAll();
    }

    async openSmartSearchModal(): Promise<void> {
        await this.searchManager.ensureIndexReady();
        new SmartSearchModal(this).open();
    }

    async activateSharedNotesView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_SHARED_NOTES);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: VIEW_TYPE_SHARED_NOTES, active: true });
            }
        }

        if (leaf) workspace.revealLeaf(leaf);
    }

    async activateVersionHistoryView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_VERSION_HISTORY);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: VIEW_TYPE_VERSION_HISTORY, active: true });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
            const view = leaf.view as VersionHistoryView;
            await view.setFile(this.app.workspace.getActiveFile());
        }
    }

    onunload() {
        // Cleanup if needed
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
