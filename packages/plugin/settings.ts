import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import CollaborativePlugin from './main';
import { AuthService } from './auth';
import { BackupFrequency } from './types';

export class CollaborativeSettingsTab extends PluginSettingTab {
    plugin: CollaborativePlugin;
    authService: AuthService;

    constructor(app: App, plugin: CollaborativePlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.authService = new AuthService(plugin);
    }

    isRegisterMode: boolean = false;

    private readonly frequencyLabels: Record<BackupFrequency, string> = {
        realtime: 'Real-time (Instant)',
        hourly: 'Hourly',
        daily: 'Daily',
        weekly: 'Weekly',
        monthly: 'Monthly',
        manual: 'Manual Only'
    };

    private async syncBackupPreferencesFromServer() {
        if (!this.plugin.settings.token) return;

        try {
            const backupConfig = await this.plugin.backupService.getPreferences();
            this.plugin.settings.planAllowsFullVaultBackup = backupConfig.policy.fullVaultBackupEnabled;
            this.plugin.settings.backupAllowedFrequencies = backupConfig.policy.allowedFrequencies;
            this.plugin.settings.fullVaultBackupEnabled = backupConfig.preferences.fullVaultBackupEnabled;
            this.plugin.settings.backupFrequency = backupConfig.preferences.backupFrequency;
            await this.plugin.saveSettings();
        } catch (error) {
            console.error('Failed to fetch backup preferences', error);
        }
    }

    private async persistBackupPreferences() {
        if (!this.plugin.settings.token) return;

        await this.plugin.backupService.updatePreferences({
            fullVaultBackupEnabled: this.plugin.settings.fullVaultBackupEnabled,
            backupFrequency: this.plugin.settings.backupFrequency
        });
    }

    async display(): Promise<void> {
        const { containerEl } = this;

        containerEl.empty();

        if (this.plugin.settings.token) {
            await this.syncBackupPreferencesFromServer();
        }

        const allowedFrequencies: BackupFrequency[] = this.plugin.settings.backupAllowedFrequencies.length > 0
            ? this.plugin.settings.backupAllowedFrequencies
            : ['manual', 'daily'];
        const backupFrequencyOptions = allowedFrequencies.reduce((acc, frequency) => {
            acc[frequency] = this.frequencyLabels[frequency];
            return acc;
        }, {} as Record<string, string>);
        const effectiveBackupFrequency = allowedFrequencies.includes(this.plugin.settings.backupFrequency)
            ? this.plugin.settings.backupFrequency
            : allowedFrequencies[0];

        new Setting(containerEl)
            .setName('API URL')
            .setDesc('The URL of the Collaborative Cloud server')
            .addText(text => text
                .setPlaceholder('http://localhost:3008')
                .setValue(this.plugin.settings.apiUrl)
                .onChange(async (value) => {
                    this.plugin.settings.apiUrl = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Vault Passphrase')
            .setDesc(
                this.plugin.encryptionService.isReady()
                    ? 'Vault key is unlocked for this session.'
                    : this.plugin.hasStoredEncryptionSetup()
                        ? 'Vault key is locked. Unlock it to sync and restore encrypted data.'
                        : 'Set a passphrase to enable encrypted sync and vault backups.'
            )
            .addButton((button) => button
                .setButtonText(this.plugin.hasStoredEncryptionSetup() ? 'Unlock' : 'Set Passphrase')
                .setCta()
                .onClick(async () => {
                    const ready = await this.plugin.ensureEncryptionReady({
                        interactive: true,
                        reason: this.plugin.hasStoredEncryptionSetup()
                            ? 'Enter your vault passphrase to unlock encrypted sync and backups.'
                            : 'Create a vault passphrase for encrypted sync and backups.'
                    });
                    if (ready) {
                        this.display();
                    }
                }));

        // --- Sync Settings ---
        containerEl.createEl('h3', { text: 'Sync Settings' });

        new Setting(containerEl)
            .setName('Excluded Folders')
            .setDesc('Enter folder paths to exclude from sync (one per line).')
            .addTextArea(text => text
                .setPlaceholder('Example: private/\nsecrets/')
                .setValue(this.plugin.settings.syncExcludedFolders.join('\n'))
                .onChange(async (value) => {
                    this.plugin.settings.syncExcludedFolders = value.split('\n').filter(p => p.trim() !== '');
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Backup Frequency')
            .setDesc('How often full-vault backup runs (limited by your subscription plan).')
            .addDropdown(dropdown => dropdown
                .addOptions(backupFrequencyOptions)
                .setValue(effectiveBackupFrequency)
                .onChange(async (value: any) => {
                    this.plugin.settings.backupFrequency = value as BackupFrequency;
                    await this.plugin.saveSettings();
                    if (this.plugin.settings.token) {
                        try {
                            await this.persistBackupPreferences();
                        } catch (error: any) {
                            new Notice(`Failed to save backup frequency: ${error.message || 'Unknown error'}`);
                        }
                    }
                }));

        new Setting(containerEl)
            .setName('Full Vault Backup')
            .setDesc(
                this.plugin.settings.planAllowsFullVaultBackup
                    ? 'Enable full-vault backup snapshots.'
                    : 'Not available on your current subscription plan.'
            )
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.fullVaultBackupEnabled)
                    .setDisabled(!this.plugin.settings.planAllowsFullVaultBackup)
                    .onChange(async (value) => {
                        this.plugin.settings.fullVaultBackupEnabled = value;
                        await this.plugin.saveSettings();
                        if (this.plugin.settings.token) {
                            try {
                                await this.persistBackupPreferences();
                            } catch (error: any) {
                                new Notice(`Failed to save backup setting: ${error.message || 'Unknown error'}`);
                            }
                        }
                    });
            });


        // --- Vault Config Backup ---
        containerEl.createEl('h3', { text: 'Vault Configuration Backup' });
        
        containerEl.createEl('p', {
            text: 'Backup and restore your Obsidian settings, themes, and plugin configurations (.obsidian folder).',
            cls: 'setting-item-description'
        });

        new Setting(containerEl)
            .setName('Backup Now')
            .setDesc('Create a snapshot of your current Vault Configuration and save it to the cloud.')
            .addButton(button => button
                .setButtonText('Backup Config')
                .onClick(async () => {
                    await this.plugin.backupService.uploadVaultConfig();
                }));

        new Setting(containerEl)
            .setName('Restore Latest')
            .setDesc('Download and apply your most recent configuration backup. Requires Obsidian reload.')
            .addButton(button => button
                .setButtonText('Restore Config')
                .setWarning()
                .onClick(async () => {
                    if (confirm('Are you sure you want to overwrite your current configuration with the latest backup? Obsidian will reload.')) {
                        await this.plugin.backupService.restoreVaultConfig();
                    }
                }));

        // --- Plan Management ---
        containerEl.createEl('h3', { text: 'Subscription Plan' });

        new Setting(containerEl)
            .setName('Manage Plan')
            .setDesc('Upgrade your storage or manage billing.')
            .addButton(button => button
                .setButtonText('Manage Subscription')
                .onClick(() => {
                    window.open(this.plugin.getPlanManagementUrl(), '_blank');
                }));

        // --- Auth Status ---
        containerEl.createEl('hr');

        // Status Indicator
        const statusDiv = containerEl.createDiv({ cls: 'setting-item-description' });
        // TODO: Hook into Socket.io connection state
        statusDiv.setText(this.plugin.settings.token ? 'Status: Authenticated' : 'Status: Disconnected');


        if (this.plugin.settings.token) {
            if (this.plugin.settings.user) {
                new Setting(containerEl)
                    .setName('Account')
                    .setDesc(`Logged in as: ${this.plugin.settings.user.email}`)
                    .addButton(button => button
                        .setButtonText('Logout')
                        .onClick(async () => {
                            this.plugin.lockEncryption();
                            await this.authService.logout();
                            await this.plugin.refreshSharedFileIndex();
                            await this.plugin.updateShareStatusIndicator(this.plugin.app.workspace.getActiveFile()?.path);
                            this.display(); // Refresh UI
                        }));
            }
        } else {
            containerEl.createEl('h3', { text: this.isRegisterMode ? 'Register' : 'Login' });

            const loginFormDiv = containerEl.createDiv();

            let email = '';
            let password = '';
            let displayName = '';

            new Setting(loginFormDiv)
                .setName('Email')
                .addText(text => text
                    .onChange(value => email = value));

            new Setting(loginFormDiv)
                .setName('Password')
                .addText(text => {
                    text.inputEl.type = 'password';
                    text.onChange(value => password = value);
                });

            if (this.isRegisterMode) {
                new Setting(loginFormDiv)
                    .setName('Display Name')
                    .addText(text => text
                        .onChange(value => displayName = value));
            }

            new Setting(loginFormDiv)
                .addButton(button => button
                    .setButtonText(this.isRegisterMode ? 'Register' : 'Login')
                    .setCta()
                    .onClick(async () => {
                        try {
                            if (this.isRegisterMode) {
                                await this.authService.register(email, password, displayName);
                            } else {
                                await this.authService.login(email, password);
                            }
                            this.plugin.lockEncryption();
                            await this.syncBackupPreferencesFromServer();
                            await this.plugin.refreshSharedFileIndex();
                            await this.plugin.updateShareStatusIndicator(this.plugin.app.workspace.getActiveFile()?.path);
                            await this.plugin.ensureEncryptionReady({
                                interactive: true,
                                reason: this.plugin.hasStoredEncryptionSetup()
                                    ? 'Enter your vault passphrase to unlock encrypted sync and backups.'
                                    : 'Create a vault passphrase for encrypted sync and backups.'
                            });
                            this.display();
                        } catch (e: any) {
                            console.error(e);
                            // Simple error display
                            new Notice(`${this.isRegisterMode ? 'Registration' : 'Login'} Failed: ${e.message}`);
                        }
                    }))
                .addButton(button => button
                    .setButtonText(this.isRegisterMode ? 'Back to Login' : 'Need an account? Register')
                    .onClick(() => {
                        this.isRegisterMode = !this.isRegisterMode;
                        this.display();
                    }));
        }
    }
}
