import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db';
import { requireAuth } from '../middlewares/auth';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

interface ResolvedFileRow {
    id: string;
    file_path: string;
    file_hash: string | null;
    version: number | null;
    updated_at: string;
}

interface SharedStatusRow {
    file_id: string;
    path: string;
    permission_type: 'public_view' | 'public_edit' | 'private';
    role: string;
    share_token: string;
    is_owner: boolean;
}

const ensureLookupProvided = (fileId?: string, path?: string): string | null => {
    if (!fileId && !path) {
        return 'Either fileId or path is required.';
    }

    return null;
};

const formatResolvedFile = (row: ResolvedFileRow) => ({
    id: row.id,
    path: row.file_path,
    fileHash: row.file_hash,
    version: row.version ?? 1,
    updatedAt: row.updated_at
});

const getOrCreateUserVaultId = async (userId: string): Promise<string> => {
    const vaultResult = await query('SELECT id FROM vaults WHERE user_id = $1 LIMIT 1', [userId]);
    if (vaultResult.rows.length > 0) {
        return vaultResult.rows[0].id;
    }

    const newVault = await query(
        'INSERT INTO vaults (user_id, name) VALUES ($1, $2) RETURNING id',
        [userId, 'Default Vault']
    );
    return newVault.rows[0].id;
};

const resolveOwnedFile = async (
    userId: string,
    lookup: { fileId?: string; path?: string }
): Promise<ResolvedFileRow | null> => {
    if (lookup.fileId) {
        const result = await query(
            `SELECT f.id, f.file_path, f.file_hash, f.version, f.updated_at
             FROM vault_files f
             JOIN vaults v ON f.vault_id = v.id
             WHERE v.user_id = $1 AND f.id = $2
             LIMIT 1`,
            [userId, lookup.fileId]
        );
        return result.rows[0] || null;
    }

    if (!lookup.path) {
        return null;
    }

    const result = await query(
        `SELECT f.id, f.file_path, f.file_hash, f.version, f.updated_at
         FROM vault_files f
         JOIN vaults v ON f.vault_id = v.id
         WHERE v.user_id = $1 AND f.file_path = $2
         LIMIT 1`,
        [userId, lookup.path]
    );
    return result.rows[0] || null;
};

const resolveVisibleSharedStatus = async (
    userId: string,
    lookup: { fileId?: string; path?: string }
): Promise<SharedStatusRow | null> => {
    if (lookup.fileId) {
        const result = await query(
            `SELECT * FROM (
                SELECT
                    vf.id AS file_id,
                    vf.file_path AS path,
                    sd.permission_type AS permission_type,
                    'owner'::text AS role,
                    sd.share_token AS share_token,
                    true AS is_owner
                FROM shared_documents sd
                JOIN vault_files vf ON sd.file_id = vf.id
                WHERE sd.owner_id = $1 AND vf.id = $2

                UNION ALL

                SELECT
                    vf.id AS file_id,
                    vf.file_path AS path,
                    sd.permission_type AS permission_type,
                    dp.role AS role,
                    sd.share_token AS share_token,
                    false AS is_owner
                FROM document_permissions dp
                JOIN shared_documents sd ON dp.shared_document_id = sd.id
                JOIN vault_files vf ON sd.file_id = vf.id
                WHERE dp.user_id = $1 AND vf.id = $2
            ) shared
            ORDER BY is_owner DESC
            LIMIT 1`,
            [userId, lookup.fileId]
        );
        return result.rows[0] || null;
    }

    if (!lookup.path) {
        return null;
    }

    const result = await query(
        `SELECT * FROM (
            SELECT
                vf.id AS file_id,
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
                vf.id AS file_id,
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
        [userId, lookup.path]
    );
    return result.rows[0] || null;
};

// Resolve one file by stable ID or path
router.post('/resolve', requireAuth, async (req: Request, res: Response) => {
    const userId = req.currentUser!.id;
    const { fileId, path } = req.body as { fileId?: string; path?: string };
    const lookupError = ensureLookupProvided(fileId, path);

    if (lookupError) {
        return res.status(400).send({ error: lookupError });
    }

    try {
        const file = await resolveOwnedFile(userId, { fileId, path });
        if (!file) {
            return res.status(404).send({ error: 'File not found' });
        }

        res.send({ file: formatResolvedFile(file) });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// Upload a file (encrypted content)
router.post(
    '/upload',
    requireAuth,
    [
        body('path').notEmpty().withMessage('File path is required'),
        body('content').notEmpty().withMessage('Encrypted content is required')
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.currentUser!.id;
        const {
            path,
            content,
            fileHash,
            fileId
        } = req.body as {
            path: string;
            content: string;
            fileHash?: string;
            fileId?: string;
        };

        try {
            const vaultId = await getOrCreateUserVaultId(userId);
            const existingFile = await resolveOwnedFile(userId, { fileId, path: fileId ? undefined : path });

            if (existingFile) {
                const conflictingPath = await query(
                    `SELECT id
                     FROM vault_files
                     WHERE vault_id = $1 AND file_path = $2 AND id <> $3
                     LIMIT 1`,
                    [vaultId, path, existingFile.id]
                );

                if (conflictingPath.rows.length > 0) {
                    return res.status(409).send({ error: 'Another file already exists at this path.' });
                }

                const nextVersion = (existingFile.version ?? 1) + 1;
                const updatedFile = await query(
                    `UPDATE vault_files
                     SET file_path = $1,
                         encrypted_content_url = $2,
                         file_hash = $3,
                         version = $4,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $5
                     RETURNING id, file_path, file_hash, version, updated_at`,
                    [path, content, fileHash || null, nextVersion, existingFile.id]
                );

                await query(
                    `INSERT INTO file_versions (file_id, version_number, encrypted_content_url, author_id)
                     VALUES ($1, $2, $3, $4)`,
                    [existingFile.id, nextVersion, content, userId]
                );

                return res.status(200).send({
                    success: true,
                    file: formatResolvedFile(updatedFile.rows[0])
                });
            }

            const insertedFile = await query(
                `INSERT INTO vault_files (vault_id, file_path, encrypted_content_url, file_hash, version)
                 VALUES ($1, $2, $3, $4, 1)
                 RETURNING id, file_path, file_hash, version, updated_at`,
                [vaultId, path, content, fileHash || null]
            );

            await query(
                `INSERT INTO file_versions (file_id, version_number, encrypted_content_url, author_id)
                 VALUES ($1, 1, $2, $3)`,
                [insertedFile.rows[0].id, content, userId]
            );

            res.status(200).send({
                success: true,
                file: formatResolvedFile(insertedFile.rows[0])
            });
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
        const { path, permissionType, fileId } = req.body as {
            path?: string;
            permissionType: 'public_view' | 'public_edit' | 'private';
            fileId?: string;
        };
        const lookupError = ensureLookupProvided(fileId, path);

        if (lookupError) {
            return res.status(400).send({ error: lookupError });
        }

        try {
            const file = await resolveOwnedFile(userId, { fileId, path });
            if (!file) {
                return res.status(404).send({ error: 'File not found in your vault. Sync it first.' });
            }

            const existingShareResult = await query(
                `SELECT id, share_token
                 FROM shared_documents
                 WHERE file_id = $1 AND owner_id = $2
                 LIMIT 1`,
                [file.id, userId]
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
                    [file.id, userId, shareToken, permissionType]
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
                fileId: file.id,
                path: file.file_path,
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
                    vf.id AS file_id,
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
                    vf.id AS file_id,
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

// Return share status for one file visible to user
router.get('/shared-status', requireAuth, async (req: Request, res: Response) => {
    const userId = req.currentUser!.id;
    const path = req.query.path as string | undefined;
    const fileId = req.query.fileId as string | undefined;
    const lookupError = ensureLookupProvided(fileId, path);

    if (lookupError) {
        return res.status(400).send({ error: lookupError });
    }

    try {
        const sharedStatus = await resolveVisibleSharedStatus(userId, { fileId, path });
        if (!sharedStatus) {
            return res.send({ isShared: false });
        }

        res.send({
            isShared: true,
            fileId: sharedStatus.file_id,
            path: sharedStatus.path,
            permissionType: sharedStatus.permission_type,
            role: sharedStatus.role,
            shareToken: sharedStatus.share_token,
            isOwner: sharedStatus.is_owner
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
            `SELECT f.id, f.file_path, f.file_hash, f.version, f.updated_at
             FROM vault_files f
             JOIN vaults v ON f.vault_id = v.id
             WHERE v.user_id = $1 AND f.deleted_at IS NULL
             ORDER BY f.file_path ASC`,
            [userId]
        );

        res.send(result.rows.map(formatResolvedFile));
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// Download a file
router.post('/download', requireAuth, async (req: Request, res: Response) => {
    const userId = req.currentUser!.id;
    const { path, fileId } = req.body as { path?: string; fileId?: string };
    const lookupError = ensureLookupProvided(fileId, path);

    if (lookupError) {
        return res.status(400).send({ error: lookupError });
    }

    try {
        const file = await resolveOwnedFile(userId, { fileId, path });
        if (!file) {
            return res.status(404).send({ error: 'File not found' });
        }

        const result = await query(
            'SELECT encrypted_content_url FROM vault_files WHERE id = $1',
            [file.id]
        );

        res.send({
            file: formatResolvedFile(file),
            content: result.rows[0].encrypted_content_url
        });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// Get versions for a file
router.post('/versions', requireAuth, async (req: Request, res: Response) => {
    const userId = req.currentUser!.id;
    const { path, fileId } = req.body as { path?: string; fileId?: string };
    const lookupError = ensureLookupProvided(fileId, path);

    if (lookupError) {
        return res.status(400).send({ error: lookupError });
    }

    try {
        const file = await resolveOwnedFile(userId, { fileId, path });
        if (!file) {
            return res.status(404).send({ error: 'File not found' });
        }

        const versions = await query(
            `SELECT fv.version_number, fv.created_at, fv.change_summary, u.display_name as author
             FROM file_versions fv
             LEFT JOIN users u ON fv.author_id = u.id
             WHERE fv.file_id = $1
             ORDER BY fv.version_number DESC`,
            [file.id]
        );

        res.send({
            file: formatResolvedFile(file),
            versions: versions.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// Download a specific version
router.post('/download-version', requireAuth, async (req: Request, res: Response) => {
    const userId = req.currentUser!.id;
    const { path, version, fileId } = req.body as {
        path?: string;
        version: number;
        fileId?: string;
    };
    const lookupError = ensureLookupProvided(fileId, path);

    if (lookupError) {
        return res.status(400).send({ error: lookupError });
    }

    try {
        const file = await resolveOwnedFile(userId, { fileId, path });
        if (!file) {
            return res.status(404).send({ error: 'File not found' });
        }

        const versionResult = await query(
            `SELECT encrypted_content_url
             FROM file_versions
             WHERE file_id = $1 AND version_number = $2`,
            [file.id, version]
        );

        if (versionResult.rows.length === 0) {
            return res.status(404).send({ error: 'Version not found' });
        }

        res.send({
            file: formatResolvedFile(file),
            content: versionResult.rows[0].encrypted_content_url
        });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

export { router as filesRouter };
