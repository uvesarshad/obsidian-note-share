import { App, Modal } from 'obsidian';
import { diff_match_patch } from 'diff-match-patch';

export class VersionDiffModal extends Modal {
    private oldText: string;
    private newText: string;
    private versionNum: number;

    constructor(app: App, oldText: string, newText: string, versionNum: number) {
        super(app);
        this.oldText = oldText;
        this.newText = newText;
        this.versionNum = versionNum;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: `Changes vs Version ${this.versionNum}` });

        const dmp = new diff_match_patch();
        const diffs = dmp.diff_main(this.oldText, this.newText);
        dmp.diff_cleanupSemantic(diffs);

        const container = contentEl.createEl('div', {
            attr: {
                style: 'white-space: pre-wrap; font-family: monospace; background: var(--background-primary-alt); padding: 15px; border-radius: 5px; max-height: 60vh; overflow-y: auto;'
            }
        });

        for (const [operation, text] of diffs) {
            let color = 'inherit';
            let bg = 'transparent';
            let decoration = 'none';

            if (operation === 1) { // Insert
                color = 'var(--text-success)';
                bg = 'var(--background-modifier-success)';
            } else if (operation === -1) { // Delete
                color = 'var(--text-error)';
                bg = 'var(--background-modifier-error)';
                decoration = 'line-through';
            }

            container.createEl('span', {
                text: text,
                attr: {
                    style: `color: ${color}; background-color: ${bg}; text-decoration: ${decoration};`
                }
            });
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}
