import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-800 text-white flex flex-col">
                <div className="p-6">
                    <h1 className="text-2xl font-bold">Obsidian Admin</h1>
                </div>
                <nav className="flex-1 px-4 space-y-2">
                    <Link href="/" className={`block py-2.5 px-4 rounded transition duration-200 ${router.pathname === '/' ? 'bg-gray-700' : 'hover:bg-gray-700'}`}>
                        Dashboard
                    </Link>
                    <Link href="/users" className={`block py-2.5 px-4 rounded transition duration-200 ${router.pathname === '/users' ? 'bg-gray-700' : 'hover:bg-gray-700'}`}>
                        Users
                    </Link>
                    <Link href="/backup-policies" className={`block py-2.5 px-4 rounded transition duration-200 ${router.pathname === '/backup-policies' ? 'bg-gray-700' : 'hover:bg-gray-700'}`}>
                        Backup Policies
                    </Link>
                    {/* Add more links here */}
                </nav>
                <div className="p-4 border-t border-gray-700">
                    <button onClick={() => { localStorage.removeItem('token'); router.push('/login'); }} className="w-full text-left py-2 px-4 hover:bg-gray-700 rounded text-red-400">
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8">
                {children}
            </main>
        </div>
    );
};
