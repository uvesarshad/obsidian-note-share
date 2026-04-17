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

export interface CollaborativeSettings {
    apiUrl: string;
    token: string;
    user: User | null;
    syncFolders: string[];
    syncExcludedFolders: string[];
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
}
