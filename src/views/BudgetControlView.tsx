import React, { useState, useMemo, useEffect } from 'react';
import { AppData, BudgetGroup, BudgetNode, FinancialEntry, Installment, FinancialAllocation, BudgetSnapshot, Supplier } from '../../types';
import { Download, Upload, Search, Calendar, ChevronDown, ChevronRight, Plus, DollarSign, FileText, BarChart, Trash, AlertTriangle, Check, Edit2, X, Eye, EyeOff, Filter, Save, History, Layers, CheckCircle, XCircle, MoreHorizontal } from 'lucide-react';

interface Props {
    appData: AppData;
    onUpdate: (data: Partial<AppData>) => void;
}

// --- UTILS & HELPERS ---

function generateInitialTree(groups: BudgetGroup[]): BudgetNode[] {
    // Basic Mock
    return [
        {
            id: '1', code: '01', description: 'CUSTOS DE CONSTRUÇÃO', level: 0, totalValue: 53670434.74, type: 'GROUP', budgetInitial: 53670434.74, budgetCurrent: 53670434.74, realizedRDO: 0, realizedFinancial: 0, committed: 0, costCenter: 'T1_T2', children: [
                {
                    id: '2', code: '01.01', description: 'FUNDAÇÃO E CONTENÇÕES', level: 1, totalValue: 2897999.08, type: 'GROUP', budgetInitial: 2897999.08, budgetCurrent: 2897999.08, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [
                        { id: '3', code: '01.01.01', description: 'SERVIÇOS PRELIMINARES', level: 2, totalValue: 980221.99, type: 'ITEM', itemType: 'ST', budgetInitial: 980221.99, budgetCurrent: 980221.99, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [] },
                        { id: '4', code: '01.01.02', description: 'ESTACAS / TRADO', level: 2, totalValue: 911671.62, type: 'ITEM', itemType: 'ST', budgetInitial: 911671.62, budgetCurrent: 911671.62, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [] },
                    ]
                },
                {
                    id: '5', code: '01.02', description: 'ESTRUTURA DE CONCRETO', level: 1, totalValue: 12500000.00, type: 'GROUP', budgetInitial: 12500000.00, budgetCurrent: 12500000.00, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [
                        { id: '6', code: '01.02.01', description: 'CONCRETO USINADO', level: 2, totalValue: 4500000.00, type: 'ITEM', itemType: 'MT', budgetInitial: 4500000.00, budgetCurrent: 4500000.00, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [] },
                        { id: '7', code: '01.02.02', description: 'AÇO CA-50', level: 2, totalValue: 3200000.00, type: 'ITEM', itemType: 'MT', budgetInitial: 3200000.00, budgetCurrent: 3200000.00, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [] },
                    ]
                }
            ]
        }
    ];
};

const TabButton = ({ active, onClick, icon, label }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center space-x-2 px-6 py-2.5 transition-colors text-sm font-bold uppercase rounded-md my-0.5 mx-0.5 ${active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

// --- SUB-COMPONENTS ---

const BudgetRow = ({ node, level, onUpdateNode, onAddChild, onAddResources, onRemoveResources, onDelete }: {
    node: BudgetNode,
    level: number,
    onUpdateNode: (n: BudgetNode) => void,
    onAddChild: (id: string, type: 'GROUP' | 'ITEM') => void,
    onAddResources: (id: string) => void,
    onRemoveResources: (id: string) => void,
    onDelete: (id: string) => void
}) => {
    const isGroup = node.type === 'GROUP' || (node.children && node.children.length > 0);
    const hasChildren = node.children && node.children.length > 0;

    // Indentation and Styling
    const paddingLeft = `${level * 24 + 12}px`;

    // Specific styling for resource types (MT, ST, EQ)
    let rowBg = 'bg-white';
    if (level === 0) rowBg = 'bg-slate-100'; // Root
    if (!isGroup && node.itemType === 'MT') rowBg = 'bg-yellow-50';
    if (!isGroup && node.itemType === 'ST') rowBg = 'bg-blue-50';
    if (!isGroup && node.itemType === 'EQ') rowBg = 'bg-orange-50';

    const handleValueChange = (val: number) => {
        onUpdateNode({ ...node, totalValue: val, budgetInitial: val, budgetCurrent: val });
    };

    const handleNameChange = (val: string) => {
        onUpdateNode({ ...node, description: val.toUpperCase() });
    };

    return (
        <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${rowBg}`}>
            <td className="p-2 font-mono text-slate-600 text-xs font-bold truncate" style={{ paddingLeft }}>
                {node.code}
            </td>
            <td className="p-2">
                <input
                    className={`bg-transparent w-full outline-none uppercase text-xs ${level === 0 ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}
                    value={node.description}
                    onChange={(e) => handleNameChange(e.target.value)}
                />
            </td>
            <td className="p-2 text-center text-[10px]">
                {isGroup ? <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold">{node.children && node.children.length > 0 ? 'CMP' : 'GRP'}</span> :
                    <select
                        value={node.itemType || 'MT'}
                        onChange={(e) => onUpdateNode({ ...node, itemType: e.target.value as any })}
                        className="bg-transparent font-bold border-b border-dotted border-slate-400 outline-none text-center"
                    >
                        <option value="MT">MAT</option>
                        <option value="ST">SRV</option>
                        <option value="EQ">EQP</option>
                    </select>
                }
            </td>
            <td className={`p-2 text-right font-mono font-medium border-l border-r border-orange-100 ${hasChildren ? 'bg-orange-50 text-orange-900 opacity-80' : 'text-orange-700 bg-white'}`}>
                {hasChildren ?
                    <span>{node.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    :
                    <input
                        type="number"
                        className="w-full text-right bg-transparent outline-none border-b border-transparent focus:border-orange-400 transition-colors"
                        value={node.totalValue}
                        onChange={(e) => handleValueChange(Number(e.target.value))}
                    />
                }
            </td>
            <td className="p-2 text-right flex justify-end gap-1 items-center">
                {!node.code || node.code.length > 0 ? (
                    <>
                        <button onClick={() => onAddChild(node.id, 'GROUP')} title="Adicionar Sub-Grupo" className="p-1 text-slate-400 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded">
                            <Plus size={14} />
                        </button>
                        <button onClick={() => onAddChild(node.id, 'ITEM')} title="Adicionar Item" className="p-1 text-slate-400 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded">
                            <FileText size={14} />
                        </button>
                        {hasChildren ?
                            <button onClick={() => onRemoveResources(node.id)} title="Remover Agrupamento (Limpar Filhos)" className="p-1 text-slate-400 hover:text-red-600 bg-slate-100 hover:bg-red-50 rounded font-bold text-[10px] w-6 border border-slate-200 flex items-center justify-center">
                                <X size={14} />
                            </button>
                            :
                            <button onClick={() => onAddResources(node.id)} title="Adicionar Composição Padrão (MT/ST/EQ)" className="p-1 text-slate-400 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 rounded font-bold text-[10px] w-6 border border-slate-200">
                                $$
                            </button>
                        }
                    </>
                ) : null}
                <button onClick={() => onDelete(node.id)} className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded ml-2"><Trash size={14} /></button>
            </td>
        </tr>
    );
};

const renderTreeRows = (
    nodes: BudgetNode[],
    onUpdateNode: (n: BudgetNode) => void,
    onAddChild: (id: string, type: 'GROUP' | 'ITEM') => void,
    onAddResources: (id: string) => void,
    onRemoveResources: (id: string) => void,
    onDelete: (id: string) => void,
    level = 0,
    showResources = true
): React.ReactNode[] => {
    return nodes.flatMap((node) => {
        const isResourceNode = (!node.code || node.code.trim() === '') && ['MT', 'ST', 'EQ'].includes(node.itemType || '');
        if (!showResources && isResourceNode) {
            return [];
        }

        return [
            <BudgetRow
                key={node.id}
                node={node}
                level={level}
                onUpdateNode={onUpdateNode}
                onAddChild={onAddChild}
                onAddResources={onAddResources}
                onRemoveResources={onRemoveResources}
                onDelete={onDelete}
            />,
            ...(node.children ? renderTreeRows(node.children, onUpdateNode, onAddChild, onAddResources, onRemoveResources, onDelete, level + 1, showResources) : [])
        ];
    });
};

const BudgetStructureTab = ({ tree, onUpdate, versions, onSaveVersion }: { tree: BudgetNode[], onUpdate: (t: BudgetNode[]) => void, versions?: BudgetSnapshot[], onSaveVersion: (desc: string) => void }) => {
    const [showResources, setShowResources] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState<'ALL' | 'T1_T2' | 'T3_T4' | 'INFRA' | 'CI'>('ALL');

    const recalculateTotals = (nodes: BudgetNode[]): { nodes: BudgetNode[], total: number } => {
        let sum = 0;
        const newNodes = nodes.map(node => {
            if (node.children && node.children.length > 0) {
                const { nodes: newChildren, total: childTotal } = recalculateTotals(node.children);
                const newNode = {
                    ...node,
                    children: newChildren,
                    totalValue: childTotal,
                    budgetInitial: childTotal,
                    budgetCurrent: childTotal
                };
                sum += newNode.totalValue;
                return newNode;
            } else {
                sum += node.totalValue;
                return node;
            }
        });
        return { nodes: newNodes, total: sum };
    };

    const handleUpdateNode = (updatedNode: BudgetNode) => {
        const updateRecursive = (nodes: BudgetNode[]): BudgetNode[] => {
            return nodes.map(n => {
                if (n.id === updatedNode.id) {
                    return updatedNode;
                }
                if (n.children) {
                    return { ...n, children: updateRecursive(n.children) };
                }
                return n;
            });
        };
        const newTree = updateRecursive(tree);
        const { nodes: recalculatedTree } = recalculateTotals(newTree);
        onUpdate(recalculatedTree);
    };

    const handleAddRoot = () => {
        if (activeSubTab === 'ALL') {
            alert("Selecione um Centro de Custo específico (Abas acima) para adicionar um novo Grupo Raiz.");
            return;
        }

        const code = prompt("Digite o Código do Grupo (Ex: 01):");
        if (!code) return;
        const name = prompt("Digite o Nome do Grupo:");
        if (!name) return;

        const newNode: BudgetNode = {
            id: Date.now().toString(),
            code,
            description: name.toUpperCase(),
            level: 0,
            totalValue: 0,
            type: 'GROUP',
            children: [],
            budgetInitial: 0,
            budgetCurrent: 0,
            realizedRDO: 0,
            realizedFinancial: 0,
            committed: 0,
            costCenter: activeSubTab
        };
        onUpdate([...tree, newNode]);
    };

    const handleAddChild = (parentId: string, type: 'GROUP' | 'ITEM' = 'GROUP') => {
        const findAndAdd = (nodes: BudgetNode[]): BudgetNode[] => {
            return nodes.map(node => {
                if (node.id === parentId) {
                    let newCode = node.code + ".01";
                    if (node.children && node.children.length > 0) {
                        try {
                            const lastChildCode = node.children[node.children.length - 1].code;
                            const parts = lastChildCode.split('.');
                            const lastSection = parts[parts.length - 1];
                            const lastNum = parseInt(lastSection);
                            if (!isNaN(lastNum)) {
                                parts[parts.length - 1] = (lastNum + 1).toString().padStart(2, '0');
                                newCode = parts.join('.');
                            }
                        } catch (e) {
                            newCode = node.code + "." + (node.children.length + 1).toString().padStart(2, '0');
                        }
                    }

                    const name = prompt(`Adicionar ${type === 'GROUP' ? 'Sub-Grupo' : 'Item'} em ${node.description}.\nSugestão de Código: ${newCode}\n\nNome:`);
                    if (!name) return node;

                    let val = 0;
                    if (type === 'ITEM') {
                        val = Number(prompt("Valor do Orçamento (Meta):", "0"));
                    }

                    const newNode: BudgetNode = {
                        id: Date.now().toString(),
                        code: newCode,
                        description: name.toUpperCase(),
                        level: node.level + 1,
                        totalValue: val,
                        type: type,
                        itemType: type === 'ITEM' ? 'MT' : undefined,
                        children: [],
                        budgetInitial: val,
                        budgetCurrent: val,
                        realizedRDO: 0,
                        realizedFinancial: 0,
                        committed: 0,
                        parentId: node.id
                    };
                    return { ...node, children: [...(node.children || []), newNode] };
                }
                if (node.children) {
                    return { ...node, children: findAndAdd(node.children) };
                }
                return node;
            });
        };

        const newTree = findAndAdd(tree);
        const { nodes: recalculatedTree } = recalculateTotals(newTree);
        onUpdate(recalculatedTree);
    };

    const handleAddResources = (nodeId: string) => {
        const findAndAddRes = (nodes: BudgetNode[]): BudgetNode[] => {
            return nodes.map(node => {
                if (node.id === nodeId) {
                    if (node.children && node.children.length > 0) {
                        alert("Este item já possui filhos. Não é possível adicionar a composição padrão.");
                        return node;
                    }
                    const resources: BudgetNode[] = [
                        { id: Date.now() + '1', code: '', description: 'MATERIAL', level: node.level + 1, type: 'ITEM', itemType: 'MT', totalValue: 0, budgetInitial: 0, budgetCurrent: 0, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [], parentId: node.id },
                        { id: Date.now() + '2', code: '', description: 'SERVIÇO DE TERCEIROS', level: node.level + 1, type: 'ITEM', itemType: 'ST', totalValue: 0, budgetInitial: 0, budgetCurrent: 0, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [], parentId: node.id },
                        { id: Date.now() + '3', code: '', description: 'EQUIPAMENTOS', level: node.level + 1, type: 'ITEM', itemType: 'EQ', totalValue: 0, budgetInitial: 0, budgetCurrent: 0, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [], parentId: node.id },
                    ];
                    setShowResources(true);
                    return { ...node, children: resources };
                }
                if (node.children) {
                    return { ...node, children: findAndAddRes(node.children) };
                }
                return node;
            });
        };
        const newTree = findAndAddRes(tree);
        onUpdate(newTree);
    };

    const handleRemoveResources = (nodeId: string) => {
        const findAndRemoveRes = (nodes: BudgetNode[]): BudgetNode[] => {
            return nodes.map(node => {
                if (node.id === nodeId) {
                    return { ...node, children: [], totalValue: 0, budgetInitial: 0, budgetCurrent: 0 };
                }
                if (node.children) {
                    return { ...node, children: findAndRemoveRes(node.children) };
                }
                return node;
            });
        };
        const newTree = findAndRemoveRes(tree);
        const { nodes: recalculatedTree } = recalculateTotals(newTree);
        onUpdate(recalculatedTree);
    }

    const handleDelete = (id: string) => {
        if (!confirm("Tem certeza? Isso apagará o item e seus filhos.")) return;
        const deleteRecursive = (nodes: BudgetNode[]): BudgetNode[] => {
            return nodes.filter(n => n.id !== id).map(n => ({
                ...n,
                children: deleteRecursive(n.children)
            }));
        };
        const newTree = deleteRecursive(tree);
        const { nodes: recalculatedTree } = recalculateTotals(newTree);
        onUpdate(recalculatedTree);
    };

    // Filter Logic
    const filteredTree = useMemo(() => {
        if (activeSubTab === 'ALL') return tree;
        // Filter roots. Note that children are rendered inside the root, so if we show a root, we show its children.
        // We filter top-level nodes by costCenter.
        return tree.filter(n => n.costCenter === activeSubTab);
    }, [tree, activeSubTab]);

    return (
        <div className="flex flex-col h-full">
            {/* --- HEADER CONTROLS --- */}
            <div className="bg-white border-b border-slate-200">
                <div className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={handleAddRoot} className="flex items-center gap-2 bg-indigo-600 text-white border border-indigo-700 px-3 py-1.5 rounded text-sm font-bold hover:bg-indigo-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled={activeSubTab === 'ALL'} title={activeSubTab === 'ALL' ? "Selecione uma aba de Centro de Custo para adicionar" : "Adicionar Grupo neste Centro de Custo"}>
                            <Plus size={14} /> Adicionar Grupo Raiz
                        </button>

                        <div className="h-6 w-px bg-slate-300 mx-2"></div>

                        <button
                            onClick={() => setShowResources(!showResources)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-bold shadow-sm border transition-colors ${showResources ? 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50' : 'bg-slate-800 text-white border-slate-900 hover:bg-slate-900'}`}
                            title={showResources ? "Ocultar detalhamento de recursos (MT, ST, EQ)" : "Mostrar detalhamento de recursos (MT, ST, EQ)"}
                        >
                            {showResources ? <EyeOff size={14} /> : <Eye size={14} />}
                            {showResources ? 'Ocultar Recursos' : 'Mostrar Recursos'}
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                import('../services/excelService').then(({ ExcelService }) => {
                                    ExcelService.exportBudget(tree);
                                });
                            }}
                            className="flex items-center gap-2 bg-slate-100 text-slate-600 border border-slate-300 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-200 transition-colors uppercase mr-2"
                        >
                            <Download size={14} /> Exportar Excel
                        </button>

                        {/* VERSIONING BUTTON */}
                        <div className="flex items-center gap-2 mr-4">
                            <div className="text-xs text-right mr-2">
                                <div className="font-bold text-slate-700">VERSÃO ATUAL: {versions && versions.length > 0 ? versions.length + 1 : 1}</div>
                                <div className="text-orange-500 font-bold text-[10px]">EM EDIÇÃO</div>
                            </div>
                            <button
                                onClick={() => {
                                    const desc = prompt("Descreva essa version (ex: Validação Inicial):");
                                    if (desc) onSaveVersion(desc);
                                }}
                                className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 font-bold text-xs uppercase shadow-sm"
                            >
                                <Save size={14} /> Concluir Orçamento
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- SUB TABS NAVIGATION --- */}
                <div className="flex px-4 gap-1 transform translate-y-px">
                    <button onClick={() => setActiveSubTab('ALL')} className={`px-4 py-2 text-sm font-bold border-t border-l border-r rounded-t-lg ${activeSubTab === 'ALL' ? 'bg-slate-50 border-slate-200 text-indigo-600 border-b-transparent' : 'bg-slate-100 text-slate-500 border-transparent border-b-slate-200 hover:bg-slate-200'}`}>
                        <Layers size={14} className="inline mr-1 mb-0.5" /> CONSOLIDADO
                    </button>
                    <div className="w-px h-6 bg-slate-300 my-auto mx-2 self-center"></div>
                    <button onClick={() => setActiveSubTab('T1_T2')} className={`px-4 py-2 text-sm font-bold border-t border-l border-r rounded-t-lg ${activeSubTab === 'T1_T2' ? 'bg-green-50 border-green-200 text-green-700 border-b-transparent' : 'bg-slate-100 text-slate-500 border-transparent border-b-slate-200 hover:bg-green-50 hover:text-green-600'}`}>
                        TORRES 01 & 02
                    </button>
                    <button onClick={() => setActiveSubTab('T3_T4')} className={`px-4 py-2 text-sm font-bold border-t border-l border-r rounded-t-lg ${activeSubTab === 'T3_T4' ? 'bg-blue-50 border-blue-200 text-blue-700 border-b-transparent' : 'bg-slate-100 text-slate-500 border-transparent border-b-slate-200 hover:bg-blue-50 hover:text-blue-600'}`}>
                        TORRES 03 & 04
                    </button>
                    <button onClick={() => setActiveSubTab('INFRA')} className={`px-4 py-2 text-sm font-bold border-t border-l border-r rounded-t-lg ${activeSubTab === 'INFRA' ? 'bg-orange-50 border-orange-200 text-orange-700 border-b-transparent' : 'bg-slate-100 text-slate-500 border-transparent border-b-slate-200 hover:bg-orange-50 hover:text-orange-600'}`}>
                        INFRAESTRUTURA
                    </button>
                    <button onClick={() => setActiveSubTab('CI')} className={`px-4 py-2 text-sm font-bold border-t border-l border-r rounded-t-lg ${activeSubTab === 'CI' ? 'bg-slate-50 border-slate-300 text-slate-800 border-b-transparent' : 'bg-slate-100 text-slate-500 border-transparent border-b-slate-200 hover:bg-slate-200'}`}>
                        CUSTO INDIRETO (CI)
                    </button>
                </div>
            </div>

            <div className={`flex-1 overflow-auto p-0 ${activeSubTab === 'T1_T2' ? 'bg-green-50/30' : activeSubTab === 'T3_T4' ? 'bg-blue-50/30' : activeSubTab === 'INFRA' ? 'bg-orange-50/30' : activeSubTab === 'CI' ? 'bg-slate-100' : 'bg-slate-50'}`}>
                <table className="w-full text-sm border-collapse">
                    <thead className="bg-slate-200 text-slate-700 font-bold sticky top-0 z-10 shadow-sm uppercase text-xs">
                        <tr>
                            <th className="p-3 text-left w-48 border-b border-slate-300">Código</th>
                            <th className="p-3 text-left border-b border-slate-300">Descrição</th>
                            <th className="p-3 text-center w-24 border-b border-slate-300">Tipo</th>
                            <th className="p-3 text-right w-40 border-b border-slate-300 bg-orange-100 text-orange-900 border-l border-r border-orange-200">Orçamento (Meta)</th>
                            <th className="p-3 text-right w-48 border-b border-slate-300">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {filteredTree.length > 0 ?
                            renderTreeRows(filteredTree, handleUpdateNode, handleAddChild, handleAddResources, handleRemoveResources, handleDelete, 0, showResources)
                            :
                            <tr>
                                <td colSpan={5} className="p-10 text-center text-slate-400 italic">
                                    {activeSubTab === 'ALL' ? "Nenhum item cadastrado no orçamento global." : "Nenhum item cadastrado para este Centro de Custo. Adicione um Grupo Raiz acima."}
                                </td>
                            </tr>
                        }
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const FinancialEntryTab = ({ entries, budgetTree, onUpdate, savedSuppliers, onSaveSuppliers }: { entries: FinancialEntry[], budgetTree: BudgetNode[], onUpdate: (e: FinancialEntry[]) => void, savedSuppliers?: Supplier[], onSaveSuppliers?: (s: Supplier[]) => void }) => {
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');

    // Form State for Header
    const [supplier, setSupplier] = useState('');
    const [docNum, setDocNum] = useState('');
    const [totalValue, setTotalValue] = useState(0);
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [installmentsCount, setInstallmentsCount] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');

    // Filtering State
    const [filterStart, setFilterStart] = useState('');
    const [filterEnd, setFilterEnd] = useState('');

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Detail View State
    const [viewingEntry, setViewingEntry] = useState<FinancialEntry | null>(null);

    // Error states for validation
    const [errors, setErrors] = useState<{ [key: string]: boolean }>({});

    // Filtered entries for consultation
    const filteredEntries = useMemo(() => {
        return entries.filter(e => {
            const matchesSearch = e.supplier.toUpperCase().includes(searchTerm.toUpperCase()) ||
                e.documentNumber.includes(searchTerm);

            let matchesDate = true;
            if (filterStart || filterEnd) {
                const eDate = new Date(e.issueDate);
                if (filterStart && eDate < new Date(filterStart)) matchesDate = false;
                if (filterEnd && eDate > new Date(filterEnd)) matchesDate = false;
            }

            return matchesSearch && matchesDate;
        });
    }, [entries, searchTerm, filterStart, filterEnd]);

    // Selection Helpers
    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredEntries.length && filteredEntries.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredEntries.map(e => e.id)));
        }
    };

    const selectedTotal = useMemo(() => {
        return entries.filter(e => selectedIds.has(e.id)).reduce((acc, e) => acc + e.totalValue, 0);
    }, [entries, selectedIds]);

    // Supplier Management
    const [suppliers, setSuppliers] = useState<Supplier[]>(savedSuppliers || []);
    const [showSupplierImport, setShowSupplierImport] = useState(false);
    const [importText, setImportText] = useState('');

    const handleImportSuppliers = () => {
        const lines = importText.split('\n');
        const newSuppliers: Supplier[] = [];
        lines.forEach(line => {
            const parts = line.split('\t'); // Assume copy-paste from Excel
            if (parts.length >= 2) {
                const razao = parts[0].trim().toUpperCase();
                const cnpj = parts[1].trim();
                if (razao && cnpj) {
                    newSuppliers.push({ id: Date.now() + Math.random().toString(), razaoSocial: razao, cnpj });
                }
            }
        });
        const combined = [...suppliers, ...newSuppliers];
        setSuppliers(combined);
        if (onSaveSuppliers) onSaveSuppliers(combined);
        setShowSupplierImport(false);
        setImportText('');
        alert(`${newSuppliers.length} fornecedores importados com sucesso!`);
    };

    // Filtered suppliers for autocomplete
    const filteredSuppliers = useMemo(() => {
        if (!supplier) return [];
        return suppliers.filter(s => s.razaoSocial.includes(supplier.toUpperCase()));
    }, [supplier, suppliers]);

    // Form State for Allocations (Multi)
    const [allocations, setAllocations] = useState<FinancialAllocation[]>([]);

    // Temporary State for Adding Allocation
    const [tempAllocGroup, setTempAllocGroup] = useState('');
    const [tempAllocValue, setTempAllocValue] = useState(0);
    const [tempAllocType, setTempAllocType] = useState<'MT' | 'ST' | 'EQ'>('MT');

    const [installments, setInstallments] = useState<Installment[]>([]);

    // Determine Groups Options (Flattened)
    const flatGroups = useMemo(() => {
        const list: { code: string, desc: string }[] = [];
        const traverse = (nodes: BudgetNode[]) => {
            nodes.forEach(n => {
                list.push({ code: n.code, desc: n.description });
                if (n.children) traverse(n.children);
            });
        };
        traverse(budgetTree);
        return list;
    }, [budgetTree]);

    const allocatedSum = allocations.reduce((acc, a) => acc + a.value, 0);
    const remainingToAllocate = totalValue - allocatedSum;

    const handleAddAllocation = () => {
        if (!tempAllocGroup || tempAllocValue <= 0) return;
        if (tempAllocValue > remainingToAllocate + 0.01) { // tolerance
            alert("Valor da alocação excede o saldo restante da nota!");
            return;
        }

        const newAlloc: FinancialAllocation = {
            id: Date.now().toString(),
            budgetGroupCode: tempAllocGroup,
            costType: tempAllocType,
            value: tempAllocValue,
            description: flatGroups.find(g => g.code === tempAllocGroup)?.desc || ''
        };

        setAllocations([...allocations, newAlloc]);
        // Reset temp
        setTempAllocGroup('');
        setTempAllocValue(0);
    };

    const removeAllocation = (id: string) => {
        setAllocations(allocations.filter(a => a.id !== id));
    };

    const generateInstallmentsPreview = () => {
        if (totalValue <= 0) return;

        // Lock: Must allocate everything first
        if (Math.abs(remainingToAllocate) > 0.01) {
            alert(`Atenção: Você ainda possui ${remainingToAllocate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} não alocados. Distribua todo o valor da nota nos Grupos Orçamentários antes de prosseguir.`);
            return;
        }

        const valPerInst = totalValue / installmentsCount;
        const newInsts: Installment[] = [];
        for (let i = 0; i < installmentsCount; i++) {
            const date = new Date(issueDate);
            date.setMonth(date.getMonth() + i + 1);
            newInsts.push({
                id: Date.now() + i + '',
                number: i + 1,
                dueDate: date.toISOString().split('T')[0],
                value: valPerInst,
                status: 'PENDING'
            });
        }
        setInstallments(newInsts);
    };

    const handleSaveEntry = () => {
        const newErrors: { [key: string]: boolean } = {};
        if (!supplier) newErrors.supplier = true;
        if (!docNum) newErrors.docNum = true;
        if (totalValue <= 0) newErrors.totalValue = true;
        if (allocations.length === 0) newErrors.allocations = true;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            alert("Atenção: Todos os campos destacados são obrigatórios para o lançamento.");
            return;
        }

        // Validation: Total Allocation
        if (Math.abs(remainingToAllocate) > 0.01) {
            alert(`Erro de Apropriação: Ainda restam ${remainingToAllocate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} sem destino. Você deve alocar 100% do valor da nota.`);
            return;
        }

        // Validation: Installments check
        const installmentsSum = installments.reduce((acc, inst) => acc + inst.value, 0);
        if (installments.length > 0 && Math.abs(installmentsSum - totalValue) > 0.01) {
            alert("O valor das parcelas não bate com o valor total da nota. Por favor, gere as parcelas novamente.");
            return;
        }

        if (installments.length === 0) {
            // Re-check here too before auto-gen
            if (totalValue <= 0) {
                alert("Informe o valor total da nota.");
                return;
            }
            generateInstallmentsPreview();
        }

        const newEntry: FinancialEntry = {
            id: Date.now().toString(),
            supplier: supplier.toUpperCase(),
            documentNumber: docNum,
            description: `NF ${docNum} - ${supplier.toUpperCase()}`,
            issueDate,
            totalValue: totalValue,
            allocations,
            status: 'APPROVED',
            installments: installments.length > 0 ? installments : [] // logic fix
        };

        // If installments empty because state lag or something, re-gen:
        if (newEntry.installments.length === 0) {
            const valPerInst = totalValue / installmentsCount;
            for (let i = 0; i < installmentsCount; i++) {
                const date = new Date(issueDate);
                date.setMonth(date.getMonth() + i + 1);
                newEntry.installments.push({
                    id: Date.now() + i + 'fix',
                    number: i + 1,
                    dueDate: date.toISOString().split('T')[0],
                    value: valPerInst,
                    status: 'PENDING'
                });
            }
        }

        onUpdate([...entries, newEntry]);
        setViewMode('list');
        // Reset form
        setSupplier(''); setDocNum(''); setTotalValue(0); setAllocations([]); setInstallments([]);
        setErrors({});
    };

    const handleExport = () => {
        const listToExport = selectedIds.size > 0
            ? entries.filter(e => selectedIds.has(e.id))
            : filteredEntries;

        import('../services/excelService').then(({ ExcelService }) => {
            ExcelService.exportFinancialEntries(listToExport);
        });
    };

    if (viewMode === 'form') {
        return (
            <div className="flex-1 overflow-y-auto bg-slate-50">
                <div className="p-6 max-w-5xl mx-auto w-full">
                    <div className="flex items-center gap-4 mb-6">
                        <button onClick={() => setViewMode('list')} className="text-slate-500 hover:text-slate-800 font-bold uppercase text-xs flex items-center gap-1">
                            <ChevronRight className="rotate-180" size={14} /> Voltar
                        </button>
                        <h2 className="text-xl font-bold uppercase text-slate-800">Lançamento de Nota Fiscal (Multi-G.O.)</h2>
                    </div>

                    {/* Header Data */}
                    <div className="grid grid-cols-4 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6 relative">
                        {showSupplierImport && (
                            <div className="absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center p-10 rounded-xl border-2 border-dashed border-indigo-300">
                                <h3 className="font-bold text-lg mb-2 text-indigo-800">Importar Fornecedores (Cola do Excel/TOTVS)</h3>
                                <p className="text-sm text-slate-500 mb-4">Copie as colunas [RAZÃO SOCIAL] e [CNPJ] do Excel e cole abaixo:</p>
                                <textarea
                                    className="w-full h-32 border rounded p-2 text-xs font-mono mb-4 bg-slate-50"
                                    placeholder={`Exemplo:\nCONSTRUTORA XYZ\t00.000.000/0001-00\nFORNECEDOR ABC\t11.111.111/0001-11`}
                                    value={importText}
                                    onChange={e => setImportText(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <button onClick={() => setShowSupplierImport(false)} className="px-4 py-2 text-slate-500 font-bold uppercase text-xs">Cancelar</button>
                                    <button onClick={handleImportSuppliers} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold uppercase text-xs hover:bg-indigo-700">Processar Importação</button>
                                </div>
                            </div>
                        )}

                        <div className="col-span-2 relative">
                            <div className="flex justify-between items-center mb-1">
                                <label className={`block text-xs font-bold uppercase ${errors.supplier ? 'text-red-500' : 'text-slate-500'}`}>Fornecedor {errors.supplier && '*'}</label>
                                <button onClick={() => setShowSupplierImport(true)} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 uppercase">
                                    <Upload size={10} /> Importar Lista
                                </button>
                            </div>
                            <input
                                className={`w-full border rounded p-2 uppercase focus:ring-2 focus:ring-indigo-100 outline-none ${errors.supplier ? 'border-red-500 bg-red-50' : ''}`}
                                value={supplier}
                                onChange={e => {
                                    setSupplier(e.target.value.toUpperCase());
                                    if (errors.supplier) setErrors(prev => ({ ...prev, supplier: false }));
                                }}
                                placeholder="DIGITE PARA BUSCAR..."
                                list="suppliers-list"
                            />
                            <datalist id="suppliers-list">
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.razaoSocial}>{s.cnpj}</option>
                                ))}
                            </datalist>
                            {supplier && !suppliers.find(s => s.razaoSocial === supplier) && (
                                <div className="text-[10px] text-orange-500 mt-1 font-bold flex items-center gap-1">
                                    <AlertTriangle size={10} /> Novo fornecedor será cadastrado ao salvar.
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Data Emissão</label>
                            <input className="w-full border rounded p-2" type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                        </div>
                        <div>
                            <label className={`block text-xs font-bold uppercase mb-1 ${errors.docNum ? 'text-red-500' : 'text-slate-500'}`}>Nº Nota Fiscal {errors.docNum && '*'}</label>
                            <input
                                className={`w-full border rounded p-2 ${errors.docNum ? 'border-red-500 bg-red-50' : ''}`}
                                value={docNum}
                                onChange={e => {
                                    setDocNum(e.target.value);
                                    if (errors.docNum) setErrors(prev => ({ ...prev, docNum: false }));
                                }}
                                placeholder="000.000"
                            />
                        </div>
                        <div className={`bg-white p-4 items-center flex rounded border col-span-4 justify-between shadow-sm ${errors.totalValue ? 'border-red-500 bg-red-50' : 'border-blue-200'}`}>
                            <div className={`font-bold uppercase text-sm ${errors.totalValue ? 'text-red-700' : 'text-blue-900'}`}>Valor Total da Nota {errors.totalValue && '*'}</div>
                            <div className="flex items-center">
                                <span className="mr-2 text-slate-400 font-bold">R$</span>
                                <input
                                    className={`text-2xl font-mono font-bold outline-none w-48 text-right border-b border-dashed focus:border-blue-600 ${errors.totalValue ? 'text-red-700 border-red-300' : 'text-blue-700 border-blue-300'}`}
                                    type="number"
                                    value={totalValue}
                                    onChange={e => {
                                        setTotalValue(Number(e.target.value));
                                        if (errors.totalValue) setErrors(prev => ({ ...prev, totalValue: false }));
                                    }}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Multi-Allocation Section */}
                    <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 mb-6 relative overflow-hidden">
                        {/* Background Progress Bar */}
                        <div className="absolute top-0 left-0 h-1 bg-slate-200 w-full">
                            <div
                                className={`h-full transition-all duration-500 ${Math.abs(remainingToAllocate) < 0.01 ? 'bg-green-500' : 'bg-orange-400'}`}
                                style={{ width: `${Math.min(100, (allocatedSum / (totalValue || 1)) * 100)}%` }}
                            ></div>
                        </div>

                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <h3 className={`font-bold uppercase text-sm ${errors.allocations ? 'text-red-600 animate-bounce' : 'text-orange-900'}`}>Apropriação de Custos (Rateio) {errors.allocations && '*'}</h3>
                                {Math.abs(remainingToAllocate) < 0.01 && <CheckCircle size={16} className="text-green-600" />}
                            </div>
                            <div className="text-xs font-bold flex gap-4">
                                <div className="bg-white px-3 py-1 rounded shadow-sm border border-orange-100 italic">
                                    Alocado: <span className="text-slate-800 font-mono text-sm">{allocatedSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                                <div className={`px-3 py-1 rounded shadow-sm border flex items-center gap-2 ${Math.abs(remainingToAllocate) < 0.01 ? 'bg-green-100 border-green-200 text-green-700' : 'bg-red-100 border-red-200 text-red-600 animate-pulse'}`}>
                                    {Math.abs(remainingToAllocate) > 0.01 && <AlertTriangle size={14} />}
                                    Restante: <span className="font-mono text-sm">{remainingToAllocate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Add Line */}
                        <div className="flex gap-2 mb-4 items-end">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Grupo Orçamentário</label>
                                <select className="w-full border rounded p-2 text-sm" value={tempAllocGroup} onChange={e => setTempAllocGroup(e.target.value)}>
                                    <option value="">Selecione...</option>
                                    {flatGroups.map(g => <option key={g.code} value={g.code}>{g.code} - {g.desc}</option>)}
                                </select>
                            </div>
                            <div className="w-32">
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tipo</label>
                                <select className="w-full border rounded p-2 text-sm" value={tempAllocType} onChange={e => setTempAllocType(e.target.value as any)}>
                                    <option value="MT">Material</option>
                                    <option value="ST">Serviço</option>
                                    <option value="EQ">Equipamento</option>
                                </select>
                            </div>
                            <div className="w-40">
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Valor</label>
                                <div className="relative">
                                    <input className="w-full border rounded p-2 text-sm pr-10" type="number" value={tempAllocValue} onChange={e => setTempAllocValue(Number(e.target.value))} />
                                    {remainingToAllocate > 0.01 && (
                                        <button
                                            onClick={() => setTempAllocValue(Number(remainingToAllocate.toFixed(2)))}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-600 px-1 py-1 rounded font-bold uppercase transition-colors"
                                            title="Alocar saldo restante"
                                        >
                                            MAX
                                        </button>
                                    )}
                                </div>
                            </div>
                            <button onClick={handleAddAllocation} className="bg-orange-600 text-white p-2 rounded hover:bg-orange-700 disabled:opacity-30" disabled={tempAllocValue <= 0 || !tempAllocGroup}>
                                <Plus size={18} />
                            </button>
                        </div>

                        {/* List */}
                        {allocations.length > 0 && (
                            <div className="bg-white rounded border border-orange-200 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-orange-100 text-orange-900">
                                        <tr>
                                            <th className="p-2 text-left text-xs uppercase">Grupo</th>
                                            <th className="p-2 text-left text-xs uppercase">Descrição do Grupo</th>
                                            <th className="p-2 text-center text-xs uppercase w-20">Tipo</th>
                                            <th className="p-2 text-right text-xs uppercase">Valor</th>
                                            <th className="p-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allocations.map(alloc => (
                                            <tr key={alloc.id} className="border-b last:border-0">
                                                <td className="p-2 font-mono text-xs">{alloc.budgetGroupCode}</td>
                                                <td className="p-2 text-xs font-bold text-slate-700">{alloc.description}</td>
                                                <td className="p-2 text-center text-[10px] font-bold">{alloc.costType}</td>
                                                <td className="p-2 text-right font-mono">{alloc.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                <td className="p-2 text-center"><button onClick={() => removeAllocation(alloc.id)} className="text-red-400 hover:text-red-600"><X size={14} /></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Installments */}
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 mb-6">
                        <div className="flex justify-between items-end mb-4">
                            <h3 className="font-bold text-blue-900 uppercase text-sm">Parcelamento & Desembolso</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-blue-800 uppercase">Qtd Parcelas:</span>
                                <input className="w-16 border border-blue-200 rounded p-1 text-center" type="number" min="1" max="60" value={installmentsCount} onChange={e => setInstallmentsCount(Number(e.target.value))} />
                                <button
                                    onClick={generateInstallmentsPreview}
                                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold uppercase hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 flex items-center gap-1"
                                    disabled={Math.abs(remainingToAllocate) > 0.01}
                                >
                                    {Math.abs(remainingToAllocate) > 0.01 ? <XCircle size={14} /> : null}
                                    Gerar Datas
                                </button>
                            </div>
                        </div>
                        {installments.length > 0 && (
                            <div className="bg-white rounded border border-blue-100 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-blue-100 text-blue-800">
                                        <tr>
                                            <th className="p-2 text-center w-16">#</th>
                                            <th className="p-2 text-left">Vencimento</th>
                                            <th className="p-2 text-right">Valor Parcela</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {installments.map((inst, idx) => (
                                            <tr key={inst.id} className="border-b last:border-0">
                                                <td className="p-2 text-center font-bold text-slate-500">{inst.number}</td>
                                                <td className="p-2">
                                                    <input type="date" className="border rounded px-2 py-1 w-full text-xs" value={inst.dueDate} onChange={e => {
                                                        const newInsts = [...installments];
                                                        newInsts[idx].dueDate = e.target.value;
                                                        setInstallments(newInsts);
                                                    }} />
                                                </td>
                                                <td className="p-2 text-right font-mono font-medium">
                                                    {inst.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pb-10">
                        <button onClick={() => setViewMode('list')} className="px-6 py-3 text-slate-600 font-bold uppercase hover:bg-slate-100 rounded">Cancelar</button>
                        <button onClick={handleSaveEntry} className="px-6 py-3 bg-green-600 text-white font-bold uppercase hover:bg-green-700 rounded shadow-sm disabled:opacity-50" disabled={Math.abs(remainingToAllocate) > 0.1}>Confirmar Lançamento</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            {/* DETAIL MODAL */}
            {viewingEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 uppercase flex items-center gap-2">
                                    <FileText size={20} className="text-indigo-600" /> Detalhes do Lançamento
                                </h2>
                                <p className="text-slate-500 text-sm mt-1">{viewingEntry.description}</p>
                            </div>
                            <button onClick={() => setViewingEntry(null)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm hover:bg-slate-100 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8">
                            {/* Header Cards */}
                            <div className="grid grid-cols-4 gap-4 mb-8">
                                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                    <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Fornecedor</div>
                                    <div className="font-bold text-slate-900 truncate" title={viewingEntry.supplier}>{viewingEntry.supplier}</div>
                                </div>
                                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                    <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Documento</div>
                                    <div className="font-bold text-slate-900">{viewingEntry.documentNumber}</div>
                                    <div className="text-xs text-slate-400">{new Date(viewingEntry.issueDate).toLocaleDateString()}</div>
                                </div>
                                <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-100 col-span-2">
                                    <div className="text-[10px] font-bold uppercase text-indigo-500 mb-1">Valor Total</div>
                                    <div className="font-bold text-2xl text-indigo-700 font-mono">
                                        {viewingEntry.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </div>
                                </div>
                            </div>

                            {/* Tables Grid */}
                            <div className="grid grid-cols-1 gap-8">
                                {/* Allocations */}
                                <div>
                                    <h3 className="font-bold text-slate-700 uppercase text-sm mb-3 flex items-center gap-2">
                                        <Layers size={16} /> Rateio (Apropriação de Custo)
                                    </h3>
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                                                <tr>
                                                    <th className="p-3 text-left">G.O.</th>
                                                    <th className="p-3 text-left">Descrição</th>
                                                    <th className="p-3 text-center">Tipo</th>
                                                    <th className="p-3 text-right">Valor</th>
                                                    <th className="p-3 text-right">%</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {viewingEntry.allocations.map(alloc => (
                                                    <tr key={alloc.id} className="border-b last:border-0 hover:bg-slate-50">
                                                        <td className="p-3 font-mono text-xs">{alloc.budgetGroupCode}</td>
                                                        <td className="p-3 text-slate-700">{alloc.description}</td>
                                                        <td className="p-3 text-center text-[10px] font-bold uppercase">{alloc.costType}</td>
                                                        <td className="p-3 text-right font-mono font-medium">{alloc.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                        <td className="p-3 text-right text-xs text-slate-400 font-mono">
                                                            {((alloc.value / viewingEntry.totalValue) * 100).toFixed(1)}%
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Installments */}
                                <div>
                                    <h3 className="font-bold text-slate-700 uppercase text-sm mb-3 flex items-center gap-2">
                                        <Calendar size={16} /> Parcelamento Financeiro
                                    </h3>
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                                                <tr>
                                                    <th className="p-3 text-center w-16">#</th>
                                                    <th className="p-3 text-left">Vencimento</th>
                                                    <th className="p-3 text-left">Status</th>
                                                    <th className="p-3 text-right">Valor</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(viewingEntry.installments || []).map(inst => (
                                                    <tr key={inst.id} className="border-b last:border-0 hover:bg-slate-50">
                                                        <td className="p-3 text-center font-bold text-slate-500">{inst.number}</td>
                                                        <td className="p-3 font-mono text-slate-700">
                                                            {new Date(inst.dueDate).toLocaleDateString()}
                                                            <span className="ml-2 text-[10px] text-slate-400 uppercase">
                                                                ({new Date(inst.dueDate) < new Date() ? 'Vencido' : 'À Vencer'})
                                                            </span>
                                                        </td>
                                                        <td className="p-3">
                                                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Provisão</span>
                                                        </td>
                                                        <td className="p-3 text-right font-mono font-medium">{inst.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                            <button onClick={() => setViewingEntry(null)} className="px-4 py-2 border border-slate-300 rounded text-slate-600 font-bold uppercase text-xs hover:bg-slate-50">
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="p-4 border-b border-slate-100 flex flex-col gap-4">
                {/* Top Actions Row */}
                <div className="flex justify-between items-center gap-4">
                    <div className="flex gap-2 flex-1 items-center">
                        <button onClick={() => setViewMode('form')} className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 font-bold uppercase text-xs hover:bg-green-700 shadow-sm shrink-0">
                            <Plus size={16} /> Novo Lançamento (NF)
                        </button>

                        <div className="relative flex-1 max-w-sm ml-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                placeholder="Buscar fornecedor ou nota..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Date Filters */}
                        <div className="flex items-center gap-2 p-1 bg-slate-50 border border-slate-200 rounded-lg">
                            <Calendar size={14} className="text-slate-400 ml-2" />
                            <input
                                type="date"
                                className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none w-28"
                                value={filterStart}
                                onChange={e => setFilterStart(e.target.value)}
                                title="Data Inicial"
                            />
                            <span className="text-slate-300">-</span>
                            <input
                                type="date"
                                className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none w-28"
                                value={filterEnd}
                                onChange={e => setFilterEnd(e.target.value)}
                                title="Data Final"
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 items-center">
                        {selectedIds.size > 0 && (
                            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded text-xs animate-in fade-in slide-in-from-right-4">
                                <span className="font-bold text-indigo-700">{selectedIds.size} selecionados</span>
                                <span className="w-px h-3 bg-indigo-200 block"></span>
                                <span className="font-mono text-indigo-800">{selectedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        )}
                        <button
                            onClick={handleExport}
                            disabled={filteredEntries.length === 0}
                            className={`flex items-center gap-2 px-4 py-2 border rounded text-xs font-bold uppercase transition-colors ${selectedIds.size > 0 ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Download size={16} /> {selectedIds.size > 0 ? 'Exportar Seleção' : 'Exportar Lista'}
                        </button>
                    </div>
                </div>

                {/* Summary Row */}
                <div className="flex justify-end border-t border-slate-50 pt-2">
                    <div className="text-xs font-bold text-slate-500 uppercase flex gap-4">
                        <div>Visualizando: <span className="text-slate-800 ml-1">{filteredEntries.length} lançamentos</span></div>
                        <div>Total Filtrado: <span className="text-slate-800 ml-1">{filteredEntries.reduce((acc, e) => acc + e.totalValue, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-xs sticky top-0 z-10">
                        <tr>
                            <th className="p-3 w-10 border-b text-center">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    checked={filteredEntries.length > 0 && selectedIds.size === filteredEntries.length}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th className="p-3 border-b">Data Emissão</th>
                            <th className="p-3 border-b">Fornecedor</th>
                            <th className="p-3 border-b">Documento</th>
                            <th className="p-3 border-b text-center">Detalhes</th>
                            <th className="p-3 border-b text-right">Valor Total</th>
                            <th className="p-3 border-b text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEntries.map(entry => (
                            <tr
                                key={entry.id}
                                className={`border-b transition-colors cursor-pointer group ${selectedIds.has(entry.id) ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-slate-50'}`}
                                onClick={(e) => {
                                    // Prevent modal open if clicking checkbox
                                    if ((e.target as HTMLElement).tagName === 'INPUT') return;
                                    setViewingEntry(entry);
                                }}
                            >
                                <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        checked={selectedIds.has(entry.id)}
                                        onChange={() => toggleSelect(entry.id)}
                                    />
                                </td>
                                <td className="p-3 font-mono text-slate-500">{new Date(entry.issueDate).toLocaleDateString()}</td>
                                <td className="p-3 font-bold text-slate-700">{entry.supplier}</td>
                                <td className="p-3">{entry.documentNumber}</td>
                                <td className="p-3 text-center">
                                    <div className="flex justify-center flex-col items-center gap-1">
                                        {entry.allocations?.length > 1 ?
                                            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[10px] font-bold">RATEIO: {entry.allocations.length} G.O.s</span>
                                            : <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-mono">{entry.allocations?.[0]?.budgetGroupCode}</span>
                                        }
                                        <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">De: {entry.allocations?.[0]?.description?.substring(0, 15)}...</span>
                                    </div>
                                </td>
                                <td className="p-3 text-right font-bold text-slate-800">{entry.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className="p-3 text-center">
                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{entry.status}</span>
                                </td>
                            </tr>
                        ))}
                        {entries.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-10 text-center text-slate-400 uppercase text-sm italic">Nenhum lançamento registrado.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- TAB 3: ANALYSIS DASHBOARD ---
const AnalysisDashboardTab = ({ tree, entries }: { tree: BudgetNode[], entries: FinancialEntry[] }) => {
    return (
        <div className="p-6 h-full overflow-auto bg-slate-50">
            <div className="grid grid-cols-3 gap-6 mb-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-slate-500 uppercase text-xs font-bold mb-2">Orçamento Total (Meta)</h3>
                    <div className="text-2xl font-bold text-slate-900">R$ 53.670.434,74</div>
                    <div className="text-xs text-green-600 mt-1 flex items-center gap-1"><Check size={12} /> Base: Versão 01</div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-slate-500 uppercase text-xs font-bold mb-2">Total Comprometido (NFs + Pedidos)</h3>
                    <div className="text-2xl font-bold text-blue-600">
                        {entries.reduce((acc, e) => acc + e.totalValue, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Apropriação por emissão</div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-slate-500 uppercase text-xs font-bold mb-2">Desembolso Previsto (Próx. 30 Dias)</h3>
                    <div className="text-2xl font-bold text-orange-600">R$ 145.200,00</div>
                    <div className="text-xs text-slate-400 mt-1">Conforme vencimento das parcelas</div>
                </div>

                <div className="bg-indigo-600 p-6 rounded-xl shadow-lg border border-indigo-700 flex flex-col justify-between">
                    <div>
                        <h3 className="text-indigo-100 uppercase text-xs font-bold mb-2">Relatórios Consolidados</h3>
                        <p className="text-white text-sm opacity-90">Gere relatórios detalhados em formato Excel de toda a movimentação financeira e estrutura orçamentária.</p>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={() => {
                                import('../services/excelService').then(({ ExcelService }) => {
                                    ExcelService.exportFinancialEntries(entries);
                                });
                            }}
                            className="flex-1 bg-white text-indigo-700 px-4 py-2 rounded font-bold uppercase text-[10px] hover:bg-indigo-50 shadow-sm flex items-center justify-center gap-2"
                        >
                            <Download size={14} /> Exportar Financeiro
                        </button>
                        <button
                            onClick={() => {
                                import('../services/excelService').then(({ ExcelService }) => {
                                    ExcelService.exportBudget(tree);
                                });
                            }}
                            className="flex-1 bg-indigo-500 text-white px-4 py-2 rounded font-bold uppercase text-[10px] hover:bg-indigo-400 shadow-sm border border-indigo-400 flex items-center justify-center gap-2"
                        >
                            <Download size={14} /> Exportar Orçamento
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-slate-700 uppercase text-sm">Fluxo de Caixa Projetado (Desembolso)</h3>
                </div>
                <div className="p-8 flex items-center justify-center text-slate-400 italic">
                    <BarChart className="mr-2" size={24} /> Gráfico de Barras: Vencimentos Jan/Fev/Mar (Mock)
                </div>
            </div>
        </div>
    )
}

// --- MAIN VIEW COMPONENT ---
export const BudgetControlView: React.FC<Props> = ({ appData, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'budget' | 'financial' | 'analysis'>('budget');

    // State
    const [budgetTree, setBudgetTree] = useState<BudgetNode[]>(appData.budgetTree || generateInitialTree(appData.budgetGroups || []));
    const [entries, setEntries] = useState<FinancialEntry[]>(appData.financialEntries || []);
    const [budgetVersions, setBudgetVersions] = useState<BudgetSnapshot[]>(appData.budgetVersions || []);
    const [suppliers, setSuppliers] = useState<Supplier[]>(appData.suppliers || []);

    // Auto-Save Effect
    useEffect(() => {
        // In a real app we'd debounce or explicit save
    }, [budgetTree, entries, budgetVersions, suppliers]);

    const handleUpdateTree = (newTree: BudgetNode[]) => {
        setBudgetTree(newTree);
        onUpdate({ budgetTree: newTree });
    };

    const handleUpdateEntries = (newEntries: FinancialEntry[]) => {
        setEntries(newEntries);
        onUpdate({ financialEntries: newEntries });
    };

    const handleUpdateSuppliers = (newSuppliers: Supplier[]) => {
        setSuppliers(newSuppliers);
        onUpdate({ suppliers: newSuppliers });
    };

    const handleSaveVersion = (desc: string) => {
        // Create Snapshot
        const newVersion: BudgetSnapshot = {
            version: (budgetVersions.length || 0) + 1,
            createdAt: new Date().toISOString(),
            description: desc,
            tree: JSON.parse(JSON.stringify(budgetTree)), // Deep copy state
            totalValue: budgetTree.reduce((acc, n) => acc + n.totalValue, 0)
        };
        const newVersions = [...budgetVersions, newVersion];
        setBudgetVersions(newVersions);
        onUpdate({ budgetVersions: newVersions });
        alert(`Versão ${newVersion.version} salva com sucesso!`);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 p-4">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Controle Orçamentário e Financeiro (ERP)</h1>
                    <p className="text-slate-500">Gestão Integrada: Orçamento x Realizado x Desembolso</p>
                </div>
                <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                    <TabButton active={activeTab === 'budget'} onClick={() => setActiveTab('budget')} icon={<BarChart size={16} />} label="Estrutura Orçamentária" />
                    <TabButton active={activeTab === 'financial'} onClick={() => setActiveTab('financial')} icon={<DollarSign size={16} />} label="Lançamento de NFs" />
                    <TabButton active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} icon={<FileText size={16} />} label="Análise & Relatórios" />
                </div>
            </header>

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                {activeTab === 'budget' && <BudgetStructureTab tree={budgetTree} onUpdate={handleUpdateTree} versions={budgetVersions} onSaveVersion={handleSaveVersion} />}
                {activeTab === 'financial' && <FinancialEntryTab entries={entries} budgetTree={budgetTree} onUpdate={handleUpdateEntries} savedSuppliers={suppliers} onSaveSuppliers={handleUpdateSuppliers} />}
                {activeTab === 'analysis' && <AnalysisDashboardTab tree={budgetTree} entries={entries} />}
            </div>
        </div>
    );
};
