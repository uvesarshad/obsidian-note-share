import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { currentUser } from './middlewares/auth';

dotenv.config();

const app = express();
const port = process.env.PORT || 3008;

app.use(cors());
app.use(express.json());
app.use(currentUser);

app.get('/', (req, res) => {
    res.send('Obsidian Collaborative Server Running');
});

import { authRouter } from './routes/auth';
import { filesRouter } from './routes/files';
import { adminRouter } from './routes/admin';
import { backupRouter } from './routes/backup';

app.use('/api/auth', authRouter);
app.use('/api/files', filesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/backup', backupRouter);

import { createServer } from 'http';
import { initSocket } from './socket';

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
