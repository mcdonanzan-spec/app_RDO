import React from 'react';
import {
    ShoppingCart,
    CircleDollarSign,
    Building2,
    Settings,
    BrainCircuit,
    Table as TableIcon,
    TrendingUp,
    Shield,
    ChevronDown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
    activeView: string;
    setActiveView: (view: string) => void;
    isMobileOpen: boolean;
    setIsMobileOpen: (isOpen: boolean) => void;
    projects: any[];
    activeProjectId: string | null;
    onSelectProject: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    activeView,
    setActiveView,
    isMobileOpen,
    setIsMobileOpen,
    projects,
    activeProjectId,
    onSelectProject
}) => {
    const { user, signOut } = useAuth();
    const currentProject = projects.find(p => p.id === activeProjectId);
    const menuItems = [
        { id: 'purchase_flow', label: 'Fluxo de Compras', icon: <ShoppingCart size={20} />, section: 'SUPPLY CHAIN' },
        { id: 'budget_control', label: 'Controle Orçamentário', icon: <CircleDollarSign size={20} />, section: 'FINANCEIRO' },
        { id: 'analytical_cash_flow', label: 'Fluxo de Caixa Analítico', icon: <TableIcon size={20} />, section: 'FINANCEIRO' },
        { id: 'disbursement_forecast', label: 'Previsão de Desembolso', icon: <TrendingUp size={20} />, section: 'FINANCEIRO' },
        { id: 'visual_management', label: 'Gestão à Vista', icon: <Building2 size={20} />, section: 'PRODUÇÃO' },
        { id: 'intelligence', label: 'IA Generativa', icon: <BrainCircuit size={20} />, section: 'ANÁLISE' },
        { id: 'strategy_bi', label: 'Estratégia & BI', icon: <TrendingUp size={20} />, section: 'ANÁLISE' },
        { id: 'admin', label: 'Admin & Acesso', icon: <Shield size={20} />, section: 'CONFIG' },
        { id: 'system_summary', label: 'Guia do Sistema', icon: <Settings size={20} />, section: 'CONFIG' },
    ];

    const groupedMenu = menuItems.reduce((acc, item) => {
        if (!acc[item.section]) acc[item.section] = [];
        acc[item.section].push(item);
        return acc;
    }, {} as Record<string, typeof menuItems>);

    return (
        <>
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            <div className={`
        fixed top-0 left-0 h-full w-64 bg-slate-900 text-white z-50 transition-transform duration-300
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static flex flex-col shadow-xl
      `}>
                <div className="p-4 border-b border-slate-800">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-yellow-400 text-slate-900 p-2 rounded font-bold text-lg shadow-lg shadow-yellow-400/20">BRZ</div>
                        <div>
                            <h1 className="font-bold text-sm leading-tight text-white">Torre de Controle</h1>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">SGO Digital Twin</p>
                        </div>
                    </div>

                    {projects.length > 0 ? (
                        <div className="relative group">
                            <select
                                value={activeProjectId || ''}
                                onChange={(e) => onSelectProject(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-yellow-400/50 transition-all pr-8"
                            >
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-yellow-400 transition-colors" />
                        </div>
                    ) : (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[10px] font-bold text-red-400 uppercase flex items-center gap-2">
                            Nenhuma Obra Ativa
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-slate-700">
                    {Object.entries(groupedMenu).map(([section, items]) => (
                        <div key={section} className="mb-6">
                            <h3 className="px-6 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                {section}
                            </h3>
                            <ul>
                                {items.map((item) => (
                                    <li key={item.id}>
                                        <button
                                            onClick={() => {
                                                setActiveView(item.id);
                                                setIsMobileOpen(false);
                                            }}
                                            className={`
                        w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all duration-200
                        ${activeView === item.id
                                                    ? 'bg-yellow-500 text-slate-900 border-r-4 border-white shadow-inner'
                                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
                      `}
                                        >
                                            {item.icon}
                                            {item.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-slate-900 font-bold shadow-md">
                            {user?.user_metadata?.full_name?.substring(0, 2).toUpperCase() || user?.email?.substring(0, 2).toUpperCase() || 'US'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">{user?.user_metadata?.full_name || 'Usuário'}</p>
                            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                            <button onClick={signOut} className="text-[10px] text-red-400 hover:text-red-300 font-bold mt-1 uppercase">Sair</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
