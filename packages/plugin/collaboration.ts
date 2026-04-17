import { TFile } from 'obsidian';
import * as Y from 'yjs';
import { yCollab } from 'y-codemirror.next';
import { SocketIOProvider } from 'y-socket.io';
import CollaborativePlugin from './main';

export class CollaborationManager {
    plugin: CollaborativePlugin;
    ydoc: Y.Doc;
    provider: SocketIOProvider | null = null;
    activeFile: TFile | null = null;
    private connectionStatus = 'disconnected';
    private activeFileId: string | null = null;
    private lastErrorMessage = '';

    constructor(plugin: CollaborativePlugin) {
        this.plugin = plugin;
        this.ydoc = new Y.Doc();
    }

    async joinDocument(file: TFile) {
        if (this.activeFile === file) return;
        this.activeFile = file;

        if (this.provider) {
            this.provider.destroy();
        }

        const token = this.plugin.settings.token;
        if (!token) {
            this.setConnectionStatus('signed out', null);
            return;
        }

        const remoteFile = await this.plugin.syncManager.ensureRemoteFileRecord(file, {
            uploadIfMissing: true
        });
        if (!remoteFile) {
            this.setConnectionStatus('unavailable', null, 'File is not synced yet.');
            return;
        }

        const roomName = remoteFile.id;
        this.activeFileId = remoteFile.id;
        this.setConnectionStatus('connecting', remoteFile.id);

        this.provider = new SocketIOProvider(
            this.plugin.settings.apiUrl,
            roomName,
            this.ydoc,
            {
                autoConnect: true,
                auth: {
                    token,
                    fileId: remoteFile.id
                }
            }
        );

        this.provider.awareness.setLocalStateField('user', {
            id: this.plugin.settings.user?.id || 'anonymous',
            name: this.plugin.settings.user?.display_name || 'Anonymous',
            color: this.getUserColor()
        });

        this.provider.on('status', (event: any) => {
            console.log('Collaboration status:', event.status);
            this.setConnectionStatus(event.status, remoteFile.id);
        });

        this.provider.on('sync', (isSynced: boolean) => {
            console.log('Yjs synced:', isSynced);
        });

        this.provider.on('connection-error', (event: unknown) => {
            console.error('Collaboration connection error:', event);
            this.setConnectionStatus('error', remoteFile.id, String(event));
        });

        console.log(`Joined room: ${roomName}`);
    }

    leaveDocument() {
        if (this.provider) {
            this.provider.destroy();
            this.provider = null;
        }
        this.activeFile = null;
        this.activeFileId = null;
        this.ydoc.destroy();
        this.ydoc = new Y.Doc(); // Reset doc
        this.setConnectionStatus('disconnected', null);
    }

    public getExtension() {
        const ytext = this.ydoc.getText('codemirror');

        return yCollab(ytext, this.provider?.awareness, {
            undoManager: new Y.UndoManager(ytext)
        });
    }

    getConnectionStatusSummary(): string {
        const suffix = this.activeFileId ? ` (${this.activeFileId.slice(0, 8)})` : '';
        if (this.connectionStatus === 'error' && this.lastErrorMessage) {
            return `Error${suffix}: ${this.lastErrorMessage}`;
        }

        return `${this.connectionStatus}${suffix}`;
    }

    private getUserColor() {
        const str = this.plugin.settings.user?.id || 'default';
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    }

    private setConnectionStatus(status: string, fileId: string | null, errorMessage = ''): void {
        this.connectionStatus = status;
        this.activeFileId = fileId;
        this.lastErrorMessage = errorMessage;
        this.plugin.refreshSettingsDisplay();
    }
}
