export interface User {
    id: string;
    email: string;
    display_name: string;
}

export type BackupFrequency = 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'manual';

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
}
