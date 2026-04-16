import React from 'react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon }) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">{title}</h3>
                    <div className="mt-2 text-3xl font-bold text-gray-900">{value}</div>
                </div>
                {icon && <div className="p-3 bg-blue-100 rounded-full text-blue-600">{icon}</div>}
            </div>
        </div>
    );
};
