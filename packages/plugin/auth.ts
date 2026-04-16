import { request } from 'obsidian';
import CollaborativePlugin from './main';
import { User } from './types';

export class AuthService {
    private plugin: CollaborativePlugin;

    constructor(plugin: CollaborativePlugin) {
        this.plugin = plugin;
    }

    async login(email: string, password: string, mfaCode?: string): Promise<User | null> {
        try {
            const bodyData: any = { email, password };
            if (mfaCode) bodyData.mfa_code = mfaCode;

            const response = await request({
                url: `${this.plugin.settings.apiUrl}/api/auth/login`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData),
            });

            const data = JSON.parse(response);

            if (data.token && data.user) {
                this.plugin.settings.token = data.token;
                this.plugin.settings.user = data.user;
                await this.plugin.saveSettings();
                return data.user;
            }
            return null;

        } catch (error: any) {
            console.error('Login failed:', error);
            // Check if error contains mfa_required
            if (error.status === 401 && error.message?.includes('mfa_required')) {
                throw new Error('mfa_required');
            }
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

    async setupMFA(): Promise<{ qrCodeDataUrl: string, secret: string }> {
        const response = await request({
            url: `${this.plugin.settings.apiUrl}/api/auth/mfa/setup`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.plugin.settings.token}`
            }
        });
        return JSON.parse(response);
    }

    async verifyMFA(code: string): Promise<boolean> {
        try {
            await request({
                url: `${this.plugin.settings.apiUrl}/api/auth/mfa/verify`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.plugin.settings.token}`
                },
                body: JSON.stringify({ code })
            });
            return true;
        } catch (e) {
            return false;
        }
    }
}
