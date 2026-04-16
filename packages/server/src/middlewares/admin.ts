import { Request, Response, NextFunction } from 'express';

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
        return res.status(401).send({ error: 'Not authorized' });
    }

    if (req.currentUser.role !== 'admin') {
        return res.status(403).send({ error: 'Forbidden: Admins only' });
    }

    next();
};
