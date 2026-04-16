import React, { useEffect, useState } from 'react';
import { Layout } from '../src/components/Layout';
import { StatCard } from '../src/components/StatCard';
import { useRouter } from 'next/router';

export default function Dashboard() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchStats = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/login');
                return;
            }

            try {
                const res = await fetch('http://localhost:3008/api/admin/stats', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.status === 401 || res.status === 403) {
                    router.push('/login');
                    return;
                }

                const data = await res.json();
                setStats(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [router]);

    if (loading) return <div>Loading...</div>;

    return (
        <Layout>
            <h1 className="text-3xl font-bold mb-8">Dashboard Overview</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Users" value={stats?.totalUsers || 0} />
                <StatCard title="Total Vaults" value={stats?.totalVaults || 0} />
                <StatCard title="Total Files" value={stats?.totalFiles || 0} />
                <StatCard title="Storage Used" value={`${((stats?.totalStorage || 0) / 1024 / 1024).toFixed(2)} MB`} />
            </div>
        </Layout>
    );
}
