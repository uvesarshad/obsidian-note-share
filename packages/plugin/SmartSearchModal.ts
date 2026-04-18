import { Modal, Notice, TFile } from 'obsidian';
import CollaborativePlugin from './main';
import { SearchResult, SmartSearchQuery } from './types';

const EMPTY_QUERY: SmartSearchQuery = {
    query: '',
    tag: '',
    mention: '',
    fileType: '',
    startDate: '',
    endDate: '',
    caseSensitive: false
};

export class SmartSearchModal extends Modal {
    private readonly plugin: CollaborativePlugin;
    private query: SmartSearchQuery = { ...EMPTY_QUERY };
    private resultsEl: HTMLElement | null = null;
    private statsEl: HTMLElement | null = null;

    constructor(plugin: CollaborativePlugin) {
        super(plugin.app);
        this.plugin = plugin;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('collaborative-smart-search-modal');

        contentEl.createEl('h2', { text: 'Smart Search' });
        contentEl.createEl('p', {
            text: 'Search indexed vault content with full-text, tag, mention, date, file-type, and case-sensitive filters.'
        });

        const formEl = contentEl.createDiv({ cls: 'collaborative-smart-search-controls' });

        this.createTextInput(formEl, 'Search', 'Search text', 'query');
        this.createTextInput(formEl, 'Tag', '#tag', 'tag');
        this.createTextInput(formEl, 'Mention', '@person', 'mention');
        this.createTextInput(formEl, 'File Type', 'md', 'fileType');
        this.createDateInput(formEl, 'Start Date', 'startDate');
        this.createDateInput(formEl, 'End Date', 'endDate');
        this.createCheckbox(formEl, 'Case sensitive', 'caseSensitive');

        const actionRow = contentEl.createDiv({ cls: 'collaborative-smart-search-actions' });
        const rebuildButton = actionRow.createEl('button', { text: 'Rebuild Index' });
        rebuildButton.addEventListener('click', async () => {
            await this.plugin.searchManager.rebuildIndex();
            this.renderResults();
        });

        const clearButton = actionRow.createEl('button', { text: 'Clear Filters' });
        clearButton.addEventListener('click', () => {
            this.query = { ...EMPTY_QUERY };
            this.close();
            new SmartSearchModal(this.plugin).open();
        });

        this.statsEl = contentEl.createDiv({ cls: 'setting-item-description' });
        this.resultsEl = contentEl.createDiv({ cls: 'collaborative-smart-search-results' });
        this.renderResults();
    }

    private createTextInput(
        container: HTMLElement,
        label: string,
        placeholder: string,
        key: keyof Pick<SmartSearchQuery, 'query' | 'tag' | 'mention' | 'fileType'>
    ): void {
        const row = container.createDiv({ cls: 'collaborative-smart-search-row' });
        row.createEl('label', { text: label });
        const input = row.createEl('input', { type: 'text' });
        input.placeholder = placeholder;
        input.value = this.query[key];
        input.addEventListener('input', () => {
            this.query[key] = input.value;
            this.renderResults();
        });
    }

    private createDateInput(
        container: HTMLElement,
        label: string,
        key: keyof Pick<SmartSearchQuery, 'startDate' | 'endDate'>
    ): void {
        const row = container.createDiv({ cls: 'collaborative-smart-search-row' });
        row.createEl('label', { text: label });
        const input = row.createEl('input', { type: 'date' });
        input.value = this.query[key];
        input.addEventListener('input', () => {
            this.query[key] = input.value;
            this.renderResults();
        });
    }

    private createCheckbox(
        container: HTMLElement,
        label: string,
        key: keyof Pick<SmartSearchQuery, 'caseSensitive'>
    ): void {
        const row = container.createDiv({ cls: 'collaborative-smart-search-row' });
        const labelEl = row.createEl('label', { text: label });
        const input = labelEl.createEl('input', { type: 'checkbox' });
        input.checked = this.query[key];
        input.addEventListener('change', () => {
            this.query[key] = input.checked;
            this.renderResults();
        });
    }

    private renderResults(): void {
        if (!this.resultsEl || !this.statsEl) {
            return;
        }

        this.resultsEl.empty();
        const results = this.plugin.searchManager.search(this.query);
        this.statsEl.setText(
            `Indexed files: ${this.plugin.searchManager.getIndexedFileCount()} | Results: ${results.length}`
        );

        if (results.length === 0) {
            this.resultsEl.createEl('p', { text: 'No matching notes found.' });
            return;
        }

        results.slice(0, 100).forEach((result) => {
            this.renderResult(result);
        });
    }

    private renderResult(result: SearchResult): void {
        if (!this.resultsEl) {
            return;
        }

        const card = this.resultsEl.createDiv({
            cls: 'collaborative-smart-search-result',
            attr: {
                style: 'padding: 10px 0; border-top: 1px solid var(--background-modifier-border); cursor: pointer;'
            }
        });

        card.createEl('div', { text: result.entry.title, cls: 'nav-file-title' });
        card.createEl('div', {
            text: `${result.entry.path} | ${result.entry.extension || 'file'} | ${new Date(result.entry.mtime).toLocaleString()}`,
            attr: {
                style: 'font-size: 0.8em; color: var(--text-muted);'
            }
        });

        if (result.entry.tags.length > 0 || result.entry.mentions.length > 0) {
            card.createEl('div', {
                text: [
                    result.entry.tags.length > 0 ? `Tags: ${result.entry.tags.map((tag) => `#${tag}`).join(', ')}` : '',
                    result.entry.mentions.length > 0 ? `Mentions: ${result.entry.mentions.map((mention) => `@${mention}`).join(', ')}` : ''
                ].filter(Boolean).join(' | '),
                attr: {
                    style: 'font-size: 0.8em; color: var(--text-muted); margin-top: 4px;'
                }
            });
        }

        card.createEl('div', {
            text: result.snippet || '(No preview available)',
            attr: {
                style: 'margin-top: 6px; white-space: normal;'
            }
        });

        card.addEventListener('click', async () => {
            const file = this.plugin.app.vault.getAbstractFileByPath(result.entry.path);
            if (!(file instanceof TFile)) {
                new Notice(`File ${result.entry.path} is no longer available.`);
                return;
            }

            await this.plugin.app.workspace.getLeaf().openFile(file);
            this.close();
        });
    }
}
