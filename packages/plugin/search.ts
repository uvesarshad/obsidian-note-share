import { Notice, TAbstractFile, TFile } from 'obsidian';
import CollaborativePlugin from './main';
import { SearchIndexEntry, SearchResult, SmartSearchQuery } from './types';

const SUPPORTED_TEXT_EXTENSIONS = new Set([
    'md',
    'markdown',
    'txt',
    'json',
    'js',
    'jsx',
    'ts',
    'tsx',
    'css',
    'scss',
    'html',
    'xml',
    'yml',
    'yaml',
    'csv',
    'sql',
    'log'
]);

const MAX_INDEXED_FILE_BYTES = 1024 * 1024;

export class SearchManager {
    private readonly plugin: CollaborativePlugin;
    private rebuilding = false;

    constructor(plugin: CollaborativePlugin) {
        this.plugin = plugin;
    }

    registerEvents(): void {
        this.plugin.registerEvent(
            this.plugin.app.vault.on('create', async (file: TAbstractFile) => {
                if (file instanceof TFile) {
                    await this.indexFile(file);
                }
            })
        );

        this.plugin.registerEvent(
            this.plugin.app.vault.on('modify', async (file: TAbstractFile) => {
                if (file instanceof TFile) {
                    await this.indexFile(file);
                }
            })
        );

        this.plugin.registerEvent(
            this.plugin.app.vault.on('rename', async (file: TAbstractFile, oldPath: string) => {
                this.removeEntry(oldPath);
                if (file instanceof TFile) {
                    await this.indexFile(file);
                }
            })
        );

        this.plugin.registerEvent(
            this.plugin.app.vault.on('delete', async (file: TAbstractFile) => {
                this.removeEntry(file.path);
                await this.plugin.saveSettings();
            })
        );
    }

    async ensureIndexReady(): Promise<void> {
        if (this.getIndexEntries().length > 0) {
            return;
        }

        await this.rebuildIndex(false);
    }

    async rebuildIndex(notify = true): Promise<void> {
        if (this.rebuilding) {
            if (notify) {
                new Notice('Search index rebuild is already running.');
            }
            return;
        }

        this.rebuilding = true;
        const notice = notify ? new Notice('Rebuilding smart search index...', 0) : null;

        try {
            const nextIndex: Record<string, SearchIndexEntry> = {};
            let indexedCount = 0;

            for (const file of this.plugin.app.vault.getFiles()) {
                const entry = await this.buildEntry(file);
                if (!entry) {
                    continue;
                }

                nextIndex[file.path] = entry;
                indexedCount += 1;
            }

            this.plugin.settings.searchIndex = nextIndex;
            this.plugin.settings.searchIndexBuiltAt = Date.now();
            await this.plugin.saveSettings();

            notice?.hide();
            if (notify) {
                new Notice(`Smart search indexed ${indexedCount} files.`);
            }
        } catch (error) {
            console.error('Failed to rebuild smart search index', error);
            notice?.hide();
            if (notify) {
                new Notice('Failed to rebuild smart search index.');
            }
        } finally {
            this.rebuilding = false;
        }
    }

    async indexFile(file: TFile): Promise<void> {
        const entry = await this.buildEntry(file);
        if (!entry) {
            if (this.removeEntry(file.path)) {
                await this.plugin.saveSettings();
            }
            return;
        }

        this.plugin.settings.searchIndex[file.path] = entry;
        this.plugin.settings.searchIndexBuiltAt = Date.now();
        await this.plugin.saveSettings();
    }

    search(query: SmartSearchQuery): SearchResult[] {
        const trimmedQuery = query.query.trim();
        const normalizedTag = query.tag.trim().replace(/^#/, '').toLowerCase();
        const normalizedMention = query.mention.trim().replace(/^@/, '').toLowerCase();
        const normalizedFileType = query.fileType.trim().replace(/^\./, '').toLowerCase();
        const queryTerms = trimmedQuery.length > 0 ? trimmedQuery.split(/\s+/).filter(Boolean) : [];
        const startTime = query.startDate ? Date.parse(`${query.startDate}T00:00:00`) : null;
        const endTime = query.endDate ? Date.parse(`${query.endDate}T23:59:59`) : null;

        const results = this.getIndexEntries()
            .filter((entry) => {
                if (normalizedTag.length > 0 && !entry.tags.some((tag) => tag.toLowerCase() === normalizedTag)) {
                    return false;
                }

                if (normalizedMention.length > 0 && !entry.mentions.some((mention) => mention.toLowerCase() === normalizedMention)) {
                    return false;
                }

                if (normalizedFileType.length > 0 && entry.extension.toLowerCase() !== normalizedFileType) {
                    return false;
                }

                if (startTime !== null && entry.mtime < startTime) {
                    return false;
                }

                if (endTime !== null && entry.mtime > endTime) {
                    return false;
                }

                if (queryTerms.length === 0) {
                    return true;
                }

                const haystack = this.buildSearchableText(entry, query.caseSensitive);
                return queryTerms.every((term) => haystack.includes(query.caseSensitive ? term : term.toLowerCase()));
            })
            .map((entry) => {
                const score = this.scoreEntry(entry, queryTerms, query.caseSensitive);
                return {
                    entry,
                    snippet: this.buildSnippet(entry, trimmedQuery, query.caseSensitive),
                    score
                };
            })
            .sort((left, right) => {
                if (right.score !== left.score) {
                    return right.score - left.score;
                }

                return right.entry.mtime - left.entry.mtime;
            });

        return results;
    }

    getIndexedFileCount(): number {
        return this.getIndexEntries().length;
    }

    private getIndexEntries(): SearchIndexEntry[] {
        return Object.values(this.plugin.settings.searchIndex || {});
    }

    private removeEntry(path: string): boolean {
        if (!this.plugin.settings.searchIndex[path]) {
            return false;
        }

        delete this.plugin.settings.searchIndex[path];
        this.plugin.settings.searchIndexBuiltAt = Date.now();
        return true;
    }

    private async buildEntry(file: TFile): Promise<SearchIndexEntry | null> {
        if (!this.shouldIndexFile(file)) {
            return null;
        }

        try {
            const content = await this.plugin.app.vault.cachedRead(file);
            const tags = this.extractMatches(content, /(^|\s)#([A-Za-z0-9/_-]+)/g);
            const mentions = this.extractMatches(content, /(^|\s)@([A-Za-z0-9/_-]+)/g);

            return {
                path: file.path,
                title: file.basename,
                extension: file.extension || '',
                mtime: file.stat.mtime,
                tags,
                mentions,
                content
            };
        } catch (error) {
            console.error(`Failed to index ${file.path}`, error);
            return null;
        }
    }

    private shouldIndexFile(file: TFile): boolean {
        if (file.stat.size > MAX_INDEXED_FILE_BYTES) {
            return false;
        }

        const extension = (file.extension || '').toLowerCase();
        return SUPPORTED_TEXT_EXTENSIONS.has(extension);
    }

    private extractMatches(content: string, pattern: RegExp): string[] {
        const matches = new Set<string>();
        let result: RegExpExecArray | null = null;
        while ((result = pattern.exec(content)) !== null) {
            matches.add(result[2]);
        }

        return [...matches];
    }

    private buildSearchableText(entry: SearchIndexEntry, caseSensitive: boolean): string {
        const source = [
            entry.title,
            entry.path,
            entry.extension,
            entry.tags.join(' '),
            entry.mentions.join(' '),
            entry.content
        ].join('\n');

        return caseSensitive ? source : source.toLowerCase();
    }

    private scoreEntry(entry: SearchIndexEntry, queryTerms: string[], caseSensitive: boolean): number {
        if (queryTerms.length === 0) {
            return 0;
        }

        const title = caseSensitive ? entry.title : entry.title.toLowerCase();
        const path = caseSensitive ? entry.path : entry.path.toLowerCase();
        const content = caseSensitive ? entry.content : entry.content.toLowerCase();
        const tags = entry.tags.map((tag) => caseSensitive ? tag : tag.toLowerCase());
        const mentions = entry.mentions.map((mention) => caseSensitive ? mention : mention.toLowerCase());

        let score = 0;
        for (const rawTerm of queryTerms) {
            const term = caseSensitive ? rawTerm : rawTerm.toLowerCase();
            if (title.includes(term)) {
                score += 6;
            }
            if (path.includes(term)) {
                score += 4;
            }
            if (tags.some((tag) => tag.includes(term))) {
                score += 3;
            }
            if (mentions.some((mention) => mention.includes(term))) {
                score += 3;
            }
            if (content.includes(term)) {
                score += 2;
            }
        }

        return score;
    }

    private buildSnippet(entry: SearchIndexEntry, query: string, caseSensitive: boolean): string {
        const source = entry.content.replace(/\s+/g, ' ').trim();
        if (source.length === 0) {
            return '';
        }

        const trimmedQuery = query.trim();
        if (trimmedQuery.length === 0) {
            return source.slice(0, 180);
        }

        const haystack = caseSensitive ? source : source.toLowerCase();
        const needle = caseSensitive ? trimmedQuery : trimmedQuery.toLowerCase();
        const index = haystack.indexOf(needle);

        if (index === -1) {
            return source.slice(0, 180);
        }

        const start = Math.max(0, index - 60);
        const end = Math.min(source.length, index + trimmedQuery.length + 120);
        const prefix = start > 0 ? '...' : '';
        const suffix = end < source.length ? '...' : '';
        return `${prefix}${source.slice(start, end)}${suffix}`;
    }
}
