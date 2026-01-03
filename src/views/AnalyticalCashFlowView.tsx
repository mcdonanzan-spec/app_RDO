import React, { useState, useMemo } from 'react';
import { AppData, BudgetNode, FinancialEntry, Installment } from '../../types';
import {
    Calendar,
    Search,
    ChevronDown,
    ChevronRight,
    DollarSign,
    Filter,
    Download,
    ArrowUpDown,
    CheckCircle2,
    Clock,
    TrendingDown,
    TrendingUp,
    LayoutGrid,
    Table as TableIcon
} from 'lucide-react';

interface Props {
    appData: AppData;
    onUpdate?: (data: Partial<AppData>) => void;
}

// Helper to format currency
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

// Helper to get month name
const getMonthLabel = (dateStr: string) => {
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('pt-BR', { month: 'long', year: '2-digit' }).toUpperCase();
};

// Helper to add months to a YYYY-MM string
const addMonths = (yearMonth: string, months: number) => {
    const [y, m] = yearMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + months, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const AnalyticalCashFlowView: React.FC<Props> = ({ appData, onUpdate }) => {
    const [closedMonth, setClosedMonth] = useState<string>(() => {
        // If we have data in 2025 (mock data range), default to a month there for better demo
        const now = new Date();
        const year = now.getFullYear();
        if (year >= 2026) return '2025-06';
        return `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [commitmentValues, setCommitmentValues] = useState<Record<string, number>>({});

    // Load commitments and closed month from meta if available
    React.useEffect(() => {
        const loadPersisted = async () => {
            const { db } = await import('../services/db');
            const metaCommitments = await db.meta.get('cashFlowCommitments');
            if (metaCommitments) setCommitmentValues(metaCommitments.value);
            const metaClosedMonth = await db.meta.get('cashFlowClosedMonth');
            if (metaClosedMonth) setClosedMonth(metaClosedMonth.value);
        };
        loadPersisted();
    }, []);

    const saveConferences = async () => {
        const { db } = await import('../services/db');
        await db.meta.put({ key: 'cashFlowCommitments', value: commitmentValues });
        await db.meta.put({ key: 'cashFlowClosedMonth', value: closedMonth });
        alert("✅ Conferência salva com sucesso!");
    };

    // Generate monthly range for headers (Closed Month + 6 months for example)
    const futureMonths = useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => addMonths(closedMonth, i + 1));
    }, [closedMonth]);

    // Build the budget tree (reusing logic from BudgetControlView)
    const budgetTree = useMemo(() => {
        if (!appData.budget || appData.budget.length === 0) return [];

        const sortedLines = [...appData.budget].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

        const allNodes: BudgetNode[] = sortedLines.map(line => ({
            id: line.id || `node-${line.code}`,
            code: line.code,
            description: line.desc,
            level: (line.code.match(/\./g) || []).length,
            totalValue: line.total,
            type: line.isGroup ? 'GROUP' : 'ITEM',
            itemType: line.isGroup ? undefined : (line.type === 'mt' ? 'MT' : 'ST'),
            children: [],
            budgetInitial: line.total,
            budgetCurrent: line.total,
            realizedRDO: 0,
            realizedFinancial: 0,
            committed: 0,
            costCenter: 'ALL'
        }));

        const rootNodes: BudgetNode[] = [];
        const nodeMap = new Map<string, BudgetNode>();

        allNodes.forEach(node => nodeMap.set(node.code, node));

        allNodes.forEach(node => {
            const lastDotIndex = node.code.lastIndexOf('.');
            if (lastDotIndex !== -1) {
                const parentCode = node.code.substring(0, lastDotIndex);
                const parent = nodeMap.get(parentCode);
                if (parent) {
                    parent.children.push(node);
                    node.parentId = parent.id;
                    parent.type = 'GROUP';
                } else {
                    rootNodes.push(node);
                }
            } else {
                rootNodes.push(node);
            }
        });

        return rootNodes;
    }, [appData.budget]);

    // Aggregate Financial Data per Budget Code
    const financialData = useMemo(() => {
        const map: Record<string, { total: number, rmo: number, monthly: Record<string, number> }> = {};

        appData.financialEntries?.forEach(entry => {
            entry.allocations.forEach(alloc => {
                const code = alloc.budgetGroupCode;
                if (!map[code]) map[code] = { total: 0, rmo: 0, monthly: {} };

                // Proportion of this allocation to the total entry
                const allocationRatio = alloc.value / entry.totalValue;

                entry.installments.forEach(inst => {
                    const instValue = inst.value * allocationRatio;
                    const instMonth = inst.dueDate.substring(0, 7); // YYYY-MM

                    map[code].total += instValue;

                    if (instMonth <= closedMonth) {
                        map[code].rmo += instValue;
                    } else {
                        map[code].monthly[instMonth] = (map[code].monthly[instMonth] || 0) + instValue;
                    }
                });
            });
        });

        return map;
    }, [appData.financialEntries, closedMonth]);

    // Recursive function to get calculated values for a node (including children)
    const getNodeValues = (node: BudgetNode): any => {
        let budget = 0;
        let rdoTotal = financialData[node.code]?.total || 0;
        let rmo = financialData[node.code]?.rmo || 0;
        let monthly: Record<string, number> = { ...(financialData[node.code]?.monthly || {}) };

        if (node.children && node.children.length > 0) {
            // If it has children, the value is the sum of children
            node.children.forEach(child => {
                const childValues = getNodeValues(child);
                budget += childValues.budget;
                rdoTotal += childValues.rdoTotal;
                rmo += childValues.rmo;
                Object.entries(childValues.monthly).forEach(([m, val]) => {
                    monthly[m] = (monthly[m] || 0) + (val as number);
                });
            });
        } else {
            // Leaf node: use its own budget value
            budget = node.budgetInitial || 0;
        }

        return { budget, rdoTotal, rmo, monthly };
    };

    const toggleNode = (id: string) => {
        const next = new Set(expandedNodes);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedNodes(next);
    };

    const renderRows = (nodes: BudgetNode[], level: number = 0): React.ReactNode[] => {
        let rows: React.ReactNode[] = [];

        nodes.forEach(node => {
            if (searchTerm && !node.description.toLowerCase().includes(searchTerm.toLowerCase()) && !node.code.includes(searchTerm)) {
                return;
            }

            const values = getNodeValues(node);
            const isExpanded = expandedNodes.has(node.id);
            const commitment = commitmentValues[node.code] || 0;
            const totalWithCommitment = values.rmo + commitment;
            const consumedPct = values.budget > 0 ? (totalWithCommitment / values.budget) * 100 : 0;
            const difference = values.budget - totalWithCommitment;

            rows.push(
                <tr key={node.id} className={`group border-b hover:bg-slate-50/80 transition-colors ${node.type === 'GROUP' ? 'bg-slate-50/30' : ''}`}>
                    <td className="sticky left-0 z-10 bg-inherit px-4 py-3 text-sm font-medium text-slate-900 min-w-[120px]">
                        <div className="flex items-center" style={{ paddingLeft: `${level * 20}px` }}>
                            {node.children.length > 0 && (
                                <button onClick={() => toggleNode(node.id)} className="mr-2 p-1 hover:bg-slate-200 rounded transition-colors">
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                            )}
                            {node.children.length === 0 && <div className="w-6" />}
                            <span className="font-mono text-slate-500 whitespace-nowrap">{node.code}</span>
                        </div>
                    </td>
                    <td className="sticky left-[120px] z-10 bg-inherit px-4 py-3 text-sm text-slate-700 min-w-[250px]">
                        <span className={node.type === 'GROUP' ? 'font-bold text-slate-800' : ''}>{node.description}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-blue-700 bg-blue-50/30">
                        {formatCurrency(values.budget)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600 bg-yellow-50/30 font-medium">
                        {formatCurrency(values.rdoTotal)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600 bg-orange-50/30 font-medium whitespace-nowrap">
                        <div className="text-[10px] text-slate-400 uppercase leading-none mb-1">ATÉ {getMonthLabel(closedMonth)}</div>
                        {formatCurrency(values.rmo)}
                    </td>

                    {/* Monthly Columns */}
                    {futureMonths.map((m, i) => (
                        <td key={m} className={`px-4 py-3 text-sm text-right ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                            {values.monthly[m] > 0 ? formatCurrency(values.monthly[m]) : '-'}
                        </td>
                    ))}

                    <td className="px-4 py-3 text-sm text-right font-bold text-slate-800 bg-slate-100/30 border-l border-slate-200">
                        {formatCurrency(values.rmo + (Object.values(values.monthly) as number[]).reduce((a, b) => a + b, 0))}
                    </td>

                    <td className="px-2 py-2 text-sm text-right min-w-[140px]">
                        <div className="relative group/input">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">R$</span>
                            <input
                                type="number"
                                className="w-full bg-white border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 text-right text-xs font-semibold focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 focus:outline-none transition-all shadow-sm group-hover/input:border-slate-300"
                                placeholder="0,00"
                                value={commitmentValues[node.code] || ''}
                                onChange={(e) => setCommitmentValues(prev => ({ ...prev, [node.code]: parseFloat(e.target.value) || 0 }))}
                            />
                        </div>
                    </td>

                    <td className="px-4 py-3 text-sm text-right font-semibold bg-emerald-50/30 text-emerald-800">
                        {formatCurrency(totalWithCommitment)}
                    </td>

                    <td className="px-4 py-3 text-sm text-center">
                        <div className="flex flex-col items-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${consumedPct > 100 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                {consumedPct.toFixed(2)}%
                            </span>
                            <div className="w-full h-1 bg-slate-100 rounded-full mt-1 overflow-hidden max-w-[60px]">
                                <div
                                    className={`h-full transition-all duration-500 ${consumedPct > 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                                    style={{ width: `${Math.min(consumedPct, 100)}%` }}
                                />
                            </div>
                        </div>
                    </td>

                    <td className={`px-4 py-3 text-sm text-right font-bold border-l-2 ${difference < 0 ? 'text-red-600 bg-red-50/30 border-red-500' : 'text-emerald-600 bg-emerald-50/30 border-emerald-500'
                        }`}>
                        {formatCurrency(difference)}
                    </td>
                </tr>
            );

            if (isExpanded && node.children.length > 0) {
                rows.push(...renderRows(node.children, level + 1));
            }
        });

        return rows;
    };

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden">
            {/* Header / Toolbar */}
            <div className="bg-slate-900 text-white p-6 shadow-xl relative z-20">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-400 text-slate-900 rounded-xl shadow-lg shadow-yellow-400/20">
                            <LayoutGrid size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Fluxo de Caixa Analítico</h1>
                            <p className="text-slate-400 text-sm flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Consolidação de Orçamento, RDO e Projeção Financeira
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative group">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-yellow-400 transition-colors" size={18} />
                            <select
                                value={closedMonth}
                                onChange={(e) => setClosedMonth(e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-white pl-10 pr-4 py-2.5 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none transition-all appearance-none min-w-[200px]"
                            >
                                {Array.from({ length: 24 }, (_, i) => {
                                    const d = new Date(2025, i, 1);
                                    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                    return <option key={val} value={val}>{getMonthLabel(val)}</option>;
                                })}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                        </div>

                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-yellow-400 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por código ou descrição..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-white pl-10 pr-4 py-2.5 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none transition-all w-full lg:w-64"
                            />
                        </div>

                        <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border border-slate-700">
                            <Download size={18} />
                            <span>Exportar Excel</span>
                        </button>
                    </div>
                </div>

                {/* KPI Summary Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800">
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Orçamento Total</p>
                        <p className="text-xl font-bold text-blue-400 font-mono">
                            {formatCurrency(budgetTree.reduce((sum: number, node) => sum + getNodeValues(node).budget, 0))}
                        </p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">RDO Consolidado (NFs)</p>
                        <p className="text-xl font-bold text-yellow-400 font-mono">
                            {formatCurrency(budgetTree.reduce((sum: number, node) => sum + getNodeValues(node).rdoTotal, 0))}
                        </p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Realizado até {getMonthLabel(closedMonth)}</p>
                        <p className="text-xl font-bold text-orange-400 font-mono">
                            {formatCurrency(budgetTree.reduce((sum: number, node) => sum + getNodeValues(node).rmo, 0))}
                        </p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Saldo Remanescente (Disponível)</p>
                        <p className="text-xl font-bold text-emerald-400 font-mono">
                            {formatCurrency(
                                budgetTree.reduce((sum: number, node) => sum + getNodeValues(node).budget, 0) -
                                budgetTree.reduce((sum: number, node) => sum + getNodeValues(node).rdoTotal + (commitmentValues[node.code] || 0), 0)
                            )}
                        </p>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto bg-slate-100 p-4 lg:p-6">
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-420px)] scrollbar-thin scrollbar-thumb-slate-200">
                        <table className="w-full border-collapse text-left">
                            <thead className="sticky top-0 z-30 bg-slate-50 shadow-sm">
                                <tr>
                                    <th className="sticky left-0 z-40 bg-slate-50 px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 min-w-[120px]">Código</th>
                                    <th className="sticky left-[120px] z-40 bg-slate-50 px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 min-w-[250px]">Descrição</th>
                                    <th className="px-4 py-4 text-[10px] font-bold text-blue-600 uppercase tracking-widest border-b border-slate-200 text-right bg-blue-50/50">Prev. Desembolso (Orç.)</th>
                                    <th className="px-4 py-4 text-[10px] font-bold text-yellow-600 uppercase tracking-widest border-b border-slate-200 text-right bg-yellow-50/50">RDO (Consolidado)</th>
                                    <th className="px-4 py-4 text-[10px] font-bold text-orange-600 uppercase tracking-widest border-b border-slate-200 text-right bg-orange-50/50">RMO (Realizado Mês)</th>

                                    {futureMonths.map((m, i) => (
                                        <th key={m} className={`px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 text-right ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                            {getMonthLabel(m)}
                                        </th>
                                    ))}

                                    <th className="px-4 py-4 text-[10px] font-bold text-slate-800 uppercase tracking-widest border-b border-slate-200 text-right bg-slate-100/50 border-l border-slate-200">Total Desembolsado</th>
                                    <th className="px-4 py-4 text-[10px] font-bold text-slate-800 uppercase tracking-widest border-b border-slate-200 text-right">Comprometimento</th>
                                    <th className="px-4 py-4 text-[10px] font-bold text-emerald-700 uppercase tracking-widest border-b border-slate-200 text-right bg-emerald-50/50">Realizado + Comp.</th>
                                    <th className="px-4 py-4 text-[10px] font-bold text-slate-800 uppercase tracking-widest border-b border-slate-200 text-center">% Consumida</th>
                                    <th className="px-4 py-4 text-[10px] font-bold text-slate-800 uppercase tracking-widest border-b border-slate-200 text-right">Diferença</th>
                                </tr>
                            </thead>
                            <tbody>
                                {renderRows(budgetTree)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Footer / Legend */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20"></div>
                        <span className="text-xs text-slate-600 font-medium">Gasto abaixo do Orçamento</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/20"></div>
                        <span className="text-xs text-slate-600 font-medium">Gasto acima do Orçamento</span>
                    </div>
                    <div className="h-4 w-px bg-slate-300"></div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-tight">
                        * O comprometimento deve ser lançado manualmente por G.O
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={saveConferences}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-900/10"
                    >
                        <CheckCircle2 size={14} />
                        Salvar Conferência
                    </button>
                </div>
            </div>
        </div>
    );
};
