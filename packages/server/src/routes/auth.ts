import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { generateSecret, generateURI, verify } from 'otplib';
import qrcode from 'qrcode';

const router = express.Router();

router.post(
    '/register',
    [
        body('email').isEmail().withMessage('Email must be valid'),
        body('password')
            .trim()
            .isLength({ min: 4, max: 20 })
            .withMessage('Password must be between 4 and 20 characters'),
    ],
    async (req: Request, res: Response) => {
        console.log('Register Request Body:', req.body);
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            console.error('Register Validation Errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, displayName } = req.body;

        try {
            const existingUser = await query('SELECT * FROM users WHERE email = $1', [email]);

            if (existingUser.rows.length > 0) {
                return res.status(400).send({ error: 'Email in use' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const id = uuidv4();
            const verificationToken = crypto.randomBytes(32).toString('hex');

            const newUser = await query(
                'INSERT INTO users (id, email, password_hash, display_name, verification_token) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, display_name',
                [id, email, hashedPassword, displayName || '', verificationToken]
            );

            console.log(`[MOCK EMAIL] Verification email sent to ${email} with token: ${verificationToken}`);

            const userJwt = jwt.sign(
                {
                    id: newUser.rows[0].id,
                    email: newUser.rows[0].email,
                },
                process.env.JWT_SECRET!
            );

            // Store it on session object if using cookie-session, or just return it
            // req.session = { jwt: userJwt };

            res.status(201).send({ user: newUser.rows[0], token: userJwt });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: 'Internal Server Error' });
        }
    }
);

router.post(
    '/login',
    [
        body('email').isEmail().withMessage('Email must be valid'),
        body('password').trim().notEmpty().withMessage('You must supply a password'),
    ],
    async (req: Request, res: Response) => {
        console.log('Login Request Body:', req.body);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('Login Validation Errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        try {
            const existingUser = await query('SELECT * FROM users WHERE email = $1', [email]);
            if (existingUser.rows.length === 0) {
                return res.status(400).send({ error: 'Invalid credentials' });
            }

            const passwordsMatch = await bcrypt.compare(
                password,
                existingUser.rows[0].password_hash
            );

            if (!passwordsMatch) {
                return res.status(400).send({ error: 'Invalid credentials' });
            }

            if (existingUser.rows[0].mfa_enabled) {
                const mfaCode = req.body.mfa_code;
                if (!mfaCode) {
                    return res.status(401).send({ error: 'mfa_required', message: 'MFA code is required' });
                }

                const verificationResult = await verify({
                    token: mfaCode,
                    secret: existingUser.rows[0].mfa_secret
                });
                if (!verificationResult.valid) {
                    return res.status(400).send({ error: 'Invalid credentials' }); // Vague on purpose
                }
            }

            const userJwt = jwt.sign(
                {
                    id: existingUser.rows[0].id,
                    email: existingUser.rows[0].email,
                    role: existingUser.rows[0].role
                },
                process.env.JWT_SECRET!
            );

            // req.session = { jwt: userJwt };

            res.status(200).send({ user: { id: existingUser.rows[0].id, email: existingUser.rows[0].email, display_name: existingUser.rows[0].display_name }, token: userJwt });

        } catch (err) {
            console.error(err);
            res.status(500).send({ error: 'Internal Server Error' });
        }
    }
);

router.post('/logout', (req, res) => {
    // req.session = null;
    res.send({});
});

import { currentUser } from '../middlewares/auth';

router.get('/me', currentUser, (req, res) => {
    res.send({ currentUser: req.currentUser || null });
});

router.post('/verify-email', async (req: Request, res: Response) => {
    const { token } = req.body;
    if (!token) return res.status(400).send({ error: 'Token is required' });

    try {
        const result = await query(
            'UPDATE users SET email_verified = true, verification_token = NULL WHERE verification_token = $1 RETURNING id',
            [token]
        );

        if (result.rowCount === 0) {
            return res.status(400).send({ error: 'Invalid or expired token' });
        }

        res.send({ message: 'Email verified successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

router.post(
    '/forgot-password',
    [body('email').isEmail().withMessage('Valid email is required')],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { email } = req.body;

        try {
            const resetToken = crypto.randomBytes(32).toString('hex');
            // Token expires in 1 hour
            const expires = new Date(Date.now() + 3600000);

            const result = await query(
                'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3 RETURNING id',
                [resetToken, expires, email]
            );

            if (result.rowCount === 0) {
                // Return success even if email not found to prevent user enumeration
                return res.send({ message: 'If that email exists, a reset link has been sent.' });
            }

            console.log(`[MOCK EMAIL] Password reset email sent to ${email} with token: ${resetToken}`);
            res.send({ message: 'If that email exists, a reset link has been sent.' });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: 'Internal Server Error' });
        }
    }
);

router.post(
    '/reset-password',
    [
        body('token').notEmpty().withMessage('Token is required'),
        body('password')
            .trim()
            .isLength({ min: 4, max: 20 })
            .withMessage('Password must be between 4 and 20 characters'),
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { token, password } = req.body;

        try {
             // Verify token and expiry
            const userResult = await query(
                'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
                [token]
            );

            if (userResult.rowCount === 0) {
                return res.status(400).send({ error: 'Invalid or expired reset token' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            await query(
                'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
                [hashedPassword, userResult.rows[0].id]
            );

            res.send({ message: 'Password reset successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: 'Internal Server Error' });
        }
    }
);

router.post('/mfa/setup', currentUser, async (req: Request, res: Response) => {
    if (!req.currentUser) return res.status(401).send({ error: 'Not authenticated' });

    try {
        const secret = generateSecret();
        const otpauthContent = generateURI({
            secret,
            issuer: 'Obsidian Collab Cloud',
            label: req.currentUser.email
        });
        const qrCodeDataUrl = await qrcode.toDataURL(otpauthContent);

        // Save secret temporarily until verified
        await query('UPDATE users SET mfa_secret = $1 WHERE id = $2', [secret, req.currentUser.id]);

        res.send({ qrCodeDataUrl, secret });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

router.post('/mfa/verify', currentUser, async (req: Request, res: Response) => {
    if (!req.currentUser) return res.status(401).send({ error: 'Not authenticated' });
    const { code } = req.body;
    if (!code) return res.status(400).send({ error: 'MFA code is required' });

    try {
        const userRes = await query('SELECT mfa_secret FROM users WHERE id = $1', [req.currentUser.id]);
        if (userRes.rowCount === 0) return res.status(404).send({ error: 'User not found' });

        const secret = userRes.rows[0].mfa_secret;
        if (!secret) return res.status(400).send({ error: 'MFA not set up' });

        const verificationResult = await verify({ token: code, secret });
        if (verificationResult.valid) {
            await query('UPDATE users SET mfa_enabled = true WHERE id = $1', [req.currentUser.id]);
            res.send({ message: 'MFA enabled successfully' });
        } else {
            res.status(400).send({ error: 'Invalid MFA code' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

export { router as authRouter };
