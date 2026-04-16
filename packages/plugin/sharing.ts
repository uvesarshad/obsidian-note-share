import { request } from 'obsidian';
import CollaborativePlugin from './main';

export type SharePermissionType = 'public_view' | 'public_edit' | 'private';
export type ShareRole = 'owner' | 'editor' | 'commenter' | 'viewer';

export interface SharedFileEntry {
    path: string;
    permission_type: SharePermissionType;
    role: ShareRole;
    share_token: string;
    is_owner: boolean;
}

export interface SharedStatusResponse {
    isShared: boolean;
    path?: string;
    permissionType?: SharePermissionType;
    role?: ShareRole;
    shareToken?: string;
    isOwner?: boolean;
}

export class SharingService {
    private plugin: CollaborativePlugin;

    constructor(plugin: CollaborativePlugin) {
        this.plugin = plugin;
    }

    async shareFile(path: string, permissionType: SharePermissionType): Promise<{
        shareToken: string;
        role: ShareRole;
        permissionType: SharePermissionType;
    }> {
        const response = await request({
            url: `${this.plugin.settings.apiUrl}/api/files/share`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.plugin.settings.token}`
            },
            body: JSON.stringify({ path, permissionType })
        });

        const data = JSON.parse(response);
        return {
            shareToken: data.shareToken,
            role: data.role,
            permissionType: data.permissionType
        };
    }

    async listSharedFiles(): Promise<SharedFileEntry[]> {
        const response = await request({
            url: `${this.plugin.settings.apiUrl}/api/files/shared`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.plugin.settings.token}`
            }
        });

        return JSON.parse(response);
    }

    async getShareStatus(path: string): Promise<SharedStatusResponse> {
        const response = await request({
            url: `${this.plugin.settings.apiUrl}/api/files/shared-status?path=${encodeURIComponent(path)}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.plugin.settings.token}`
            }
        });

        return JSON.parse(response);
    }
}
