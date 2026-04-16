import React, { useEffect, useState } from 'react';
import { Layout } from '../src/components/Layout';
import { useRouter } from 'next/router';

interface BackupPolicy {
    planTier: string;
    fullVaultBackupEnabled: boolean;
    allowedFrequencies: string[];
}

export default function BackupPolicies() {
    const [policies, setPolicies] = useState<BackupPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchPolicies = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/login');
            return;
        }

        try {
            const res = await fetch('http://localhost:3008/api/admin/backup-policies', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.status === 401 || res.status === 403) {
                router.push('/login');
                return;
            }

            const data = await res.json();
            setPolicies(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPolicies();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    const updatePolicy = async (policy: BackupPolicy) => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/login');
            return;
        }

        try {
            const res = await fetch(`http://localhost:3008/api/admin/backup-policies/${policy.planTier}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fullVaultBackupEnabled: policy.fullVaultBackupEnabled,
                    allowedFrequencies: policy.allowedFrequencies
                })
            });

            if (!res.ok) {
                const errorPayload = await res.json();
                throw new Error(errorPayload.error || 'Failed to update policy');
            }

            await fetchPolicies();
        } catch (err) {
            console.error(err);
            alert((err as Error).message);
        }
    };

    if (loading) return <Layout><div>Loading...</div></Layout>;

    return (
        <Layout>
            <h1 className="text-3xl font-bold mb-8">Backup Policy Controls</h1>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Vault Backup</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allowed Frequencies</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {policies.map((policy) => (
                            <tr key={policy.planTier}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{policy.planTier}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    <input
                                        type="checkbox"
                                        checked={policy.fullVaultBackupEnabled}
                                        onChange={(e) => {
                                            setPolicies((prev) => prev.map((item) => item.planTier === policy.planTier
                                                ? { ...item, fullVaultBackupEnabled: e.target.checked }
                                                : item));
                                        }}
                                    />
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900">
                                    <input
                                        className="w-full border border-gray-300 rounded p-2"
                                        value={policy.allowedFrequencies.join(',')}
                                        onChange={(e) => {
                                            const values = e.target.value
                                                .split(',')
                                                .map((value) => value.trim())
                                                .filter((value) => value.length > 0);
                                            setPolicies((prev) => prev.map((item) => item.planTier === policy.planTier
                                                ? { ...item, allowedFrequencies: values }
                                                : item));
                                        }}
                                        placeholder="manual,daily,weekly"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    <button
                                        className="bg-gray-800 text-white px-3 py-2 rounded hover:bg-gray-700"
                                        onClick={() => updatePolicy(policy)}
                                    >
                                        Save
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}
