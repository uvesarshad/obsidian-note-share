import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db';
import { requireAuth } from '../middlewares/auth';
import { requireAdmin } from '../middlewares/admin';
import { parseAllowedFrequencies } from '../backup-policy';

const router = express.Router();

// Middleware to protect all admin routes
router.use(requireAuth, requireAdmin);

// Dashboard Statistics
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const userCount = await query('SELECT COUNT(*) FROM users');
        const vaultCount = await query('SELECT COUNT(*) FROM vaults');
        const fileCount = await query('SELECT COUNT(*) FROM vault_files');

        // Calculate total storage used
        const storageResult = await query('SELECT SUM(storage_used) as total_storage FROM users');

        res.send({
            totalUsers: parseInt(userCount.rows[0].count),
            totalVaults: parseInt(vaultCount.rows[0].count),
            totalFiles: parseInt(fileCount.rows[0].count),
            totalStorage: parseInt(storageResult.rows[0].total_storage || '0')
        });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// List Users
router.get('/users', async (req: Request, res: Response) => {
    try {
        const result = await query(
            `SELECT id, email, display_name, role, created_at, last_login, storage_used, plan_tier 
             FROM users 
             ORDER BY created_at DESC 
             LIMIT 100` // TODO: Pagination
        );
        res.send(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// List backup policies by plan tier
router.get('/backup-policies', async (_req: Request, res: Response) => {
    try {
        const result = await query(
            `SELECT plan_tier, full_vault_backup_enabled, allowed_frequencies, updated_at
             FROM plan_backup_policies
             ORDER BY plan_tier ASC`
        );

        res.send(result.rows.map((row) => ({
            planTier: row.plan_tier,
            fullVaultBackupEnabled: row.full_vault_backup_enabled,
            allowedFrequencies: parseAllowedFrequencies(row.allowed_frequencies),
            updatedAt: row.updated_at
        })));
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// Update a plan-tier backup policy
router.put(
    '/backup-policies/:planTier',
    [
        body('fullVaultBackupEnabled')
            .isBoolean()
            .withMessage('fullVaultBackupEnabled must be a boolean'),
        body('allowedFrequencies')
            .isArray({ min: 1 })
            .withMessage('allowedFrequencies must be a non-empty array')
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const planTier = req.params.planTier.toLowerCase();
        const requestedFrequencies = Array.isArray(req.body.allowedFrequencies)
            ? req.body.allowedFrequencies.join(',')
            : '';
        const parsedFrequencies = parseAllowedFrequencies(requestedFrequencies);

        if (parsedFrequencies.length === 0) {
            return res.status(400).send({ error: 'allowedFrequencies has no valid values' });
        }

        try {
            await query(
                `INSERT INTO plan_backup_policies (plan_tier, full_vault_backup_enabled, allowed_frequencies)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (plan_tier)
                 DO UPDATE SET
                    full_vault_backup_enabled = EXCLUDED.full_vault_backup_enabled,
                    allowed_frequencies = EXCLUDED.allowed_frequencies,
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    planTier,
                    req.body.fullVaultBackupEnabled,
                    parsedFrequencies.join(',')
                ]
            );

            res.send({
                success: true,
                planTier,
                fullVaultBackupEnabled: req.body.fullVaultBackupEnabled,
                allowedFrequencies: parsedFrequencies
            });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: 'Internal Server Error' });
        }
    }
);

export { router as adminRouter };
