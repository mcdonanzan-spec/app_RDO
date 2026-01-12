import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { AppData, BudgetNode, FinancialEntry, Installment } from '../../types';
import { ApiService } from '../services/api';
import { BudgetService } from '../services/budgetService';
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
    Table as TableIcon,
    Eye,
    EyeOff
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

const EditableCurrencyCell: React.FC<{
    value: number;
    onChange: (val: number) => void;
    className?: string;
    placeholder?: string;
    colorClass?: string;
    isGroup?: boolean;
}> = ({ value = 0, onChange, className, placeholder = '-', colorClass = "text-slate-700", isGroup = false }) => {
    const [isEditing, setIsEditing] = useState(false);
    const safeValue = typeof value === 'number' ? value : 0;
    const [tempValue, setTempValue] = useState<string>(safeValue === 0 ? '' : safeValue.toString());

    useEffect(() => {
        if (!isEditing) {
            setTempValue(safeValue === 0 ? '' : safeValue.toString());
        }
    }, [safeValue, isEditing]);

    if (isGroup) {
        return (
            <div className={`text-right text-[11px] font-bold font-mono pr-2 ${colorClass}`}>
                {safeValue > 0 ? formatCurrency(safeValue) : <span className="opacity-30">{placeholder}</span>}
            </div>
        );
    }

    if (isEditing) {
        return (
            <input
                type="number"
                autoFocus
                className={`w-full bg-white border-2 border-yellow-400 rounded-lg px-2 py-1 text-right text-sm font-mono outline-none shadow-lg z-50 ${className}`}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={() => {
                    setIsEditing(false);
                    onChange(parseFloat(tempValue) || 0);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        setIsEditing(false);
                        onChange(parseFloat(tempValue) || 0);
                    }
                    if (e.key === 'Escape') {
                        setIsEditing(false);
                        setTempValue(safeValue === 0 ? '' : safeValue.toString());
                    }
                }}
            />
        );
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className={`group/cell cursor-pointer text-right text-xs font-mono py-1.5 px-3 hover:bg-white hover:ring-1 hover:ring-yellow-400/30 rounded-lg transition-all border border-transparent ${colorClass} ${safeValue === 0 ? 'text-slate-300' : ''}`}
        >
            <span className="opacity-0 group-hover/cell:opacity-40 transition-opacity mr-1 text-[10px]">✎</span>
            {safeValue !== 0 ? formatCurrency(safeValue) : <span className="opacity-40 px-2 font-sans">{placeholder}</span>}
        </div>
    );
};

export const AnalyticalCashFlowView: React.FC<Props> = ({ appData, onUpdate }) => {
    const [closedMonth, setClosedMonth] = useState<string>(() => {
        const now = new Date();
        const year = now.getFullYear();
        return `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [projectionLength, setProjectionLength] = useState<number>(12);
    const [commitmentValues, setCommitmentValues] = useState<Record<string, number>>({});
    const [showResources, setShowResources] = useState(true);
    const [freezeBudgetColumn, setFreezeBudgetColumn] = useState(false);

    // Load commitments and closed month from Supabase
    React.useEffect(() => {
        const loadPersisted = async () => {
            const projectId = appData.activeProjectId;
            if (!projectId) return;

            // Reset local states to default/empty when project changes
            setCommitmentValues({});
            const now = new Date();
            setClosedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

            const data = await ApiService.getCashFlowData(projectId);
            if (data) {
                if (data.commitments) setCommitmentValues(data.commitments);
                if (data.closed_month) setClosedMonth(data.closed_month);
            }
        };
        loadPersisted();
    }, [appData.activeProjectId]);

    const saveConferences = async () => {
        const projectId = appData.activeProjectId;
        if (!projectId) {
            alert("❌ Erro: Projeto não identificado");
            return;
        }

        await ApiService.saveCashFlowData(projectId, commitmentValues, closedMonth);
        alert("✅ Conferência salva com sucesso no Supabase!");
    };

    // Generate monthly range for headers
    const futureMonths = useMemo(() => {
        return Array.from({ length: projectionLength }, (_, i) => addMonths(closedMonth, i + 1));
    }, [closedMonth, projectionLength]);

    // Build the budget tree (reusing logic from BudgetControlView)
    const budgetTree = useMemo(() => {
        let baseTree: BudgetNode[] = [];

        if (appData.consolidatedTree && appData.consolidatedTree.length > 0) {
            baseTree = BudgetService.sortTreeRecursively(appData.consolidatedTree);
        } else if (appData.budgetTree && appData.budgetTree.length > 0) {
            baseTree = BudgetService.sortTreeRecursively(appData.budgetTree);
        } else if (appData.budget && appData.budget.length > 0) {
            const allNodes: BudgetNode[] = appData.budget.map(line => ({
                id: line.id || `node-${line.code}`,
                code: line.code,
                description: line.desc,
                level: (line.code.match(/\./g) || []).length,
                totalValue: line.total,
                type: line.isGroup ? 'GROUP' : 'ITEM',
                itemType: BudgetService.getNormalizedItemType(line.type, line.code),
                children: [],
                budgetInitial: line.total,
                budgetCurrent: line.total,
                realizedRDO: 0,
                realizedFinancial: 0,
                committed: 0,
                costCenter: 'ALL'
            }));

            const nodeMap = new Map<string, BudgetNode>();
            allNodes.forEach(node => nodeMap.set(node.code, node));

            const roots: BudgetNode[] = [];
            allNodes.forEach(node => {
                const lastDotIndex = node.code.lastIndexOf('.');
                if (lastDotIndex !== -1) {
                    const parentCode = node.code.substring(0, lastDotIndex);
                    const parent = nodeMap.get(parentCode);
                    if (parent) {
                        if (!parent.children.some(c => c.id === node.id)) {
                            parent.children.push(node);
                        }
                        node.parentId = parent.id;
                        parent.type = 'GROUP';
                    } else {
                        roots.push(node);
                    }
                } else {
                    roots.push(node);
                }
            });
            baseTree = roots;
        }

        // Always return a consolidated version by code to avoid UI duplicates
        return BudgetService.getConsolidatedTree(baseTree);
    }, [appData.budget, appData.budgetTree, appData.consolidatedTree]);

    // Aggregate Financial Data per Budget Code
    const financialData = useMemo(() => {
        const map: Record<string, { total: number, rmo: number, monthly: Record<string, number> }> = {};

        appData.financialEntries
            ?.filter(entry => entry.issueDate.substring(0, 7) <= closedMonth)
            .forEach(entry => {
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

        const futureTotal = (Object.values(monthly) as number[]).reduce((a, b) => a + b, 0);

        return { budget, rdoTotal, rmo, monthly, futureTotal };
    };

    const toggleNode = (id: string) => {
        const next = new Set(expandedNodes);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedNodes(next);
    };

    const expandAll = () => {
        const allIds = new Set<string>();
        const traverse = (nodes: BudgetNode[]) => {
            nodes.forEach(node => {
                if (node.children.length > 0) {
                    allIds.add(node.id);
                    traverse(node.children);
                }
            });
        };
        traverse(budgetTree);
        setExpandedNodes(allIds);
    };

    const collapseAll = () => {
        setExpandedNodes(next => {
            const empty = new Set<string>();
            return empty;
        });
    };

    const renderRows = (nodes: BudgetNode[], level: number = 0): React.ReactNode[] => {
        let rows: React.ReactNode[] = [];

        nodes.forEach(node => {
            const isResourceNode = ['MT', 'ST', 'EQ', 'MAT', 'SRV', 'EQP'].includes(node.itemType || '');
            if (!showResources && isResourceNode) return;

            if (searchTerm && !node.description.toLowerCase().includes(searchTerm.toLowerCase()) && !node.code.includes(searchTerm)) {
                return;
            }

            const values = getNodeValues(node);
            const isExpanded = expandedNodes.has(node.id);
            const manualCommitment = commitmentValues[node.code] || 0;
            const totalComprometimento = values.futureTotal + manualCommitment;
            const totalWithComp = values.rmo + totalComprometimento;

            const consumedPct = values.budget > 0 ? (totalWithComp / values.budget) * 100 : 0;
            const difference = values.budget - totalWithComp;

            rows.push(
                <tr key={node.id} className={`group border-b hover:bg-slate-50 transition-colors ${!node.color ? (node.type === 'GROUP' ? 'bg-slate-50' : 'bg-white') : ''}`} style={node.color ? { backgroundColor: node.color } : {}}>
                    <td className={`sticky left-0 z-10 px-4 py-3 text-sm font-medium text-slate-900 min-w-[120px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] ${!node.color ? (node.type === 'GROUP' ? 'bg-slate-50' : 'bg-white') : ''}`} style={node.color ? { backgroundColor: node.color } : {}}>
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
                    <td className={`sticky left-[120px] z-10 px-4 py-3 text-sm text-slate-700 min-w-[350px] border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] ${!node.color ? (node.type === 'GROUP' ? 'bg-slate-50' : 'bg-white') : ''}`} style={node.color ? { backgroundColor: node.color } : {}}>
                        <span className={node.type === 'GROUP' ? 'font-bold text-slate-800' : ''}>{node.description}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-blue-700 bg-blue-50/30 min-w-[150px]">
                        {formatCurrency(values.budget)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600 bg-yellow-50/30 font-medium min-w-[150px]">
                        {formatCurrency(values.rdoTotal)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600 bg-orange-50/30 font-medium whitespace-nowrap min-w-[150px]">
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
                        {formatCurrency(values.rmo)}
                    </td>

                    <td className="px-2 py-2 text-right min-w-[140px]">
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] text-slate-400 font-mono mb-1">
                                {values.futureTotal > 0 ? `Parcelas: ${formatCurrency(values.futureTotal)}` : ''}
                            </span>
                            <EditableCurrencyCell
                                value={manualCommitment}
                                onChange={(val) => setCommitmentValues(prev => ({ ...prev, [node.code]: val }))}
                                isGroup={node.type === 'GROUP'}
                                colorClass="text-slate-700 font-bold"
                                placeholder="0,00"
                            />
                            {totalComprometimento > 0 && (
                                <span className="text-[10px] text-slate-800 font-bold mt-1 pt-1 border-t border-slate-200 w-full text-right">
                                    Total: {formatCurrency(totalComprometimento)}
                                </span>
                            )}
                        </div>
                    </td>

                    <td className="px-4 py-3 text-sm text-right font-semibold bg-emerald-50/30 text-emerald-800">
                        {formatCurrency(totalWithComp)}
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
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-400 text-slate-900 rounded-xl shadow-lg shadow-yellow-400/20">
                            <LayoutGrid size={28} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl font-bold tracking-tight">Fluxo de Caixa Analítico</h1>
                            <p className="text-slate-400 text-sm mt-1 whitespace-nowrap overflow-hidden text-ellipsis mr-4">
                                Consolidação de Orçamento, RDO e Projeção Financeira
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 flex-shrink-0">
                        <div className="flex flex-wrap lg:flex-nowrap items-center gap-3">
                            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                                <button
                                    onClick={expandAll}
                                    title="Expandir todos os grupos"
                                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-all"
                                >
                                    Expandir Tudo
                                </button>
                                <div className="w-px h-4 bg-slate-700 my-auto mx-1"></div>
                                <button
                                    onClick={collapseAll}
                                    title="Recolher todos os grupos"
                                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-all"
                                >
                                    Agrupar
                                </button>
                            </div>

                            <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-1 border border-slate-700">
                                <div className="relative group px-1">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-yellow-400 transition-colors" size={16} />
                                    <input
                                        type="month"
                                        value={closedMonth}
                                        onChange={(e) => setClosedMonth(e.target.value)}
                                        className="bg-transparent text-white pl-10 pr-4 py-2 text-sm focus:outline-none transition-all font-bold min-w-[150px]"
                                        title="Mês de Fechamento"
                                    />
                                </div>
                                <div className="w-px h-6 bg-slate-700"></div>
                                <div className="flex items-center gap-3 px-3 py-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden lg:inline">Projetar</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="60"
                                        value={projectionLength}
                                        onChange={(e) => setProjectionLength(parseInt(e.target.value) || 1)}
                                        className="w-14 bg-slate-700/50 border border-slate-600 text-white px-2 py-1 rounded text-center text-sm font-black focus:ring-2 focus:ring-yellow-400/50 outline-none transition-all"
                                    />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap hidden lg:inline">Meses</span>
                                </div>
                            </div>

                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-yellow-400 transition-colors" size={18} />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-slate-800 border border-slate-700 text-white pl-10 pr-4 py-2.5 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none transition-all w-full lg:w-48"
                                />
                            </div>

                            <button
                                onClick={() => setShowResources(!showResources)}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold shadow-sm border transition-all ${showResources ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white' : 'bg-yellow-400 text-slate-900 border-yellow-500'}`}
                                title={showResources ? "Ocultar detalhamento de recursos (MT, ST, EQ)" : "Mostrar detalhamento de recursos (MT, ST, EQ)"}
                            >
                                {showResources ? <EyeOff size={16} /> : <Eye size={16} />}
                                <span className="hidden lg:inline">{showResources ? 'Ocultar' : 'Mostrar'}</span>
                            </button>

                            <button
                                onClick={() => setFreezeBudgetColumn(!freezeBudgetColumn)}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold shadow-sm border transition-all ${freezeBudgetColumn ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}
                                title={freezeBudgetColumn ? "Descongelar colunas" : "Congelar Budget"}
                            >
                                <LayoutGrid size={16} />
                                <span className="hidden lg:inline">{freezeBudgetColumn ? '❄️' : 'Congelar'}</span>
                            </button>

                            <button
                                onClick={(() => {
                                    const monthsHeaders = futureMonths.map(m => getMonthLabel(m));
                                    const headersOrder = [
                                        'CÓDIGO', 'DESCRIÇÃO', 'ORÇAMENTO (PREV. DESEMBOLSO)', 'RDO (CONSOLIDADO)', 'RMO (REALIZADO MÊS)',
                                        ...monthsHeaders,
                                        'TOTAL DESEMBOLSADO', 'COMPROMETIMENTO', 'REALIZADO + COMP.', '% CONSUMIDA', 'DIFERENÇA'
                                    ];

                                    const data: any[][] = [headersOrder];
                                    const flatten = (nodes: BudgetNode[], level = 0) => {
                                        nodes.forEach(node => {
                                            const v = getNodeValues(node);
                                            const commitment = commitmentValues[node.code] || 0;
                                            const realPlusComp = v.rmo + commitment;
                                            const consumed = v.budget > 0 ? (realPlusComp / v.budget) : 0;
                                            const diff = v.budget - realPlusComp;
                                            const totalProjected = v.rmo + futureMonths.reduce((acc, m) => acc + (v.monthly[m] || 0), 0);
                                            const prefix = node.children.length > 0 ? '➤ ' : '  ';
                                            const desc = '  '.repeat(level) + prefix + node.description;

                                            const rowArr: any[] = [node.code, desc, v.budget, v.rdoTotal, v.rmo];
                                            futureMonths.forEach(m => rowArr.push(v.monthly[m] || 0));
                                            rowArr.push(totalProjected, commitment, realPlusComp, consumed, diff);
                                            data.push(rowArr);
                                            if (node.children) flatten(node.children, level + 1);
                                        });
                                    };
                                    flatten(budgetTree);
                                    const worksheet = XLSX.utils.aoa_to_sheet(data);
                                    const currencyFormat = '"R$ "#,##0.00;[Red]"R$ "-#,##0.00';
                                    const percentFormat = '0.00%';
                                    const range = XLSX.utils.decode_range(worksheet['!ref']!);
                                    for (let R = range.s.r; R <= range.e.r; ++R) {
                                        for (let C = range.s.c; C <= range.e.c; ++C) {
                                            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                                            if (!worksheet[cellRef] || R === 0) continue;
                                            const isCurrencyCol = (C >= 2 && C <= 4) || (C >= (range.e.c - 4) && C !== (range.e.c - 1)) || (C > 4 && C < (range.e.c - 4));
                                            const isPercentCol = C === (range.e.c - 1);
                                            if (isCurrencyCol && typeof worksheet[cellRef].v === 'number') worksheet[cellRef].z = currencyFormat;
                                            if (isPercentCol && typeof worksheet[cellRef].v === 'number') worksheet[cellRef].z = percentFormat;
                                        }
                                    }
                                    worksheet['!cols'] = [{ wch: 15 }, { wch: 45 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, ...futureMonths.map(() => ({ wch: 15 })), { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 20 }];
                                    const workbook = XLSX.utils.book_new();
                                    XLSX.utils.book_append_sheet(workbook, worksheet, "Fluxo de Caixa");
                                    XLSX.writeFile(workbook, `Mapa_Fluxo_Caixa_${new Date().toISOString().split('T')[0]}.xlsx`);
                                })}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg active:scale-95 group"
                            >
                                <Download size={18} className="group-hover:bounce-subtle" />
                                <span className="hidden lg:inline">Excel</span>
                            </button>

                            <button
                                onClick={saveConferences}
                                className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-lg text-sm font-black transition-all flex items-center gap-2 shadow-lg shadow-yellow-400/20 active:scale-95 whitespace-nowrap"
                            >
                                <CheckCircle2 size={18} />
                                Salvar Conferência
                            </button>
                        </div>

                        {/* Legend row */}
                        <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 px-1">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20"></div>
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none">Gasto Abaixo</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/20"></div>
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none">Gasto Acima</span>
                            </div>
                            <div className="hidden lg:block w-px h-3 bg-slate-700"></div>
                            <span className="text-[10px] text-slate-500 font-medium italic">* O comprometimento deve ser lançado manualmente por G.O</span>
                        </div>
                    </div>
                </div>

                {/* KPI Summary Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 pt-6 border-t border-slate-800">
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Orçamento Total</p>
                        <p className="text-xl font-bold text-blue-400 font-mono">
                            {formatCurrency(budgetTree.reduce((sum: number, node: BudgetNode) => sum + getNodeValues(node).budget, 0))}
                        </p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">RDO Consolidado (NFs)</p>
                        <p className="text-xl font-bold text-yellow-400 font-mono">
                            {formatCurrency(budgetTree.reduce((sum: number, node: BudgetNode) => sum + getNodeValues(node).rdoTotal, 0))}
                        </p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Realizado até {getMonthLabel(closedMonth)}</p>
                        <p className="text-xl font-bold text-orange-400 font-mono">
                            {formatCurrency(budgetTree.reduce((sum: number, node: BudgetNode) => sum + getNodeValues(node).rmo, 0))}
                        </p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-800/80 transition-colors border-l-2 border-l-yellow-400/30">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Comprometido</p>
                        <p className="text-xl font-bold text-white font-mono">
                            {formatCurrency(
                                budgetTree.reduce((sum: number, node: BudgetNode) => {
                                    const v = getNodeValues(node);
                                    const manual = commitmentValues[node.code] || 0;
                                    return sum + v.futureTotal + manual;
                                }, 0)
                            )}
                        </p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Saldo Remanescente</p>
                        <p className="text-xl font-bold text-emerald-400 font-mono">
                            {formatCurrency(
                                budgetTree.reduce((sum: number, node: BudgetNode) => sum + getNodeValues(node).budget, 0) -
                                budgetTree.reduce((sum: number, node: BudgetNode) => {
                                    const v = getNodeValues(node);
                                    const manual = commitmentValues[node.code] || 0;
                                    return sum + v.rmo + v.futureTotal + manual;
                                }, 0)
                            )}
                        </p>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-hidden bg-slate-100 p-4 lg:p-6 pb-2">
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden h-full flex flex-col">
                    <div className="overflow-x-auto overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                        <table className="w-full border-collapse text-left">
                            <thead className="sticky top-0 z-30 bg-slate-50 shadow-sm">
                                <tr>
                                    <th className="sticky left-0 z-40 bg-slate-50 px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 min-w-[120px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Código</th>
                                    <th className="sticky left-[120px] z-40 bg-slate-50 px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 min-w-[250px] border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Descrição</th>
                                    <th className="px-4 py-4 text-[10px] font-bold text-blue-600 uppercase tracking-widest border-b border-slate-200 text-right bg-blue-50/50">Prev. (Orç.)</th>
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
        </div>
    );
};
