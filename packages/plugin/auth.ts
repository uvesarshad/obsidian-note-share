import { request } from 'obsidian';
import CollaborativePlugin from './main';
import { User } from './types';

export class AuthService {
    private plugin: CollaborativePlugin;

    constructor(plugin: CollaborativePlugin) {
        this.plugin = plugin;
    }

    async login(email: string, password: string): Promise<User | null> {
        try {
            const response = await request({
                url: `${this.plugin.settings.apiUrl}/api/auth/login`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = JSON.parse(response);

            if (data.token && data.user) {
                this.plugin.settings.token = data.token;
                this.plugin.settings.user = data.user;
                await this.plugin.saveSettings();
                return data.user;
            }
            return null;

        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }

    async register(email: string, password: string, displayName: string): Promise<User | null> {
        try {
            const response = await request({
                url: `${this.plugin.settings.apiUrl}/api/auth/register`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, displayName }),
            });

            const data = JSON.parse(response);

            if (data.token && data.user) {
                this.plugin.settings.token = data.token;
                this.plugin.settings.user = data.user;
                await this.plugin.saveSettings();
                return data.user;
            }
            return null;
        } catch (error) {
            console.error('Registration failed:', error);
            throw error;
        }
    }

    async logout(): Promise<void> {
        this.plugin.settings.token = '';
        this.plugin.settings.user = null;
        await this.plugin.saveSettings();
    }

    async getCurrentUser(): Promise<User | null> {
        if (!this.plugin.settings.token) return null;

        try {
            const response = await request({
                url: `${this.plugin.settings.apiUrl}/api/auth/me`,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.plugin.settings.token}`
                },
            });

            const data = JSON.parse(response);
            return data.currentUser;
        } catch (error) {
            console.error('Failed to fetch current user', error);
            return null;
        }
    }
}
