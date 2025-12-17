import React from 'react';
import { Settings } from 'lucide-react';

export const SystemBlueprintView = () => {
    return (
        <div className="p-8 h-full bg-slate-50 flex items-center justify-center">
            <div className="text-center max-w-lg">
                <Settings size={48} className="mx-auto text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 mb-2">Arquitetura Digital Twin</h2>
                <p className="text-slate-500 text-sm">
                    O sistema opera processando diretamente os metadados do arquivo Excel (xlsx) para replicar
                    fidelidade visual e integridade de dados, ignorando colunas ocultas e linhas de sistema.
                </p>
            </div>
        </div>
    );
};
