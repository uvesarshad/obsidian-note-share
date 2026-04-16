import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db';
import { requireAuth } from '../middlewares/auth';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Upload a file (encrypted content)
router.post(
    '/upload',
    requireAuth,
    [
        body('path').notEmpty().withMessage('File path is required'),
        body('content').notEmpty().withMessage('Encrypted content is required'),
        // body('iv').notEmpty().withMessage('Initialization vector is required'), // Storing IV with content or separately?
        // For simplicity, let's assume content includes IV or is handled by client packing for now, 
        // OR we add IV column. Schema has `encrypted_content_url` (text). 
        // Let's store JSON string of {iv, data} in encrypted_content_url for now or just the data string if IV is prepended.
        // implementation_plan says "encrypted blobs". 
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { path, content, fileHash, version } = req.body;
        const userId = req.currentUser!.id;

        try {
            // Find vault for user (Single vault for MVP? or pass vaultId)
            // Assuming single default vault for now or first one found.
            let vaultResult = await query('SELECT id FROM vaults WHERE user_id = $1 LIMIT 1', [userId]);
            let vaultId;

            if (vaultResult.rows.length === 0) {
                // Create default vault
                const newVault = await query(
                    'INSERT INTO vaults (user_id, name) VALUES ($1, $2) RETURNING id',
                    [userId, 'Default Vault']
                );
                vaultId = newVault.rows[0].id;
            } else {
                vaultId = vaultResult.rows[0].id;
            }

            // Upsert file
            const existingFile = await query(
                'SELECT id FROM vault_files WHERE vault_id = $1 AND file_path = $2',
                [vaultId, path]
            );

            if (existingFile.rows.length > 0) {
                await query(
                    `UPDATE vault_files 
                     SET encrypted_content_url = $1, file_hash = $2, updated_at = CURRENT_TIMESTAMP 
                     WHERE id = $3`,
                    [content, fileHash, existingFile.rows[0].id]
                );
            } else {
                await query(
                    `INSERT INTO vault_files (vault_id, file_path, encrypted_content_url, file_hash) 
                     VALUES ($1, $2, $3, $4)`,
                    [vaultId, path, content, fileHash]
                );
            }

            res.status(200).send({ success: true });

        } catch (err) {
            console.error(err);
            res.status(500).send({ error: 'Internal Server Error' });
        }
    }
);

// Share a file and assign default owner role permission
router.post(
    '/share',
    requireAuth,
    [
        body('path').notEmpty().withMessage('File path is required'),
        body('permissionType')
            .isIn(['public_view', 'public_edit', 'private'])
            .withMessage('permissionType must be public_view, public_edit, or private')
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.currentUser!.id;
        const { path, permissionType } = req.body;

        try {
            const fileResult = await query(
                `SELECT f.id, f.file_path
                 FROM vault_files f
                 JOIN vaults v ON f.vault_id = v.id
                 WHERE v.user_id = $1 AND f.file_path = $2
                 LIMIT 1`,
                [userId, path]
            );

            if (fileResult.rows.length === 0) {
                return res.status(404).send({ error: 'File not found in your vault. Sync it first.' });
            }

            const existingShareResult = await query(
                `SELECT id, share_token
                 FROM shared_documents
                 WHERE file_id = $1 AND owner_id = $2
                 LIMIT 1`,
                [fileResult.rows[0].id, userId]
            );

            let sharedDocumentId = '';
            let shareToken = '';

            if (existingShareResult.rows.length > 0) {
                sharedDocumentId = existingShareResult.rows[0].id;
                shareToken = existingShareResult.rows[0].share_token;

                await query(
                    `UPDATE shared_documents
                     SET permission_type = $1
                     WHERE id = $2`,
                    [permissionType, sharedDocumentId]
                );
            } else {
                shareToken = uuidv4();
                const sharedDocumentResult = await query(
                    `INSERT INTO shared_documents (file_id, owner_id, share_token, permission_type)
                     VALUES ($1, $2, $3, $4)
                     RETURNING id`,
                    [fileResult.rows[0].id, userId, shareToken, permissionType]
                );
                sharedDocumentId = sharedDocumentResult.rows[0].id;
            }

            const existingOwnerPermission = await query(
                `SELECT id
                 FROM document_permissions
                 WHERE shared_document_id = $1 AND user_id = $2 AND role = $3
                 LIMIT 1`,
                [sharedDocumentId, userId, 'owner']
            );

            if (existingOwnerPermission.rows.length === 0) {
                await query(
                    `INSERT INTO document_permissions (shared_document_id, user_id, role, granted_by)
                     VALUES ($1, $2, $3, $4)`,
                    [sharedDocumentId, userId, 'owner', userId]
                );
            }

            res.send({
                success: true,
                path,
                permissionType,
                role: 'owner',
                shareToken
            });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: 'Internal Server Error' });
        }
    }
);

// List files shared by user or shared with user
router.get('/shared', requireAuth, async (req: Request, res: Response) => {
    const userId = req.currentUser!.id;

    try {
        const result = await query(
            `SELECT * FROM (
                SELECT
                    vf.file_path AS path,
                    sd.permission_type AS permission_type,
                    'owner'::text AS role,
                    sd.share_token AS share_token,
                    true AS is_owner
                FROM shared_documents sd
                JOIN vault_files vf ON sd.file_id = vf.id
                WHERE sd.owner_id = $1

                UNION ALL

                SELECT
                    vf.file_path AS path,
                    sd.permission_type AS permission_type,
                    dp.role AS role,
                    sd.share_token AS share_token,
                    false AS is_owner
                FROM document_permissions dp
                JOIN shared_documents sd ON dp.shared_document_id = sd.id
                JOIN vault_files vf ON sd.file_id = vf.id
                WHERE dp.user_id = $1 AND sd.owner_id <> $1
            ) shared
            ORDER BY path ASC`,
            [userId]
        );

        res.send(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// Return share status for one file path visible to user
router.get('/shared-status', requireAuth, async (req: Request, res: Response) => {
    const userId = req.currentUser!.id;
    const path = req.query.path as string;

    if (!path) {
        return res.status(400).send({ error: 'Query param path is required' });
    }

    try {
        const result = await query(
            `SELECT * FROM (
                SELECT
                    vf.file_path AS path,
                    sd.permission_type AS permission_type,
                    'owner'::text AS role,
                    sd.share_token AS share_token,
                    true AS is_owner
                FROM shared_documents sd
                JOIN vault_files vf ON sd.file_id = vf.id
                WHERE sd.owner_id = $1 AND vf.file_path = $2

                UNION ALL

                SELECT
                    vf.file_path AS path,
                    sd.permission_type AS permission_type,
                    dp.role AS role,
                    sd.share_token AS share_token,
                    false AS is_owner
                FROM document_permissions dp
                JOIN shared_documents sd ON dp.shared_document_id = sd.id
                JOIN vault_files vf ON sd.file_id = vf.id
                WHERE dp.user_id = $1 AND vf.file_path = $2
            ) shared
            ORDER BY is_owner DESC
            LIMIT 1`,
            [userId, path]
        );

        if (result.rows.length === 0) {
            return res.send({ isShared: false });
        }

        res.send({
            isShared: true,
            path: result.rows[0].path,
            permissionType: result.rows[0].permission_type,
            role: result.rows[0].role,
            shareToken: result.rows[0].share_token,
            isOwner: result.rows[0].is_owner
        });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// List files
router.get('/list', requireAuth, async (req: Request, res: Response) => {
    const userId = req.currentUser!.id;
    try {
        const result = await query(
            `SELECT f.file_path, f.updated_at 
             FROM vault_files f 
             JOIN vaults v ON f.vault_id = v.id 
             WHERE v.user_id = $1 AND f.deleted_at IS NULL`,
            [userId]
        );
        res.send(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// Download a file
router.post('/download', requireAuth, async (req: Request, res: Response) => {
    const userId = req.currentUser!.id;
    const { path } = req.body;

    try {
        const result = await query(
            `SELECT f.encrypted_content_url 
             FROM vault_files f 
             JOIN vaults v ON f.vault_id = v.id 
             WHERE v.user_id = $1 AND f.file_path = $2`,
            [userId, path]
        );

        if (result.rows.length === 0) {
            return res.status(404).send({ error: 'File not found' });
        }

        res.send({ content: result.rows[0].encrypted_content_url });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

export { router as filesRouter };
