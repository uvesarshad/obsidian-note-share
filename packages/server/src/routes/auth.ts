import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';

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

            const newUser = await query(
                'INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, $3, $4) RETURNING id, email, display_name',
                [id, email, hashedPassword, displayName || '']
            );

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

export { router as authRouter };
