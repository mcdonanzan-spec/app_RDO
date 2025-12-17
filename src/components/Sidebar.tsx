import React from 'react';
import {
    Sparkles,
    Database,
    FlaskConical,
    BrainCircuit,
    Building2,
    FileSpreadsheet,
    Upload,
    Settings,
    History,
    Target,
    TrendingUp
} from 'lucide-react';

interface SidebarProps {
    activeView: string;
    setActiveView: (view: string) => void;
    isMobileOpen: boolean;
    setIsMobileOpen: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, isMobileOpen, setIsMobileOpen }) => {
    const menuItems = [
        { id: 'intelligence', label: 'Inteligência Artificial', icon: <Sparkles size={20} />, section: 'ESTRATÉGIA & DECISÃO' },
        { id: 'ai_input', label: 'Central de Dados IA', icon: <Database size={20} />, section: 'ESTRATÉGIA & DECISÃO' },
        { id: 'ai_strategy', label: 'Laboratório de IA', icon: <FlaskConical size={20} />, section: 'ESTRATÉGIA & DECISÃO' },
        { id: 'rdo', label: 'O PASSADO (RDO)', icon: <History size={20} />, section: 'TRIPÉ DE GESTÃO' },
        { id: 'budget_spreadsheet', label: 'O CAMINHO (Orçamento)', icon: <Target size={20} />, section: 'TRIPÉ DE GESTÃO' },
        { id: 'master_planning', label: 'O FUTURO (Master Plan)', icon: <BrainCircuit size={20} />, section: 'TRIPÉ DE GESTÃO' },
        { id: 'visual_management', label: 'Gestão à Vista', icon: <Building2 size={20} />, section: 'VISUALIZAÇÃO' },
        { id: 'live_budget', label: 'Orçamento Vivo', icon: <FileSpreadsheet size={20} />, section: 'BASE DE DADOS' },
        { id: 'excel_migration', label: 'Migração Excel', icon: <Upload size={20} />, section: 'CONFIGURAÇÃO' },
        { id: 'system_blueprint', label: 'Mapa do Sistema', icon: <Settings size={20} />, section: 'CONFIGURAÇÃO' },
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
                <div className="p-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="bg-yellow-400 text-slate-900 p-2 rounded font-bold text-xl shadow-lg shadow-yellow-400/20">BRZ</div>
                        <div>
                            <h1 className="font-bold text-lg leading-tight">Torre de Controle</h1>
                            <p className="text-xs text-slate-400">SGO - Digital Twin v5.0</p>
                        </div>
                    </div>
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

                <div className="p-4 border-t border-slate-800 bg-slate-950">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-slate-900 font-bold shadow-md">
                            JD
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">João Diretor</p>
                            <p className="text-xs text-slate-400">Superintendente</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
