import { App, Modal, Notice, Setting } from 'obsidian';

type EncryptionModalMode = 'setup' | 'unlock';

interface EncryptionPassphraseModalOptions {
    mode: EncryptionModalMode;
    reason?: string;
}

export class EncryptionPassphraseModal extends Modal {
    private readonly options: EncryptionPassphraseModalOptions;
    private passphrase = '';
    private confirmPassphrase = '';
    private resolver: ((value: string | null) => void) | null = null;
    private resolved = false;

    constructor(app: App, options: EncryptionPassphraseModalOptions) {
        super(app);
        this.options = options;
    }

    openAndWait(): Promise<string | null> {
        return new Promise((resolve) => {
            this.resolver = resolve;
            this.open();
        });
    }

    onOpen(): void {
        const { contentEl } = this;
        const isSetup = this.options.mode === 'setup';

        contentEl.empty();
        contentEl.createEl('h2', {
            text: isSetup ? 'Set Vault Passphrase' : 'Unlock Vault Passphrase'
        });

        if (this.options.reason) {
            contentEl.createEl('p', { text: this.options.reason });
        }

        let passphraseInput: HTMLInputElement | null = null;

        new Setting(contentEl)
            .setName('Passphrase')
            .addText((text) => {
                text.inputEl.type = 'password';
                text.onChange((value) => {
                    this.passphrase = value;
                });
                text.inputEl.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        void this.submit();
                    }
                });
                passphraseInput = text.inputEl;
            });

        if (isSetup) {
            new Setting(contentEl)
                .setName('Confirm passphrase')
                .addText((text) => {
                    text.inputEl.type = 'password';
                    text.onChange((value) => {
                        this.confirmPassphrase = value;
                    });
                    text.inputEl.addEventListener('keydown', (event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            void this.submit();
                        }
                    });
                });
        }

        new Setting(contentEl)
            .addButton((button) => {
                button
                    .setButtonText(isSetup ? 'Save Passphrase' : 'Unlock')
                    .setCta()
                    .onClick(() => {
                        void this.submit();
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

        passphraseInput?.focus();
    }

    onClose(): void {
        this.contentEl.empty();
        if (!this.resolved) {
            this.resolve(null);
        }
    }

    private async submit(): Promise<void> {
        const passphrase = this.passphrase.trim();
        if (passphrase.length < 8) {
            new Notice('Passphrase must be at least 8 characters.');
            return;
        }

        if (this.options.mode === 'setup' && passphrase !== this.confirmPassphrase) {
            new Notice('Passphrases do not match.');
            return;
        }

        this.resolve(passphrase);
        this.close();
    }

    private resolve(value: string | null): void {
        if (this.resolved) {
            return;
        }

        this.resolved = true;
        this.resolver?.(value);
        this.resolver = null;
    }
}
