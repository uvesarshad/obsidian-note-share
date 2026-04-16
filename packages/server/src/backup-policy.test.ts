import assert from 'node:assert/strict';

import {
    DEFAULT_BACKUP_POLICIES,
    clampBackupPreferencesToPolicy,
    normalizeBackupPolicy,
    parseAllowedFrequencies,
    validateBackupPreferences
} from './backup-policy';

const testParseAllowedFrequencies = () => {
    const parsed = parseAllowedFrequencies('daily,weekly,daily,invalid');
    assert.deepEqual(parsed, ['daily', 'weekly']);
};

const testNormalizeBackupPolicy = () => {
    const normalized = normalizeBackupPolicy('starter', null);
    assert.equal(normalized.planTier, 'starter');
    assert.equal(
        normalized.fullVaultBackupEnabled,
        DEFAULT_BACKUP_POLICIES.starter.fullVaultBackupEnabled
    );
    assert.deepEqual(
        normalized.allowedFrequencies,
        DEFAULT_BACKUP_POLICIES.starter.allowedFrequencies
    );
};

const testRejectsDisallowedFullBackup = () => {
    const policy = normalizeBackupPolicy('free', null);
    const result = validateBackupPreferences(
        { fullVaultBackupEnabled: true, backupFrequency: 'daily' },
        policy
    );

    assert.equal(result.valid, false);
    assert.equal(result.errors[0], 'Full vault backup is not available on your plan.');
};

const testRejectsDisallowedFrequency = () => {
    const policy = normalizeBackupPolicy('starter', null);
    const result = validateBackupPreferences(
        { fullVaultBackupEnabled: true, backupFrequency: 'realtime' },
        policy
    );

    assert.equal(result.valid, false);
    assert.equal(result.errors[0], 'Backup frequency is not allowed on your plan.');
};

const testClampBackupPreferences = () => {
    const freePolicy = normalizeBackupPolicy('free', null);
    const clamped = clampBackupPreferencesToPolicy(
        { fullVaultBackupEnabled: true, backupFrequency: 'realtime' },
        freePolicy
    );

    assert.deepEqual(clamped, {
        fullVaultBackupEnabled: false,
        backupFrequency: 'manual'
    });
};

const run = () => {
    testParseAllowedFrequencies();
    testNormalizeBackupPolicy();
    testRejectsDisallowedFullBackup();
    testRejectsDisallowedFrequency();
    testClampBackupPreferences();
    console.log('backup-policy tests passed');
};

run();
