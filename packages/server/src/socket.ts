import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { YSocketIO } from 'y-socket.io/dist/server';
import jwt from 'jsonwebtoken';
import { query } from './db';

// Define the type for the socket object
interface AuthenticatedSocket {
    decoded?: any;
}

export const initSocket = (httpServer: HttpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: '*', // Allow all origins for now, restrict in production
            methods: ['GET', 'POST']
        }
    });

    const ysocketio = new YSocketIO(io, {
        // authenticate: async (auth) => {
        //     // TODO: Implement authentication for Yjs connection if needed at this level
        //     // Currently validation happens on socket connection
        //     return true;
        // }
    });

    // Initialize the YSocketIO instance
    ysocketio.initialize();

    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
            return next(new Error('Authentication error'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!);
            (socket as any).decoded = decoded; // Attach user info to socket
            next();
        } catch (err) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log('User connected:', (socket as any).decoded?.email);

        socket.on('disconnect', () => {
            console.log('User disconnected');
        });
    });

    console.log('Socket.io server initialized');
    return io;
};
