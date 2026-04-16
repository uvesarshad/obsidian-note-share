import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db';
import { requireAuth } from '../middlewares/auth';
import {
    BackupFrequency,
    BackupPreferences,
    clampBackupPreferencesToPolicy,
    normalizeBackupPolicy,
    validateBackupPreferences
} from '../backup-policy';

const router = express.Router();

const getUserPlanTier = async (userId: string): Promise<string> => {
    const userResult = await query('SELECT plan_tier FROM users WHERE id = $1', [userId]);
    return userResult.rows[0]?.plan_tier || 'free';
};

const getPolicyForPlan = async (planTier: string) => {
    const policyResult = await query(
        'SELECT full_vault_backup_enabled, allowed_frequencies FROM plan_backup_policies WHERE plan_tier = $1',
        [planTier]
    );
    return normalizeBackupPolicy(planTier, policyResult.rows[0] || null);
};

const getRawUserPreferences = async (userId: string): Promise<BackupPreferences> => {
    const preferencesResult = await query(
        `SELECT full_vault_backup_enabled, backup_frequency
         FROM user_backup_preferences
         WHERE user_id = $1`,
        [userId]
    );

    if (preferencesResult.rows.length === 0) {
        return {
            fullVaultBackupEnabled: false,
            backupFrequency: 'manual'
        };
    }

    return {
        fullVaultBackupEnabled: !!preferencesResult.rows[0].full_vault_backup_enabled,
        backupFrequency: (preferencesResult.rows[0].backup_frequency || 'manual') as BackupFrequency
    };
};

router.get('/preferences', requireAuth, async (req: Request, res: Response) => {
    const userId = req.currentUser!.id;

    try {
        const planTier = await getUserPlanTier(userId);
        const policy = await getPolicyForPlan(planTier);
        const rawPreferences = await getRawUserPreferences(userId);
        const effectivePreferences = clampBackupPreferencesToPolicy(rawPreferences, policy);

        res.send({
            planTier,
            policy: {
                fullVaultBackupEnabled: policy.fullVaultBackupEnabled,
                allowedFrequencies: policy.allowedFrequencies
            },
            preferences: effectivePreferences
        });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

router.put(
    '/preferences',
    requireAuth,
    [
        body('fullVaultBackupEnabled')
            .isBoolean()
            .withMessage('fullVaultBackupEnabled must be a boolean'),
        body('backupFrequency')
            .isString()
            .withMessage('backupFrequency must be a string')
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.currentUser!.id;

        try {
            const planTier = await getUserPlanTier(userId);
            const policy = await getPolicyForPlan(planTier);
            const requestedPreferences: BackupPreferences = {
                fullVaultBackupEnabled: req.body.fullVaultBackupEnabled,
                backupFrequency: req.body.backupFrequency as BackupFrequency
            };

            const validation = validateBackupPreferences(requestedPreferences, policy);
            if (!validation.valid) {
                return res.status(400).send({ errors: validation.errors });
            }

            await query(
                `INSERT INTO user_backup_preferences (user_id, full_vault_backup_enabled, backup_frequency)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (user_id)
                 DO UPDATE SET
                    full_vault_backup_enabled = EXCLUDED.full_vault_backup_enabled,
                    backup_frequency = EXCLUDED.backup_frequency,
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    userId,
                    requestedPreferences.fullVaultBackupEnabled,
                    requestedPreferences.backupFrequency
                ]
            );

            res.send({
                success: true,
                planTier,
                preferences: requestedPreferences
            });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: 'Internal Server Error' });
        }
    }
);

// --- Vault Config Backups ---

router.post(
    '/upload',
    requireAuth,
    [
        body('configBlob').notEmpty().withMessage('Config blob is required and must be an encrypted payload')
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.currentUser!.id;
        const { configBlob } = req.body;

        try {
            // Check plan tier and preferences to ensure they have this feature enabled
            const rawPreferences = await getRawUserPreferences(userId);
            if (!rawPreferences.fullVaultBackupEnabled) {
                return res.status(403).send({ error: 'Full vault backups are disabled in your preferences.' });
            }

            // Get user's default vault
            let vaultResult = await query('SELECT id FROM vaults WHERE user_id = $1 LIMIT 1', [userId]);
            if (vaultResult.rows.length === 0) {
                return res.status(404).send({ error: 'Vault not found. Please sync files first.' });
            }
            const vaultId = vaultResult.rows[0].id;

            await query(
                `INSERT INTO vault_backups (vault_id, encrypted_config_blob) VALUES ($1, $2)`,
                [vaultId, configBlob]
            );

            res.send({ success: true, message: 'Vault configuration backed up successfully.' });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: 'Internal Server Error' });
        }
    }
);

router.get('/latest', requireAuth, async (req: Request, res: Response) => {
    const userId = req.currentUser!.id;

    try {
        let vaultResult = await query('SELECT id FROM vaults WHERE user_id = $1 LIMIT 1', [userId]);
        if (vaultResult.rows.length === 0) {
            return res.status(404).send({ error: 'Vault not found.' });
        }
        const vaultId = vaultResult.rows[0].id;

        const backupResult = await query(
            `SELECT encrypted_config_blob, created_at FROM vault_backups WHERE vault_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [vaultId]
        );

        if (backupResult.rows.length === 0) {
            return res.status(404).send({ error: 'No backups found for this vault.' });
        }

        res.send({
            success: true,
            createdAt: backupResult.rows[0].created_at,
            configBlob: backupResult.rows[0].encrypted_config_blob
        });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

export { router as backupRouter };
