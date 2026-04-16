export type BackupFrequency = 'manual' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'realtime';

export interface BackupPolicy {
    planTier: string;
    fullVaultBackupEnabled: boolean;
    allowedFrequencies: BackupFrequency[];
}

export interface BackupPreferences {
    fullVaultBackupEnabled: boolean;
    backupFrequency: BackupFrequency;
}

interface RawBackupPolicyRow {
    full_vault_backup_enabled?: boolean | null;
    allowed_frequencies?: string | null;
}

const VALID_FREQUENCIES: BackupFrequency[] = ['manual', 'hourly', 'daily', 'weekly', 'monthly', 'realtime'];

export const DEFAULT_BACKUP_POLICIES: Record<string, Omit<BackupPolicy, 'planTier'>> = {
    free: {
        fullVaultBackupEnabled: false,
        allowedFrequencies: ['manual', 'daily']
    },
    starter: {
        fullVaultBackupEnabled: true,
        allowedFrequencies: ['manual', 'daily', 'weekly']
    },
    pro: {
        fullVaultBackupEnabled: true,
        allowedFrequencies: ['manual', 'hourly', 'daily', 'weekly', 'realtime']
    },
    teams: {
        fullVaultBackupEnabled: true,
        allowedFrequencies: ['manual', 'hourly', 'daily', 'weekly', 'realtime']
    }
};

const normalizeFrequency = (value: string): BackupFrequency | null => {
    const normalized = value.trim().toLowerCase() as BackupFrequency;
    return VALID_FREQUENCIES.includes(normalized) ? normalized : null;
};

export const parseAllowedFrequencies = (raw: string | null | undefined): BackupFrequency[] => {
    if (!raw) {
        return [];
    }

    const unique = new Set<BackupFrequency>();
    for (const part of raw.split(',')) {
        const normalized = normalizeFrequency(part);
        if (normalized) {
            unique.add(normalized);
        }
    }

    return [...unique];
};

export const normalizeBackupPolicy = (
    planTier: string,
    row: RawBackupPolicyRow | null
): BackupPolicy => {
    const defaultPolicy = DEFAULT_BACKUP_POLICIES[planTier] || DEFAULT_BACKUP_POLICIES.free;
    const frequenciesFromRow = parseAllowedFrequencies(row?.allowed_frequencies);
    const allowedFrequencies = frequenciesFromRow.length > 0
        ? frequenciesFromRow
        : defaultPolicy.allowedFrequencies;

    return {
        planTier,
        fullVaultBackupEnabled: row?.full_vault_backup_enabled ?? defaultPolicy.fullVaultBackupEnabled,
        allowedFrequencies
    };
};

export const validateBackupPreferences = (
    preferences: BackupPreferences,
    policy: BackupPolicy
): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (preferences.fullVaultBackupEnabled && !policy.fullVaultBackupEnabled) {
        errors.push('Full vault backup is not available on your plan.');
    }

    if (!policy.allowedFrequencies.includes(preferences.backupFrequency)) {
        errors.push('Backup frequency is not allowed on your plan.');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

export const clampBackupPreferencesToPolicy = (
    preferences: BackupPreferences,
    policy: BackupPolicy
): BackupPreferences => {
    const fallbackFrequency = policy.allowedFrequencies.includes('manual')
        ? 'manual'
        : policy.allowedFrequencies[0];
    const backupFrequency = policy.allowedFrequencies.includes(preferences.backupFrequency)
        ? preferences.backupFrequency
        : (fallbackFrequency || 'manual');

    return {
        fullVaultBackupEnabled: policy.fullVaultBackupEnabled && preferences.fullVaultBackupEnabled,
        backupFrequency
    };
};
