import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface UserPayload {
    id: string;
    email: string;
    role: string;
}

declare global {
    namespace Express {
        interface Request {
            currentUser?: UserPayload;
        }
    }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
        return res.status(401).send({ error: 'Not authorized' });
    }
    next();
};

export const currentUser = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.jwt) {
        // Start with checking header if cookie/session not present
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const payload = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
                req.currentUser = payload;
            } catch (err) { }
        }
        return next();
    }

    try {
        const payload = jwt.verify(req.session.jwt, process.env.JWT_SECRET!) as UserPayload;
        req.currentUser = payload;
    } catch (err) { }

    next();
};
