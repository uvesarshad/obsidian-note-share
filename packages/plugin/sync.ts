import { TFile, TAbstractFile, request } from 'obsidian';
import CollaborativePlugin from './main';
import { EncryptionService } from './encryption';

export class SyncManager {
    plugin: CollaborativePlugin;
    encryptionService: EncryptionService;

    constructor(plugin: CollaborativePlugin, encryptionService: EncryptionService) {
        this.plugin = plugin;
        this.encryptionService = encryptionService;
    }

    async uploadFile(file: TFile): Promise<boolean> {
        if (!this.plugin.settings.token) return false;
        const encryptionReady = await this.plugin.ensureEncryptionReady({
            interactive: false,
            reason: 'Unlock vault encryption to resume sync uploads.'
        });
        if (!encryptionReady) {
            return false;
        }

        console.log(`Uploading ${file.path}...`);
        try {
            const content = await this.plugin.app.vault.read(file);
            const encrypted = await this.encryptionService.encrypt(content);

            // Serialize encrypted data to JSON string for storage
            const encryptedContent = JSON.stringify(encrypted);

            const response = await request({
                url: `${this.plugin.settings.apiUrl}/api/files/upload`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.plugin.settings.token}`
                },
                body: JSON.stringify({
                    path: file.path,
                    content: encryptedContent,
                    fileHash: 'TODO-hash', // Optional for now
                    version: 1 // Optional for now
                })
            });

            console.log(`Uploaded ${file.path}:`, response);
            return true;

        } catch (err) {
            console.error(`Failed to upload file ${file.path}:`, err);
            return false;
        }
    }

    async downloadFile(path: string) {
        if (!this.plugin.settings.token) return;
        const encryptionReady = await this.plugin.ensureEncryptionReady({
            interactive: true,
            reason: 'Unlock vault encryption to decrypt synced files.'
        });
        if (!encryptionReady) {
            return;
        }

        try {
            const response = await request({
                url: `${this.plugin.settings.apiUrl}/api/files/download`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.plugin.settings.token}`
                },
                body: JSON.stringify({ path })
            });

            const data = JSON.parse(response);
            if (data.content) {
                const encrypted = JSON.parse(data.content);
                const decryptedContent = await this.encryptionService.decrypt(encrypted.data, encrypted.iv);

                // Write to vault
                const file = this.plugin.app.vault.getAbstractFileByPath(path);
                if (file instanceof TFile) {
                    await this.plugin.app.vault.modify(file, decryptedContent);
                } else {
                    await this.plugin.app.vault.create(path, decryptedContent);
                }
                console.log(`Downloaded and decrypted ${path}`);
            }

        } catch (err) {
            console.error(`Failed to download file ${path}:`, err);
        }
    }

    registerEvents() {
        this.plugin.registerEvent(
            this.plugin.app.vault.on('modify', async (file: TAbstractFile) => {
                if (file instanceof TFile) {
                    // Check logic
                    if (this.shouldSync(file)) {
                        await this.uploadFile(file);
                    }
                }
            })
        );
    }

    private shouldSync(file: TFile): boolean {
        const settings = this.plugin.settings;

        // 1. Check Backup Frequency
        if (settings.backupFrequency === 'manual') {
            return false;
        }
        // TODO: Implement hourly/daily throttling. For now, treat non-manual as realtime for simplicity
        // or just return false if not realtime to be strict.
        if (settings.backupFrequency !== 'realtime') {
            // For MVP, if it's not realtime, we assume the user will trigger it manually or via a separate scheduler (not yet implemented)
            // console.log("Skipping realtime sync due to frequency setting");
            return false;
        }

        // 2. Check Excluded Folders
        if (settings.syncExcludedFolders.length > 0) {
            for (const excluded of settings.syncExcludedFolders) {
                if (file.path.startsWith(excluded)) {
                    // console.log(`Skipping upload: ${file.path} is in excluded folder ${excluded}`);
                    return false;
                }
            }
        }

        return true;
    }
}
