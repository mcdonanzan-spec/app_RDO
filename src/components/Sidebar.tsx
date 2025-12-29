import React from 'react';
import {
    ShoppingCart,
    CircleDollarSign,
    Building2,
    Settings,
    BrainCircuit
} from 'lucide-react';

interface SidebarProps {
    activeView: string;
    setActiveView: (view: string) => void;
    isMobileOpen: boolean;
    setIsMobileOpen: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, isMobileOpen, setIsMobileOpen }) => {
    const menuItems = [
        { id: 'purchase_flow', label: 'Fluxo de Compras', icon: <ShoppingCart size={20} />, section: 'SUPPLY CHAIN' },
        { id: 'budget_control', label: 'Controle Orçamentário', icon: <CircleDollarSign size={20} />, section: 'FINANCEIRO' },
        { id: 'visual_management', label: 'Gestão à Vista', icon: <Building2 size={20} />, section: 'PRODUÇÃO' },
        { id: 'intelligence', label: 'IA Estratégica', icon: <BrainCircuit size={20} />, section: 'ANÁLISE' },
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

                <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-4">
                    <button
                        onClick={async () => {
                            if (window.confirm("Isso apagará todos os dados atuais e gerará dados de teste. Continuar?")) {
                                const { generateMockData } = await import('../services/mockGenerator');
                                await generateMockData();
                            }
                        }}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-3 py-2 rounded text-xs font-bold uppercase transition-colors flex items-center justify-center gap-2 border border-slate-700"
                    >
                        ⚡ Gerar Dados de Teste
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-slate-900 font-bold shadow-md">
                            MD
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">Marcio Donanzan</p>
                            <p className="text-xs text-slate-400">Desenvolvedor</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
