import { request } from 'obsidian';
import CollaborativePlugin from './main';

export type SharePermissionType = 'public_view' | 'public_edit' | 'private';
export type ShareRole = 'owner' | 'editor' | 'commenter' | 'viewer';

export interface SharedFileEntry {
    file_id: string;
    path: string;
    permission_type: SharePermissionType;
    role: ShareRole;
    share_token: string;
    is_owner: boolean;
}

export interface SharedStatusResponse {
    isShared: boolean;
    fileId?: string;
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

    async shareFile(
        lookup: { fileId?: string; path?: string },
        permissionType: SharePermissionType
    ): Promise<{
        fileId?: string;
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
            body: JSON.stringify({ ...lookup, permissionType })
        });

        const data = JSON.parse(response);
        return {
            fileId: data.fileId,
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

    async getShareStatus(lookup: { fileId?: string; path?: string }): Promise<SharedStatusResponse> {
        const queryParams = new URLSearchParams();
        if (lookup.fileId) {
            queryParams.set('fileId', lookup.fileId);
        }
        if (lookup.path) {
            queryParams.set('path', lookup.path);
        }

        const response = await request({
            url: `${this.plugin.settings.apiUrl}/api/files/shared-status?${queryParams.toString()}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.plugin.settings.token}`
            }
        });

        return JSON.parse(response);
    }
}
