import { request, Notice } from 'obsidian';
import CollaborativePlugin from './main';
import { BackupFrequency } from './types';
import { EncryptionService } from './encryption';

export interface BackupPolicyResponse {
    planTier: string;
    policy: {
        fullVaultBackupEnabled: boolean;
        allowedFrequencies: BackupFrequency[];
    };
    preferences: {
        fullVaultBackupEnabled: boolean;
        backupFrequency: BackupFrequency;
    };
}

export class BackupService {
    private plugin: CollaborativePlugin;
    private encryptionService: EncryptionService;

    constructor(plugin: CollaborativePlugin, encryptionService: EncryptionService) {
        this.plugin = plugin;
        this.encryptionService = encryptionService;
    }

    async getPreferences(): Promise<BackupPolicyResponse> {
        const response = await request({
            url: `${this.plugin.settings.apiUrl}/api/backup/preferences`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.plugin.settings.token}`
            }
        });

        return JSON.parse(response);
    }

    async updatePreferences(payload: {
        fullVaultBackupEnabled: boolean;
        backupFrequency: BackupFrequency;
    }): Promise<void> {
        await request({
            url: `${this.plugin.settings.apiUrl}/api/backup/preferences`,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.plugin.settings.token}`
            },
            body: JSON.stringify(payload)
        });
    }

    // --- Vault Configuration Sync ---

    /**
     * Traverses the .obsidian folder (or the current config dir) and packs
     * all files into a single flat JSON object { "filepath": "content" }
     */
    async createConfigSnapshot(): Promise<Record<string, string>> {
        const configDir = this.plugin.app.vault.configDir;
        const adapter = this.plugin.app.vault.adapter;
        const snapshot: Record<string, string> = {};

        const traverse = async (path: string) => {
            if (!(await adapter.exists(path))) return;
            const stat = await adapter.stat(path);

            if (stat?.type === 'folder') {
                const listing = await adapter.list(path);
                for (const folder of listing.folders) {
                    // Skip bulky caches or node_modules if any exist magically inside .obsidian
                    if (folder.includes('cache') || folder.includes('node_modules')) continue;
                    await traverse(folder);
                }
                for (const file of listing.files) {
                    await traverse(file);
                }
            } else if (stat?.type === 'file') {
                try {
                    // Read file as string (works for json, css, js).
                    // We might need array buffer backing for binary files (fonts, images in snippets),
                    // but for MVP text-based configs are strictly sufficient.
                    const content = await adapter.read(path);
                    snapshot[path] = content;
                } catch (e) {
                    console.error(`Failed to read config file ${path}`, e);
                }
            }
        };

        await traverse(configDir);
        return snapshot;
    }

    async uploadVaultConfig(): Promise<void> {
        if (!this.plugin.settings.token) {
            new Notice('Cannot backup config: Not authenticated');
            return;
        }

        const encryptionReady = await this.plugin.ensureEncryptionReady({
            interactive: true,
            reason: 'Set or unlock your vault passphrase before creating encrypted backups.'
        });
        if (!encryptionReady) {
            return;
        }

        const notice = new Notice('Starting Vault Config Backup...', 0);
        try {
            const configObj = await this.createConfigSnapshot();
            const jsonString = JSON.stringify(configObj);

            // Encrypt the config
            const encryptedData = await this.encryptionService.encrypt(jsonString);
            const blobString = JSON.stringify(encryptedData);

            await request({
                url: `${this.plugin.settings.apiUrl}/api/backup/upload`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.plugin.settings.token}`
                },
                body: JSON.stringify({ configBlob: blobString })
            });

            notice.hide();
            new Notice('Vault config backed up successfully!');
        } catch (error) {
            console.error('Vault config backup failed', error);
            notice.hide();
            new Notice('Vault config backup failed! See console for details.');
        }
    }

    async restoreVaultConfig(): Promise<boolean> {
        if (!this.plugin.settings.token) {
            new Notice('Cannot restore config: Not authenticated');
            return false;
        }

        const encryptionReady = await this.plugin.ensureEncryptionReady({
            interactive: true,
            reason: 'Unlock your vault passphrase before restoring encrypted backups.'
        });
        if (!encryptionReady) {
            return false;
        }

        const notice = new Notice('Fetching latest Vault Config...', 0);
        try {
            const response = await request({
                url: `${this.plugin.settings.apiUrl}/api/backup/latest`,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.plugin.settings.token}`
                }
            });

            const data = JSON.parse(response);
            if (!data.success || !data.configBlob) {
                notice.hide();
                new Notice('No backup found or request failed.');
                return false;
            }

            // Decrypt
            const encryptedData = JSON.parse(data.configBlob);
            const decryptedString = await this.encryptionService.decrypt(encryptedData.data, encryptedData.iv);
            const configObj: Record<string, string> = JSON.parse(decryptedString);

            // Write files back
            const adapter = this.plugin.app.vault.adapter;
            notice.setMessage('Restoring config files...');

            for (const [filepath, content] of Object.entries(configObj)) {
                // Ensure directories exist
                const parts = filepath.split('/');
                let currentPath = '';
                for (let i = 0; i < parts.length - 1; i++) {
                    currentPath += (currentPath === '' ? '' : '/') + parts[i];
                    if (!(await adapter.exists(currentPath))) {
                        await adapter.mkdir(currentPath);
                    }
                }

                // Write file
                await adapter.write(filepath, content);
            }

            notice.hide();
            new Notice('Vault config restored successfully! Reloading Obsidian...', 4000);
            return true;
        } catch (error) {
            console.error('Vault config restore failed', error);
            notice.hide();
            new Notice('Vault config restore failed! See console for details.');
            return false;
        }
    }
}
