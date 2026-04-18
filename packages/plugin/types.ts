export interface User {
    id: string;
    email: string;
    display_name: string;
}

export type BackupFrequency = 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'manual';

export interface SyncFileState {
    lastUploadedAt: number;
    lastUploadedHash: string;
}

export interface RemoteFileRecord {
    id: string;
    path: string;
    fileHash: string | null;
    version: number;
    updatedAt: string;
}

export interface SearchIndexEntry {
    path: string;
    title: string;
    extension: string;
    mtime: number;
    tags: string[];
    mentions: string[];
    content: string;
}

export interface SmartSearchQuery {
    query: string;
    tag: string;
    mention: string;
    fileType: string;
    startDate: string;
    endDate: string;
    caseSensitive: boolean;
}

export interface SearchResult {
    entry: SearchIndexEntry;
    snippet: string;
    score: number;
}

export interface CollaborativeSettings {
    apiUrl: string;
    token: string;
    user: User | null;
    syncFolders: string[];
    syncExcludedFolders: string[];
    syncFrequency: BackupFrequency;
    syncPaused: boolean;
    backupFrequency: BackupFrequency;
    fullVaultBackupEnabled: boolean;
    backupAllowedFrequencies: BackupFrequency[];
    planAllowsFullVaultBackup: boolean;
    planManagementUrl: string;
    encryptionSalt: string;
    encryptionUserId: string;
    encryptionVerifier: {
        iv: string;
        data: string;
    } | null;
    syncStateUserId: string;
    syncState: Record<string, SyncFileState>;
    searchIndexBuiltAt: number;
    searchIndex: Record<string, SearchIndexEntry>;
}
