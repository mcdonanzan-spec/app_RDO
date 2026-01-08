import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { AppData, BudgetNode } from '../../types';
import {
    Calendar,
    Search,
    ChevronDown,
    ChevronRight,
    DollarSign,
    Save,
    Download,
    RefreshCw,
    TrendingUp,
    LayoutGrid,
    CheckCircle2,
    Filter,
    Eye,
    EyeOff,
    AlertTriangle,
    SortDesc,
    ArrowUpDown,
    AlertCircle,
    ArrowRightLeft,
    Edit3
} from 'lucide-react';

interface Props {
    appData: AppData;
    onUpdate?: (data: Partial<AppData>) => void;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

const getMonthLabel = (dateStr: string) => {
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('pt-BR', { month: 'long', year: '2-digit' }).toUpperCase();
};

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
            <div className={`text-right text-xs font-bold font-mono pr-2 ${colorClass}`}>
                {value > 0 ? formatCurrency(value) : placeholder}
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
                        setTempValue(value === 0 ? '' : value.toString());
                    }
                }}
            />
        );
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className={`group/cell cursor-pointer text-right text-sm font-mono py-1.5 px-3 hover:bg-white hover:ring-1 hover:ring-yellow-400/30 rounded-lg transition-all border border-transparent ${colorClass} ${safeValue === 0 ? 'text-slate-300' : ''}`}
        >
            <span className="opacity-0 group-hover/cell:opacity-40 transition-opacity mr-1 text-[10px]">✎</span>
            {safeValue !== 0 ? formatCurrency(safeValue) : <span className="opacity-40 px-2 font-sans">{placeholder}</span>}
        </div>
    );
};

export const DisbursementForecastView: React.FC<Props> = ({ appData, onUpdate }) => {
    const [startingMonth, setStartingMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [forecastData, setForecastData] = useState<Record<string, Record<string, number>>>({}); // code -> { month: value }
    const [showResources, setShowResources] = useState(true);
    const [budgetOverrides, setBudgetOverrides] = useState<Record<string, number>>({}); // code -> budget value
    const [descriptionOverrides, setDescriptionOverrides] = useState<Record<string, string>>({}); // code -> description
    const [projectionLength, setProjectionLength] = useState<number>(18);
    const [analysisFilter, setAnalysisFilter] = useState<'ALL' | 'OVER' | 'UNDER'>('ALL');
    const [hideEmpty, setHideEmpty] = useState(false);
    const [sortBy, setSortBy] = useState<'CODE' | 'VARIANCE'>('CODE');
    const [isLoading, setIsLoading] = useState(true);
    const [implementationMode, setImplementationMode] = useState(false);
    const [initialRealized, setInitialRealized] = useState<Record<string, number>>({}); // code -> value

    // Load forecast from DB
    useEffect(() => {
        const loadForecast = async () => {
            setIsLoading(true);
            try {
                const { db } = await import('../services/db');
                const savedForecast = await db.meta.get('disbursementForecast');
                if (savedForecast) {
                    setForecastData(savedForecast.value);
                }
                const savedMonth = await db.meta.get('cashFlowClosedMonth');
                if (savedMonth) {
                    setStartingMonth(savedMonth.value);
                }
                const savedBudgetOverrides = await db.meta.get('disbursementBudgetOverrides');
                if (savedBudgetOverrides) {
                    setBudgetOverrides(savedBudgetOverrides.value);
                }
                const savedDescOverrides = await db.meta.get('disbursementDescOverrides');
                if (savedDescOverrides) {
                    setDescriptionOverrides(savedDescOverrides.value);
                }
                const savedProjectionLength = await db.meta.get('disbursementForecastProjectionLength');
                if (savedProjectionLength) {
                    setProjectionLength(savedProjectionLength.value);
                }
                const savedInitialRealized = await db.meta.get('disbursementInitialRealized');
                if (savedInitialRealized) {
                    setInitialRealized(savedInitialRealized.value);
                }
            } catch (err) {
                console.error("Failed to load forecast", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadForecast();
    }, []);

    const saveForecast = async () => {
        try {
            const { db } = await import('../services/db');
            await db.meta.put({ key: 'disbursementForecast', value: forecastData });
            await db.meta.put({ key: 'disbursementForecastStartMonth', value: startingMonth });
            await db.meta.put({ key: 'disbursementBudgetOverrides', value: budgetOverrides });
            await db.meta.put({ key: 'disbursementDescOverrides', value: descriptionOverrides });
            await db.meta.put({ key: 'disbursementForecastProjectionLength', value: projectionLength });
            await db.meta.put({ key: 'disbursementInitialRealized', value: initialRealized });
            alert("✅ Previsão de desembolso e definições salvas com sucesso!");
        } catch (err) {
            console.error("Failed to save forecast", err);
            alert("❌ Erro ao salvar previsão.");
        }
    };

    // Generate months from starting month based on projection length
    const months = useMemo(() => {
        return Array.from({ length: projectionLength }, (_, i) => addMonths(startingMonth, i));
    }, [startingMonth, projectionLength]);

    // Build budget tree
    const budgetTree = useMemo(() => {
        if (appData.consolidatedTree && appData.consolidatedTree.length > 0) return appData.consolidatedTree;
        if (appData.budgetTree && appData.budgetTree.length > 0) return appData.budgetTree;
        if (!appData.budget || appData.budget.length === 0) return [];

        const sortedLines = [...appData.budget].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

        const allNodes: BudgetNode[] = sortedLines.map(line => ({
            id: line.id || `node-${line.code}`,
            code: line.code,
            description: line.desc,
            level: (line.code.match(/\./g) || []).length,
            totalValue: line.total,
            type: line.isGroup || line.children ? 'GROUP' : 'ITEM',
            children: [],
            budgetInitial: line.total,
            budgetCurrent: line.total,
            realizedRDO: 0,
            realizedFinancial: 0,
            committed: 0
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
                } else {
                    rootNodes.push(node);
                }
            } else {
                rootNodes.push(node);
            }
        });

        return rootNodes;
    }, [appData.budget, appData.budgetTree, appData.consolidatedTree]);

    // Aggregate Financial Data per Budget Code (Same as AnalyticalCashFlowView)
    const financialData = useMemo(() => {
        const map: Record<string, { total: number, rmo: number, monthly: Record<string, number> }> = {};
        const closedMonth = startingMonth; // Using startingMonth as the threshold for "Realized"

        appData.financialEntries
            ?.filter(entry => entry.issueDate.substring(0, 7) <= closedMonth)
            .forEach(entry => {
                entry.allocations.forEach(alloc => {
                    const code = alloc.budgetGroupCode;
                    if (!map[code]) map[code] = { total: 0, rmo: 0, monthly: {} };

                    const allocationRatio = alloc.value / entry.totalValue;

                    entry.installments.forEach(inst => {
                        const instValue = inst.value * allocationRatio;
                        const instMonth = inst.dueDate.substring(0, 7);

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
    }, [appData.financialEntries, startingMonth]);

    const getNodeValues = (node: BudgetNode): any => {
        let budget = budgetOverrides[node.code] !== undefined ? budgetOverrides[node.code] : (node.budgetInitial || 0);
        let nfRealized = financialData[node.code]?.rmo || 0;
        let nfFuture = financialData[node.code]?.monthly || {};
        let manualForecast = forecastData[node.code] || {};

        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                const childValues = getNodeValues(child);
                budget += childValues.budget;
                nfRealized += childValues.nfRealized;
                Object.entries(childValues.nfFuture).forEach(([m, val]) => {
                    nfFuture[m] = (nfFuture[m] || 0) + (val as number);
                });
                Object.entries(childValues.manualForecast).forEach(([m, val]) => {
                    manualForecast[m] = (manualForecast[m] || 0) + (val as number);
                });
            });
        }

        const retroRealized = initialRealized[node.code] || 0;

        return { budget, nfRealized, nfFuture, manualForecast, retroRealized };
    };

    // Helper to aggregate data from Analytical Cash Flow
    const importFromCashFlow = () => {
        if (!window.confirm("Isso irá sobrescrever os valores atuais da previsão com os dados reais do fluxo de caixa analítico (NFs). Deseja continuar?")) return;

        const newForecast: Record<string, Record<string, number>> = {};

        appData.financialEntries?.forEach(entry => {
            entry.allocations.forEach(alloc => {
                const code = alloc.budgetGroupCode;
                if (!newForecast[code]) newForecast[code] = {};

                const allocationRatio = alloc.value / entry.totalValue;

                entry.installments.forEach(inst => {
                    const instValue = inst.value * allocationRatio;
                    const instMonth = inst.dueDate.substring(0, 7); // YYYY-MM
                    newForecast[code][instMonth] = (newForecast[code][instMonth] || 0) + instValue;
                });
            });
        });

        setForecastData(newForecast);
    };

    const handleCellChange = (code: string, month: string, value: number) => {
        setForecastData(prev => ({
            ...prev,
            [code]: {
                ...(prev[code] || {}),
                [month]: value
            }
        }));
    };

    // Recursive helper to get forecast values for a node
    const getNodeForecast = (node: BudgetNode): { monthly: Record<string, number>, total: number } => {
        const monthly: Record<string, number> = {};
        let total = 0;

        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                const childForecast = getNodeForecast(child);
                Object.entries(childForecast.monthly).forEach(([m, val]) => {
                    monthly[m] = (monthly[m] || 0) + val;
                });
                total += childForecast.total;
            });
        } else {
            const nodeData = forecastData[node.code] || {};
            Object.entries(nodeData).forEach(([m, val]) => {
                monthly[m] = val;
                total += val;
            });
        }

        return { monthly, total };
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
        setExpandedNodes(new Set());
    };

    // Helper to determine if a node (or any of its descendants) match the current filters
    const matchesFilters = (node: BudgetNode): boolean => {
        const { total } = getNodeForecast(node);
        const budget = budgetOverrides[node.code] !== undefined ? budgetOverrides[node.code] : (node.budgetInitial || 0);

        // Search term check
        const matchesSearch = !searchTerm ||
            node.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            node.code.includes(searchTerm);

        // Empty check
        const isEmpty = total === 0 && budget === 0;
        if (hideEmpty && isEmpty) return false;

        // Status check
        const isOver = total > budget + 0.01;
        const isUnder = total <= budget && (total > 0 || budget > 0);

        let statusMatch = true;
        if (analysisFilter === 'OVER') statusMatch = isOver;
        if (analysisFilter === 'UNDER') statusMatch = isUnder;

        // If current node matches everything, return true
        if (matchesSearch && statusMatch) return true;

        // Or if ANY child matches everything
        return node.children.some(child => matchesFilters(child));
    };

    const renderRows = (nodes: BudgetNode[], level: number = 0): React.ReactNode[] => {
        let rows: React.ReactNode[] = [];

        // Apply sorting
        const sortedNodes = [...nodes].sort((a, b) => {
            if (sortBy === 'VARIANCE') {
                const { total: totalA } = getNodeForecast(a);
                const budgetA = budgetOverrides[a.code] !== undefined ? budgetOverrides[a.code] : (a.budgetInitial || 0);
                const diffA = budgetA - totalA;

                const { total: totalB } = getNodeForecast(b);
                const budgetB = budgetOverrides[b.code] !== undefined ? budgetOverrides[b.code] : (b.budgetInitial || 0);
                const diffB = budgetB - totalB;

                return diffA - diffB; // Ascending variance (most negative/overflow first)
            }
            return a.code.localeCompare(b.code, undefined, { numeric: true });
        });

        sortedNodes.forEach(node => {
            const isResourceNode = ['MT', 'ST', 'EQ', 'MAT', 'SRV', 'EQP'].includes(node.itemType || '');
            if (!showResources && isResourceNode) return;

            if (!matchesFilters(node)) return;

            const isExpanded = expandedNodes.has(node.id);
            const values = getNodeValues(node);
            const description = descriptionOverrides[node.code] !== undefined ? descriptionOverrides[node.code] : node.description;

            // Total calculate logic:
            // Retroactive (Manual Setup) + Past months (<= startingMonth) = Actual NF Payments
            // Future months (> startingMonth) = NF Installments + Manual Adjustments
            const retroVal = initialRealized[node.code] || 0;
            let totalProjected = values.nfRealized + retroVal;
            months.filter(m => m > startingMonth).forEach(m => {
                totalProjected += (values.nfFuture[m] || 0) + (values.manualForecast[m] || 0);
            });

            const diff = values.budget - totalProjected;
            const consumedPct = values.budget > 0 ? (totalProjected / values.budget) * 100 : 0;

            rows.push(
                <tr key={node.id} className={`group border-b hover:bg-slate-50 transition-colors ${!node.color ? (node.children.length > 0 ? 'bg-slate-50/80' : 'bg-white') : ''}`} style={node.color ? { backgroundColor: node.color } : {}}>
                    <td className={`sticky left-0 z-10 px-4 py-3 text-sm font-medium text-slate-900 min-w-[120px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] ${!node.color ? (node.children.length > 0 ? 'bg-slate-50' : 'bg-white') : ''}`} style={node.color ? { backgroundColor: node.color } : {}}>
                        <div className="flex items-center" style={{ paddingLeft: `${level * 20}px` }}>
                            {node.children.length > 0 && (
                                <button onClick={() => toggleNode(node.id)} className="mr-2 p-1 hover:bg-slate-200 rounded transition-colors text-slate-400">
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                            )}
                            {node.children.length === 0 && <div className="w-6" />}
                            <span className="font-mono text-slate-500 text-xs">{node.code}</span>
                        </div>
                    </td>
                    <td className={`sticky left-[120px] z-10 px-4 py-3 text-sm text-slate-700 min-w-[280px] border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] ${!node.color ? (node.children.length > 0 ? 'bg-slate-50' : 'bg-white') : ''}`} style={node.color ? { backgroundColor: node.color } : {}}>
                        <input
                            className={`w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-yellow-400 outline-none transition-all ${node.children.length > 0 ? 'font-bold text-slate-800' : 'text-slate-600'}`}
                            value={description}
                            onChange={(e) => setDescriptionOverrides(prev => ({ ...prev, [node.code]: e.target.value }))}
                        />
                    </td>
                    <td className="px-4 py-3 bg-blue-50/20 text-right">
                        <EditableCurrencyCell
                            value={values.budget}
                            onChange={(val) => setBudgetOverrides(prev => ({ ...prev, [node.code]: val }))}
                            colorClass="text-blue-700 font-bold"
                            isGroup={node.children.length > 0}
                        />
                    </td>

                    {/* Implementation Mode: Manual Initial Realized */}
                    {implementationMode && (
                        <td className="px-4 py-3 bg-orange-50/20 border-l border-orange-100">
                            <EditableCurrencyCell
                                value={initialRealized[node.code] || 0}
                                onChange={(val) => setInitialRealized(prev => ({ ...prev, [node.code]: val }))}
                                colorClass="text-orange-700 font-bold"
                                placeholder="Saldo Histórico"
                                isGroup={node.children.length > 0}
                            />
                        </td>
                    )}

                    {/* Monthly Forecast Cells */}
                    {months.map(m => {
                        const isPast = m <= startingMonth;
                        const nfValue = m <= startingMonth ? values.nfFuture[m] || 0 : values.nfFuture[m] || 0; // In case of rmo, handled above
                        // In reality, for past months we show Realized
                        const displayVal = isPast
                            ? (m === startingMonth ? values.nfRealized : 0) // Simplify: use rmo for current
                            : (values.nfFuture[m] || 0) + (values.manualForecast[m] || 0);

                        return (
                            <td key={m} className={`px-2 py-2 min-w-[140px] ${isPast ? 'bg-slate-100/50' : ''}`}>
                                {isPast ? (
                                    <div className="text-right px-3 py-1.5 text-xs font-mono text-slate-400">
                                        {displayVal > 0 ? formatCurrency(displayVal) : '-'}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] text-slate-400 font-mono">
                                            {values.nfFuture[m] > 0 ? `Parcela: ${formatCurrency(values.nfFuture[m])}` : ''}
                                        </span>
                                        <EditableCurrencyCell
                                            value={node.children.length > 0 ? (values.manualForecast[m] || 0) : (forecastData[node.code]?.[m] || 0)}
                                            onChange={(val) => handleCellChange(node.code, m, val)}
                                            isGroup={node.children.length > 0}
                                            placeholder="Prev."
                                            colorClass={node.children.length > 0 ? "text-slate-600" : "text-slate-800"}
                                        />
                                    </div>
                                )}
                            </td>
                        );
                    })}

                    <td className="px-4 py-3 text-sm text-right font-bold text-slate-800 bg-slate-100/30 border-l border-slate-200">
                        {formatCurrency(totalProjected)}
                    </td>

                    <td className={`px-4 py-3 text-sm text-right font-bold border-l-2 ${diff < 0 ? 'text-red-600 bg-red-50/30 border-red-500' : 'text-emerald-600 bg-emerald-50/30 border-emerald-500'}`}>
                        <div className="flex flex-col items-end">
                            <span>{formatCurrency(diff)}</span>
                            <span className="text-[10px] font-normal opacity-70">{consumedPct.toFixed(1)}% utilizado</span>
                        </div>
                    </td>
                </tr>
            );

            if (isExpanded && node.children.length > 0) {
                rows.push(...renderRows(node.children, level + 1));
            }
        });

        return rows;
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-12 h-12 text-yellow-500 animate-spin" />
                    <p className="text-slate-500 font-medium tracking-wide">Carregando Previsão de Desembolso...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden">
            {/* Header / Premium Toolbar */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 shadow-2xl relative z-20">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-yellow-400 text-slate-900 rounded-2xl shadow-[0_0_20px_rgba(250,204,21,0.3)] transform hover:scale-105 transition-transform">
                            <TrendingUp size={32} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-black tracking-tighter uppercase">Previsão de Desembolso</h1>
                                <span className="bg-yellow-400/10 text-yellow-400 text-[10px] font-black px-2 py-0.5 rounded border border-yellow-400/20 uppercase tracking-widest">Beta</span>
                            </div>
                            <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
                                <AlertCircle size={14} className="text-yellow-400" />
                                Gestão Inteligente de G.O e Fluxo Futuro (DRE Projetado)
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex bg-slate-800/50 rounded-xl p-1 border border-slate-700 backdrop-blur-sm">
                            <button
                                onClick={expandAll}
                                title="Expandir todos os grupos"
                                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                            >
                                Expandir Tudo
                            </button>
                            <div className="w-px h-4 bg-slate-700 my-auto mx-1"></div>
                            <button
                                onClick={collapseAll}
                                title="Recolher todos os grupos"
                                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                            >
                                Agrupar
                            </button>
                        </div>

                        <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl p-1 border border-slate-700 backdrop-blur-sm">
                            <div className="relative group px-1">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-yellow-400 transition-colors" size={16} />
                                <input
                                    type="month"
                                    value={startingMonth}
                                    onChange={(e) => setStartingMonth(e.target.value)}
                                    className="bg-transparent text-white pl-10 pr-4 py-2 text-sm focus:outline-none transition-all font-bold min-w-[170px]"
                                    title="Mês de Início"
                                />
                            </div>
                            <div className="w-px h-6 bg-slate-700"></div>
                            <div className="flex items-center gap-3 px-3 py-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Projetar</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    value={projectionLength}
                                    onChange={(e) => setProjectionLength(parseInt(e.target.value) || 1)}
                                    className="w-16 bg-slate-700/50 border border-slate-600 text-white px-2 py-1 rounded text-center text-sm font-black focus:ring-2 focus:ring-yellow-400/50 outline-none transition-all"
                                />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Meses</span>
                            </div>
                        </div>

                        <div className="flex items-center bg-slate-800/50 rounded-xl p-1 border border-slate-700 backdrop-blur-sm">
                            <button
                                onClick={importFromCashFlow}
                                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                                title="Importar valores realizados das NFs do Fluxo de Caixa Analítico"
                            >
                                <ArrowRightLeft size={16} />
                                Importar Realizado
                            </button>
                            <div className="w-px h-6 bg-slate-700 mx-1"></div>
                            <button
                                onClick={saveForecast}
                                className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-yellow-400 text-slate-900 rounded-lg hover:bg-yellow-300 transition-all shadow-lg active:scale-95"
                            >
                                <Save size={16} />
                                Salvar Projeção
                            </button>
                        </div>

                        <button
                            onClick={() => setShowResources(!showResources)}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-lg ${showResources ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-yellow-400 text-slate-900 border-yellow-500'}`}
                            title={showResources ? "Ocultar detalhamento de recursos (MT, ST, EQ)" : "Mostrar detalhamento de recursos (MT, ST, EQ)"}
                        >
                            {showResources ? <EyeOff size={16} /> : <Eye size={16} />}
                            {showResources ? 'Ocultar Recursos' : 'Mostrar Recursos'}
                        </button>

                        <button
                            onClick={() => setImplementationMode(!implementationMode)}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-lg ${implementationMode ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                        >
                            <AlertTriangle size={16} />
                            {implementationMode ? 'Modo Implantação Ativo' : 'Modo Implantação'}
                        </button>

                        <button
                            onClick={() => {
                                // Excel Export logic (summarized)
                                const data: any[][] = [['CÓDIGO', 'DESCRIÇÃO', 'ORÇAMENTO', ...months.map(getMonthLabel), 'TOTAL PROJETADO', 'DIFERENÇA']];
                                const flatten = (nodes: BudgetNode[]) => {
                                    nodes.forEach(node => {
                                        const { monthly, total } = getNodeForecast(node);
                                        const row = [node.code, node.description, node.budgetInitial, ...months.map(m => monthly[m] || 0), total, node.budgetInitial - total];
                                        data.push(row);
                                        if (node.children) flatten(node.children);
                                    });
                                };
                                flatten(budgetTree);
                                const ws = XLSX.utils.aoa_to_sheet(data);
                                const wb = XLSX.utils.book_new();
                                XLSX.utils.book_append_sheet(wb, ws, "Previsão");
                                XLSX.writeFile(wb, `Previsao_Desembolso_${startingMonth}.xlsx`);
                            }}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95 group"
                        >
                            <Download size={18} className="group-hover:bounce-subtle" /> Exportar Excel Pro
                        </button>
                    </div>
                </div>

                {/* Dashboard Stats Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 pt-6 border-t border-slate-800/50">
                    <div className="group cursor-help">
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                            <DollarSign size={10} className="text-blue-400" />
                            CAPEX Total (Orçado)
                        </p>
                        <p className="text-2xl font-black text-white font-mono group-hover:text-blue-400 transition-colors">
                            {formatCurrency(budgetTree.reduce((sum, n) => sum + (n.budgetInitial || 0), 0))}
                        </p>
                    </div>
                    <div className="group cursor-help">
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                            <TrendingUp size={10} className="text-yellow-400" />
                            Total Projetado (Real + Prev)
                        </p>
                        <p className="text-2xl font-black text-white font-mono group-hover:text-yellow-400 transition-colors">
                            {formatCurrency(budgetTree.reduce((sum, n) => {
                                const v = getNodeValues(n);
                                let total = v.nfRealized;
                                months.filter(m => m > startingMonth).forEach(m => {
                                    total += (v.nfFuture[m] || 0) + (v.manualForecast[m] || 0);
                                });
                                return sum + total;
                            }, 0))}
                        </p>
                    </div>
                    <div className="group cursor-help">
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                            <LayoutGrid size={10} className="text-emerald-400" />
                            Saldo Remanescente
                        </p>
                        <p className={`text-2xl font-black font-mono text-white transition-colors`}>
                            {formatCurrency(
                                budgetTree.reduce((sum, n) => sum + (budgetOverrides[n.code] !== undefined ? budgetOverrides[n.code] : (n.budgetInitial || 0)), 0) -
                                budgetTree.reduce((sum, n) => {
                                    const v = getNodeValues(n);
                                    let total = v.nfRealized;
                                    months.filter(m => m > startingMonth).forEach(m => {
                                        total += (v.nfFuture[m] || 0) + (v.manualForecast[m] || 0);
                                    });
                                    return sum + total;
                                }, 0)
                            )}
                        </p>
                    </div>
                    <div className="group cursor-help" title={`Indicador de Cobertura do Orçamento:\n\nMostra quanto do orçamento total já está "comprometido" (Soma do Realizado + Previsão Futura).\n\nCálculo: (Total Projetado / Budget Total) * 100\n\n• Se estiver muito baixo (< 20%): Indica que falta lançar as projeções financeiras para o restante da obra.\n• Se estiver próximo de 100%: O planejamento cobre todo o orçamento.\n• Se passar de 100%: Indica estouro previsto no custo da obra.`}>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                            <CheckCircle2 size={10} className="text-purple-400" />
                            Cobertura do Planejamento (Aderência)
                        </p>
                        <div className="flex items-end gap-3">
                            <p className="text-2xl font-black text-white font-mono">
                                {((budgetTree.reduce((sum, n) => sum + getNodeForecast(n).total, 0) / (budgetTree.reduce((sum, n) => sum + (n.budgetInitial || 0), 0) || 1)) * 100).toFixed(1)}%
                            </p>
                            <div className="flex-1 h-2 bg-slate-700 rounded-full mb-2 overflow-hidden min-w-[60px]">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000"
                                    style={{ width: `${Math.min((budgetTree.reduce((sum, n) => sum + getNodeForecast(n).total, 0) / (budgetTree.reduce((sum, n) => sum + (n.budgetInitial || 0), 0) || 1)) * 100, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Table Content */}
            <div className="flex-1 overflow-auto bg-slate-100 p-6">
                <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-200 overflow-hidden h-full flex flex-col">
                    <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-6">
                        <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Filtrar por código ou descrição..."
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 outline-none transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                                <button
                                    onClick={() => setAnalysisFilter('ALL')}
                                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${analysisFilter === 'ALL' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => setAnalysisFilter('OVER')}
                                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${analysisFilter === 'OVER' ? 'bg-red-600 text-white shadow-md' : 'text-red-500/60 hover:text-red-600 hover:bg-red-50'}`}
                                >
                                    <AlertTriangle size={12} />
                                    Estouros
                                </button>
                                <button
                                    onClick={() => setAnalysisFilter('UNDER')}
                                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${analysisFilter === 'UNDER' ? 'bg-emerald-600 text-white shadow-md' : 'text-emerald-500/60 hover:text-emerald-600 hover:bg-emerald-50'}`}
                                >
                                    <CheckCircle2 size={12} />
                                    Ok
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setHideEmpty(!hideEmpty)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${hideEmpty ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                title="Ocultar linhas que não possuem orçamento nem projeção"
                            >
                                <EyeOff size={14} />
                                {hideEmpty ? 'Mostrando Relevantes' : 'Ocultar Vazios'}
                            </button>

                            <button
                                onClick={() => setSortBy(sortBy === 'CODE' ? 'VARIANCE' : 'CODE')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${sortBy === 'VARIANCE' ? 'bg-orange-50 border-orange-200 text-orange-600 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                title="Ordenar por variação (maiores estouros primeiro)"
                            >
                                <SortDesc size={14} />
                                {sortBy === 'VARIANCE' ? 'Ordenado por Estouro' : 'Ordenar por Estouro'}
                            </button>

                            <div className="w-px h-6 bg-slate-200"></div>

                            <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <span className="uppercase tracking-tighter">Budget</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                                    <span className="uppercase tracking-tighter">Projeção</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                        <table className="w-full border-collapse text-left">
                            <thead className="sticky top-0 z-30 shadow-sm">
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="sticky left-0 z-40 bg-slate-50 px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200 min-w-[120px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Estrutura</th>
                                    <th className="sticky left-[120px] z-40 bg-slate-50 px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200 min-w-[280px] border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Descrição do Item</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] border-b border-slate-200 text-right bg-blue-50/50 whitespace-nowrap">Budget (Total)</th>

                                    {implementationMode && (
                                        <th className="px-6 py-5 text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] border-b border-slate-200 text-right bg-orange-50/50 whitespace-nowrap border-l border-orange-200">
                                            Realizado Retroativo
                                        </th>
                                    )}

                                    {months.map(m => (
                                        <th key={m} className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-200 text-right min-w-[140px] border-l border-slate-100">
                                            {getMonthLabel(m)}
                                        </th>
                                    ))}

                                    <th className="px-6 py-5 text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] border-b border-slate-200 text-right bg-slate-100/50 border-l border-slate-200">Total Projetado</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] border-b border-slate-200 text-right border-l-2 border-slate-300">Diferença / POC</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {renderRows(budgetTree)}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                        <div className="flex items-center gap-6 px-6 py-3 bg-white rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Geral Orçado</span>
                                <span className="text-lg font-black text-blue-600">
                                    {formatCurrency(budgetTree.reduce((sum, n) => {
                                        const b = budgetOverrides[n.code] !== undefined ? budgetOverrides[n.code] : (n.budgetInitial || 0);
                                        return sum + b;
                                    }, 0))}
                                </span>
                            </div>
                            <div className="w-px h-10 bg-slate-200"></div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Geral Projetado</span>
                                <span className="text-lg font-black text-slate-900">{formatCurrency(budgetTree.reduce((sum, n) => sum + getNodeForecast(n).total, 0))}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Legend */}
            <div className="bg-white border-t border-slate-200 px-8 py-4 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <Edit3 size={14} className="text-yellow-500" />
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Clique nos campos brancos para editar projeções mensais</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>
                        <span className="text-xs text-slate-600 font-medium tracking-tight">Dentro do Orçado</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"></div>
                        <span className="text-xs text-slate-600 font-medium tracking-tight">Estouro de Verba</span>
                    </div>
                </div>
                <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em]">
                    Digital Twin BRZ • Engenharia de Dados
                </div>
            </div>
        </div>
    );
};
