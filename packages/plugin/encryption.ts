import * as bip39 from 'bip39';

export class EncryptionService {
    private key: CryptoKey | null = null;
    private salt: Uint8Array | null = null;

    isReady(): boolean {
        return this.key !== null;
    }

    clearKey(): void {
        this.key = null;
        this.salt = null;
    }

    async deriveKey(password: string, salt: Uint8Array): Promise<void> {
        this.salt = salt;
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            enc.encode(password) as any, // Force cast to avoid BufferSource issues
            { name: "PBKDF2" },
            false,
            ["deriveBits", "deriveKey"]
        );

        this.key = await window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt as any, // Force cast
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    }

    async deriveKeyFromPassword(password: string, saltBase64?: string): Promise<string> {
        const salt = saltBase64
            ? new Uint8Array(this.base64ToArrayBuffer(saltBase64))
            : window.crypto.getRandomValues(new Uint8Array(16));
        await this.deriveKey(password, salt);
        return this.arrayBufferToBase64(salt.buffer);
    }

    generateRecoveryPhrase(): string {
        return bip39.generateMnemonic();
    }

    async encrypt(text: string): Promise<{ iv: string, data: string }> {
        if (!this.key) throw new Error("Key not derived");

        const enc = new TextEncoder();
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encoded = enc.encode(text);

        const ciphertext = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv as any
            },
            this.key,
            encoded as any
        );

        return {
            iv: this.arrayBufferToBase64(iv.buffer as ArrayBuffer),
            data: this.arrayBufferToBase64(ciphertext)
        };
    }

    async decrypt(encryptedData: string, iv: string): Promise<string> {
        if (!this.key) throw new Error("Key not derived");

        const decodedIv = this.base64ToArrayBuffer(iv);
        const decodedData = this.base64ToArrayBuffer(encryptedData);

        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: new Uint8Array(decodedIv) as any
            },
            this.key,
            new Uint8Array(decodedData) as any
        );

        const dec = new TextDecoder();
        return dec.decode(decrypted);
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    }
}
