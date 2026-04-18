import { request, TAbstractFile, TFile } from 'obsidian';
import CollaborativePlugin from './main';
import { EncryptionService } from './encryption';
import { BackupFrequency, RemoteFileRecord, SyncFileState } from './types';

const SCHEDULED_SYNC_SCAN_INTERVAL_MS = 60_000;

export class SyncManager {
    plugin: CollaborativePlugin;
    encryptionService: EncryptionService;
    private activeUploads = new Set<string>();
    private scheduledScanPromise: Promise<void> | null = null;
    private remoteFilesByPath = new Map<string, RemoteFileRecord>();

    constructor(plugin: CollaborativePlugin, encryptionService: EncryptionService) {
        this.plugin = plugin;
        this.encryptionService = encryptionService;
    }

    async uploadFile(file: TFile, options?: {
        force?: boolean;
        ignoreSyncRules?: boolean;
        manual?: boolean;
    }): Promise<boolean> {
        if (!this.plugin.settings.token) return false;
        if (this.activeUploads.has(file.path)) return false;
        if (!options?.ignoreSyncRules && !this.shouldSyncFile(file, options?.manual === true)) {
            return false;
        }

        const encryptionReady = await this.plugin.ensureEncryptionReady({
            interactive: false,
            reason: 'Unlock vault encryption to resume sync uploads.'
        });
        if (!encryptionReady) {
            this.plugin.setSyncStatus('locked');
            return false;
        }

        this.activeUploads.add(file.path);
        this.plugin.setSyncStatus(`syncing ${file.name}`);

        try {
            const content = await this.plugin.app.vault.read(file);
            const fileHash = await this.computeContentHash(content);

            if (!options?.force && !this.shouldUploadHash(file.path, fileHash)) {
                if (this.activeUploads.size === 1) {
                    this.plugin.setSyncStatus('synced');
                }
                return false;
            }

            console.log(`Uploading ${file.path}...`);
            const encrypted = await this.encryptionService.encrypt(content);
            const encryptedContent = JSON.stringify(encrypted);

            const existingRemoteFile = this.remoteFilesByPath.get(file.path);
            const uploadedFile = await this.sendUploadRequest(
                file.path,
                encryptedContent,
                fileHash,
                existingRemoteFile?.id
            );
            this.setRemoteFileRecord(uploadedFile, file.path);
            await this.persistSyncState(file.path, {
                lastUploadedAt: Date.now(),
                lastUploadedHash: fileHash
            });

            console.log(`Uploaded ${file.path}`);
            this.plugin.setSyncStatus(`synced ${new Date().toLocaleTimeString()}`);
            return true;
        } catch (err) {
            console.error(`Failed to upload file ${file.path}:`, err);
            this.plugin.setSyncStatus(`error ${file.name}`);
            return false;
        } finally {
            this.activeUploads.delete(file.path);
        }
    }

    async downloadFile(path: string) {
        if (!this.plugin.settings.token) return;
        const encryptionReady = await this.plugin.ensureEncryptionReady({
            interactive: true,
            reason: 'Unlock vault encryption to decrypt synced files.'
        });
        if (!encryptionReady) {
            this.plugin.setSyncStatus('locked');
            return;
        }

        try {
            this.plugin.setSyncStatus(`syncing ${path}`);
            const cachedRemoteFile = this.remoteFilesByPath.get(path);
            const response = await request({
                url: `${this.plugin.settings.apiUrl}/api/files/download`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.plugin.settings.token}`
                },
                body: JSON.stringify(cachedRemoteFile ? { fileId: cachedRemoteFile.id } : { path })
            });

            const data = JSON.parse(response);
            if (data.content) {
                if (data.file) {
                    this.setRemoteFileRecord(data.file, path);
                    path = data.file.path;
                }
                const encrypted = JSON.parse(data.content);
                const decryptedContent = await this.encryptionService.decrypt(encrypted.data, encrypted.iv);

                const file = this.plugin.app.vault.getAbstractFileByPath(path);
                if (file instanceof TFile) {
                    await this.plugin.app.vault.modify(file, decryptedContent);
                } else {
                    await this.plugin.app.vault.create(path, decryptedContent);
                }

                const fileHash = await this.computeContentHash(decryptedContent);
                await this.persistSyncState(path, {
                    lastUploadedAt: Date.now(),
                    lastUploadedHash: fileHash
                });

                console.log(`Downloaded and decrypted ${path}`);
                this.plugin.setSyncStatus(`synced ${new Date().toLocaleTimeString()}`);
            }
        } catch (err) {
            console.error(`Failed to download file ${path}:`, err);
            this.plugin.setSyncStatus(`error ${path}`);
        }
    }

    registerEvents() {
        this.plugin.registerEvent(
            this.plugin.app.vault.on('modify', async (file: TAbstractFile) => {
                if (file instanceof TFile) {
                    await this.uploadFile(file);
                }
            })
        );

        this.plugin.registerEvent(
            this.plugin.app.vault.on('rename', async (file: TAbstractFile, oldPath: string) => {
                await this.migrateSyncState(file.path, oldPath, !(file instanceof TFile));
                this.migrateRemoteFileRecord(file.path, oldPath, !(file instanceof TFile));
            })
        );

        this.plugin.registerEvent(
            this.plugin.app.vault.on('delete', async (file: TAbstractFile) => {
                await this.removeSyncState(file.path);
                this.removeRemoteFileRecord(file.path);
            })
        );

        this.plugin.registerInterval(window.setInterval(() => {
            void this.runScheduledSyncScan();
        }, SCHEDULED_SYNC_SCAN_INTERVAL_MS));

        void this.runScheduledSyncScan();
    }

    async manualSyncAll(): Promise<void> {
        if (!this.plugin.settings.token) {
            this.plugin.setSyncStatus('sign in required');
            return;
        }

        if (this.plugin.settings.syncPaused) {
            this.plugin.setSyncStatus('paused');
            return;
        }

        this.plugin.setSyncStatus('syncing vault');
        let uploadedAny = false;

        for (const file of this.plugin.app.vault.getFiles()) {
            if (!this.shouldSyncFile(file, true)) {
                continue;
            }

            const uploaded = await this.uploadFile(file, { manual: true });
            uploadedAny = uploadedAny || uploaded;
        }

        this.plugin.setSyncStatus(uploadedAny ? `synced ${new Date().toLocaleTimeString()}` : 'synced');
    }

    private async runScheduledSyncScan(): Promise<void> {
        if (this.plugin.settings.syncPaused) {
            this.plugin.setSyncStatus('paused');
            return;
        }

        const frequencyWindow = this.getFrequencyWindowMs(this.plugin.settings.syncFrequency);
        if (frequencyWindow === null || frequencyWindow === 0) {
            return;
        }

        if (this.scheduledScanPromise) {
            return this.scheduledScanPromise;
        }

        this.scheduledScanPromise = (async () => {
            for (const file of this.plugin.app.vault.getFiles()) {
                if (!this.shouldSyncFile(file)) {
                    continue;
                }

                await this.uploadFile(file);
            }
        })().finally(() => {
            this.scheduledScanPromise = null;
        });

        return this.scheduledScanPromise;
    }

    async ensureRemoteFileRecord(
        file: TFile,
        options?: { uploadIfMissing?: boolean }
    ): Promise<RemoteFileRecord | null> {
        const cachedFile = this.remoteFilesByPath.get(file.path);
        if (cachedFile) {
            return cachedFile;
        }

        const resolvedFile = await this.resolveRemoteFile({ path: file.path });
        if (resolvedFile) {
            this.setRemoteFileRecord(resolvedFile, file.path);
            return resolvedFile;
        }

        if (!options?.uploadIfMissing) {
            return null;
        }

        const uploaded = await this.uploadFile(file, {
            force: true,
            ignoreSyncRules: true
        });
        if (!uploaded) {
            return null;
        }

        return this.remoteFilesByPath.get(file.path) || null;
    }

    private shouldSyncFile(file: TFile, manual = false): boolean {
        const settings = this.plugin.settings;

        if (settings.syncPaused) {
            return false;
        }

        if (!manual && settings.syncFrequency === 'manual') {
            return false;
        }

        if (settings.syncFolders.length > 0) {
            const matchesIncludedFolder = settings.syncFolders.some((folder) => this.isPathWithinFolder(file.path, folder));
            if (!matchesIncludedFolder) {
                return false;
            }
        }

        return !settings.syncExcludedFolders.some((folder) => this.isPathWithinFolder(file.path, folder));
    }

    private shouldUploadHash(path: string, fileHash: string): boolean {
        const currentState = this.getScopedSyncState()[path];
        if (!currentState) {
            return true;
        }

        if (currentState.lastUploadedHash === fileHash) {
            return false;
        }

        const frequencyWindow = this.getFrequencyWindowMs(this.plugin.settings.syncFrequency);
        if (frequencyWindow === null || frequencyWindow === 0) {
            return true;
        }

        return Date.now() - currentState.lastUploadedAt >= frequencyWindow;
    }

    private getFrequencyWindowMs(frequency: BackupFrequency): number | null {
        switch (frequency) {
            case 'manual':
                return null;
            case 'realtime':
                return 0;
            case 'hourly':
                return 60 * 60 * 1000;
            case 'daily':
                return 24 * 60 * 60 * 1000;
            case 'weekly':
                return 7 * 24 * 60 * 60 * 1000;
            case 'monthly':
                return 30 * 24 * 60 * 60 * 1000;
            default:
                return 0;
        }
    }

    private async computeContentHash(content: string): Promise<string> {
        const encoded = new TextEncoder().encode(content);
        const digest = await window.crypto.subtle.digest('SHA-256', encoded);
        return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    private async sendUploadRequest(
        path: string,
        content: string,
        fileHash: string,
        fileId?: string
    ): Promise<RemoteFileRecord> {
        const response = await request({
            url: `${this.plugin.settings.apiUrl}/api/files/upload`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.plugin.settings.token}`
            },
            body: JSON.stringify({
                path,
                content,
                fileHash,
                fileId
            })
        });

        const data = JSON.parse(response);
        return data.file as RemoteFileRecord;
    }

    private async persistSyncState(path: string, state: SyncFileState): Promise<void> {
        this.ensureSyncStateScope();
        this.plugin.settings.syncState[path] = state;
        await this.plugin.saveSettings();
    }

    private async migrateSyncState(newPath: string, oldPath: string, isFolder: boolean): Promise<void> {
        this.ensureSyncStateScope();
        if (newPath === oldPath) {
            return;
        }

        if (isFolder) {
            const oldPrefix = `${oldPath}/`;
            const newPrefix = `${newPath}/`;
            const remappedEntries = Object.entries(this.plugin.settings.syncState)
                .filter(([path]) => path.startsWith(oldPrefix))
                .map(([path, state]) => [`${newPrefix}${path.slice(oldPrefix.length)}`, state] as const);

            if (remappedEntries.length === 0) {
                return;
            }

            for (const [path] of Object.entries(this.plugin.settings.syncState)) {
                if (path.startsWith(oldPrefix)) {
                    delete this.plugin.settings.syncState[path];
                }
            }

            for (const [path, state] of remappedEntries) {
                this.plugin.settings.syncState[path] = state;
            }

            await this.plugin.saveSettings();
            return;
        }

        const existingState = this.plugin.settings.syncState[oldPath];
        if (!existingState) {
            return;
        }

        this.plugin.settings.syncState[newPath] = existingState;
        delete this.plugin.settings.syncState[oldPath];
        await this.plugin.saveSettings();
    }

    private async removeSyncState(path: string): Promise<void> {
        this.ensureSyncStateScope();
        const matchingPaths = Object.keys(this.plugin.settings.syncState).filter((entryPath) => {
            return entryPath === path || entryPath.startsWith(`${path}/`);
        });

        if (matchingPaths.length === 0) {
            return;
        }

        for (const matchingPath of matchingPaths) {
            delete this.plugin.settings.syncState[matchingPath];
        }
        await this.plugin.saveSettings();
    }

    private async resolveRemoteFile(lookup: {
        fileId?: string;
        path?: string;
    }): Promise<RemoteFileRecord | null> {
        try {
            const response = await request({
                url: `${this.plugin.settings.apiUrl}/api/files/resolve`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.plugin.settings.token}`
                },
                body: JSON.stringify(lookup)
            });
            const data = JSON.parse(response);
            return data.file as RemoteFileRecord;
        } catch (error: any) {
            if (error?.status === 404) {
                return null;
            }
            throw error;
        }
    }

    private isPathWithinFolder(path: string, folder: string): boolean {
        const normalizedFolder = folder.trim().replace(/\\/g, '/').replace(/\/+$/, '');
        if (normalizedFolder.length === 0) {
            return true;
        }

        return path === normalizedFolder || path.startsWith(`${normalizedFolder}/`);
    }

    private getScopedSyncState(): Record<string, SyncFileState> {
        const currentUserId = this.plugin.settings.user?.id || '';
        if (!currentUserId || this.plugin.settings.syncStateUserId !== currentUserId) {
            return {};
        }

        return this.plugin.settings.syncState;
    }

    private ensureSyncStateScope(): void {
        const currentUserId = this.plugin.settings.user?.id || '';
        if (this.plugin.settings.syncStateUserId === currentUserId) {
            return;
        }

        this.plugin.settings.syncStateUserId = currentUserId;
        this.plugin.settings.syncState = {};
    }

    private setRemoteFileRecord(file: RemoteFileRecord, requestedPath: string): void {
        this.remoteFilesByPath.delete(requestedPath);
        this.remoteFilesByPath.set(file.path, file);
    }

    private migrateRemoteFileRecord(newPath: string, oldPath: string, isFolder: boolean): void {
        if (newPath === oldPath) {
            return;
        }

        if (isFolder) {
            const oldPrefix = `${oldPath}/`;
            const newPrefix = `${newPath}/`;
            const remappedEntries = [...this.remoteFilesByPath.entries()]
                .filter(([path]) => path.startsWith(oldPrefix))
                .map(([path, record]) => {
                    const nextPath = `${newPrefix}${path.slice(oldPrefix.length)}`;
                    return [nextPath, { ...record, path: nextPath }] as const;
                });

            for (const [path] of [...this.remoteFilesByPath.entries()]) {
                if (path.startsWith(oldPrefix)) {
                    this.remoteFilesByPath.delete(path);
                }
            }

            for (const [path, record] of remappedEntries) {
                this.remoteFilesByPath.set(path, record);
            }
            return;
        }

        const existingRecord = this.remoteFilesByPath.get(oldPath);
        if (!existingRecord) {
            return;
        }

        this.remoteFilesByPath.delete(oldPath);
        this.remoteFilesByPath.set(newPath, {
            ...existingRecord,
            path: newPath
        });
    }

    private removeRemoteFileRecord(path: string): void {
        for (const [entryPath] of [...this.remoteFilesByPath.entries()]) {
            if (entryPath === path || entryPath.startsWith(`${path}/`)) {
                this.remoteFilesByPath.delete(entryPath);
            }
        }
    }
}
