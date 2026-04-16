import { UserPayload } from '../../middlewares/auth';

declare global {
    namespace Express {
        interface Request {
            currentUser?: UserPayload;
            session?: {
                jwt: string;
            } | null;
        }
    }
}
