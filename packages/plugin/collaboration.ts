import { Editor, TFile, WorkspaceLeaf } from 'obsidian';
import { EditorView } from '@codemirror/view';
import * as Y from 'yjs';
import { yCollab } from 'y-codemirror.next';
import { SocketIOProvider } from 'y-socket.io';
import CollaborativePlugin from './main';

export class CollaborationManager {
    plugin: CollaborativePlugin;
    ydoc: Y.Doc;
    provider: SocketIOProvider | null = null;
    activeFile: TFile | null = null;

    constructor(plugin: CollaborativePlugin) {
        this.plugin = plugin;
        this.ydoc = new Y.Doc();
    }

    async joinDocument(file: TFile) {
        if (this.activeFile === file) return;
        this.activeFile = file;

        // Disconnect previous provider if exists
        if (this.provider) {
            this.provider.destroy();
        }

        const token = this.plugin.settings.token;
        if (!token) {
            console.error("No token found, cannot connect to collaboration server");
            return;
        }

        // Room name could be file path or ID. Using file path for MVP.
        // Ideally should use a unique ID from the backend.
        const roomName = file.path;

        this.provider = new SocketIOProvider(
            this.plugin.settings.apiUrl,
            roomName,
            this.ydoc,
            {
                autoConnect: true,
                auth: { token }
            }
        );

        this.provider.on('status', (event: any) => {
            console.log('Collaboration status:', event.status);
        });

        this.provider.on('sync', (isSynced: boolean) => {
            console.log('Yjs synced:', isSynced);
        });

        console.log(`Joined room: ${roomName}`);
    }

    leaveDocument() {
        if (this.provider) {
            this.provider.destroy();
            this.provider = null;
        }
        this.activeFile = null;
        this.ydoc.destroy();
        this.ydoc = new Y.Doc(); // Reset doc
    }

    // Extension for CodeMirror 6 to bind Yjs
    public getExtension() {
        const ytext = this.ydoc.getText('codemirror');
        const userColor = this.getUserColor();
        const userName = this.plugin.settings.user?.display_name || 'Anonymous';

        return yCollab(ytext, this.provider?.awareness, {
            undoManager: new Y.UndoManager(ytext)
        });
    }

    private getUserColor() {
        // Generate a consistent color based on user ID or name
        const str = this.plugin.settings.user?.id || 'default';
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    }
}
