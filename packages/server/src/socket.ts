import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { YSocketIO } from 'y-socket.io/dist/server';
import jwt from 'jsonwebtoken';
import { query } from './db';
import { UserPayload } from './middlewares/auth';

const canUserAccessFile = async (userId: string, fileId: string): Promise<boolean> => {
    const result = await query(
        `SELECT f.id
         FROM vault_files f
         JOIN vaults v ON f.vault_id = v.id
         LEFT JOIN shared_documents sd ON sd.file_id = f.id
         LEFT JOIN document_permissions dp
           ON dp.shared_document_id = sd.id AND dp.user_id = $2
         WHERE f.id = $1
           AND (
             v.user_id = $2
             OR sd.owner_id = $2
             OR dp.user_id = $2
           )
         LIMIT 1`,
        [fileId, userId]
    );

    return result.rows.length > 0;
};

export const initSocket = (httpServer: HttpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: '*', // Allow all origins for now, restrict in production
            methods: ['GET', 'POST']
        }
    });

    const yjsNamespace = io.of(/^\/yjs\|.*$/);
    yjsNamespace.use(async (socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        const fileId = socket.nsp.name.replace(/^\/yjs\|/, '');

        if (!token || !fileId) {
            return next(new Error('Authentication error'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
            const allowed = await canUserAccessFile(decoded.id, fileId);
            if (!allowed) {
                return next(new Error('Unauthorized'));
            }

            (socket as any).decoded = decoded;
            next();
        } catch (err) {
            next(new Error('Authentication error'));
        }
    });

    const ysocketio = new YSocketIO(io, {});

    // Initialize the YSocketIO instance
    ysocketio.initialize();

    yjsNamespace.on('connection', (socket) => {
        console.log('User connected:', (socket as any).decoded?.email, 'room:', socket.nsp.name);

        socket.on('disconnect', () => {
            console.log('User disconnected');
        });
    });

    console.log('Socket.io server initialized');
    return io;
};
