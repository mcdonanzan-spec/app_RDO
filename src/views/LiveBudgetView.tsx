import React, { useState, useMemo } from 'react';
import { FileSpreadsheet, ChevronDown } from 'lucide-react';
import { AppData } from '../../types';
import { formatMoney } from '../utils';

export const LiveBudgetView = ({ appData }: { appData: AppData }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const sortedBudget = useMemo(() => {
        if (!appData.budget) return [];

        // 1. Filtrar
        const filtered = appData.budget.filter(item => {
            if (!searchTerm) return true;
            const matchesSearch =
                String(item.desc || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(item.code || '').toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        });

        // 2. Ordenar por código para garantir hierarquia
        const sorted = [...filtered].sort((a, b) => {
            const aParts = a.code.split('.');
            const bParts = b.code.split('.');
            const minLen = Math.min(aParts.length, bParts.length);
            for (let i = 0; i < minLen; i++) {
                const partA = aParts[i];
                const partB = bParts[i];
                if (partA !== partB) {
                    const order: Record<string, number> = { 'MT': 1, 'ST': 2, 'EQ': 3 };
                    const oA = order[partA] || 99;
                    const oB = order[partB] || 99;
                    if (oA !== oB) return oA - oB;
                    return partA.localeCompare(partB, undefined, { numeric: true });
                }
            }
            return aParts.length - bParts.length;
        });

        // 3. Processar Níveis e Agrupamentos
        return sorted.map(item => {
            // Calcular nível baseado em pontos (ex: 01.02.01 = Nível 3)
            // Se o código não tiver pontos, assume nível 1
            const level = item.code ? item.code.split('.').length : 1;

            // Identificar se é Grupo (Heurística: Sem unidade ou sem preço unitário, mas com total)
            // OU se o nível é baixo (1 ou 2)
            const isGroup = !item.unit || item.unit === '0' || level <= 2;

            return { ...item, level, isGroup };
        });

    }, [appData.budget, searchTerm]);

    return (
        <div className="h-full flex flex-col p-6 bg-slate-50">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <FileSpreadsheet className="text-yellow-500" /> Orçamento Vivo
                    </h2>
                    <p className="text-sm text-slate-500">Visão hierárquica detalhada (Agrupada por G.O.)</p>
                </div>
                <input
                    type="text"
                    placeholder="Buscar item..."
                    className="px-4 py-2 border rounded text-sm w-64 shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="flex-1 bg-white rounded border border-slate-200 overflow-auto shadow-sm custom-scrollbar">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-100 sticky top-0 text-xs font-bold text-slate-700 shadow-sm z-10 h-10">
                        <tr>
                            <th className="px-4 py-2 border-b border-slate-200 w-32">Código</th>
                            <th className="px-4 py-2 border-b border-slate-200">Descrição do Serviço / Insumo</th>
                            <th className="px-4 py-2 border-b border-slate-200 w-16 text-center">Unid.</th>
                            <th className="px-4 py-2 border-b border-slate-200 w-24 text-right">Qtd.</th>
                            <th className="px-4 py-2 border-b border-slate-200 w-28 text-right">Unitário</th>
                            <th className="px-4 py-2 border-b border-slate-200 w-32 text-right">Total</th>
                            <th className="px-4 py-2 border-b border-slate-200 w-24 text-center">Origem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedBudget.slice(0, 500).map((item, idx) => (
                            <tr
                                key={idx}
                                className={`
                    border-b border-slate-100 transition-colors
                    ${item.isGroup ? 'bg-slate-50 font-bold text-slate-800' : 'hover:bg-yellow-50 text-slate-600'}
                `}
                            >
                                <td className="px-4 py-2 font-mono text-xs text-slate-500 whitespace-nowrap">
                                    {item.code}
                                </td>
                                <td className="px-4 py-2 relative">
                                    {/* Indentação Visual Melhorada */}
                                    <div
                                        style={{
                                            paddingLeft: `${(item.level || 1) * 28}px`, // Aumentado de 16px para 28px
                                            borderLeft: (item.level || 1) > 1 ? '1px solid #e2e8f0' : 'none',
                                            marginLeft: (item.level || 1) > 1 ? '10px' : '0'
                                        }}
                                        className="flex items-center gap-2 h-full py-1"
                                    >
                                        {item.isGroup && (item.level || 1) < 3 && <ChevronDown size={14} className="text-slate-400" />}
                                        {!item.isGroup && <div className="w-2 h-2 rounded-full bg-slate-200 flex-shrink-0"></div>}
                                        <span className={`truncate max-w-xl block ${item.isGroup ? 'font-bold text-slate-800' : 'text-slate-600'}`} title={item.desc}>
                                            {item.desc}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-2 text-center text-xs text-slate-400">
                                    {!item.isGroup && item.unit}
                                </td>
                                <td className="px-4 py-2 text-right">
                                    {!item.isGroup && item.qty?.toLocaleString('pt-BR')}
                                </td>
                                <td className="px-4 py-2 text-right">
                                    {!item.isGroup && formatMoney(item.unitPrice)}
                                </td>
                                <td className={`px-4 py-2 text-right ${item.isGroup ? 'text-slate-900' : 'font-medium'}`}>
                                    {formatMoney(item.total)}
                                </td>
                                <td className="px-4 py-2 text-center text-[10px] text-slate-400 uppercase">
                                    {item.originSheet.substring(0, 10)}
                                </td>
                            </tr>
                        ))}
                        {sortedBudget.length > 500 && (
                            <tr>
                                <td colSpan={7} className="p-4 text-center text-slate-400 text-xs italic bg-slate-50">
                                    ... mostrando os primeiros 500 itens de {sortedBudget.length} ...
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {sortedBudget.length === 0 && (
                    <div className="p-20 text-center flex flex-col items-center">
                        <FileSpreadsheet size={48} className="text-slate-200 mb-4" />
                        <p className="text-slate-500 font-medium">Nenhum dado encontrado.</p>
                        <p className="text-sm text-slate-400">Verifique se carregou as planilhas de Orçamento (02-05) na Migração.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
