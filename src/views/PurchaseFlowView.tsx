import React, { useState, useEffect } from 'react';
import { AppData, PurchaseRequest, PurchaseRequestItem, BudgetNode, TotvsItem } from '../../types';
import { Plus, Check, X, AlertCircle, ShoppingCart, Archive, FileText, Search, Upload, Lock } from 'lucide-react';
import { ExcelService } from '../services/excelService';
import { PermissionService } from '../services/permissionService';
import { UserService } from '../services/userService';
import { supabase } from '../services/supabase';

interface Props {
    appData: AppData;
    onUpdate: (data: Partial<AppData>) => void;
}

export const PurchaseFlowView: React.FC<Props> = ({ appData, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'create' | 'warehouse' | 'engineering' | 'manager' | 'totvs'>('create');
    const [requests, setRequests] = useState<PurchaseRequest[]>(appData.purchaseRequests || []);
    const [userRole, setUserRole] = useState<string>('VIEWER');
    const [loadingRole, setLoadingRole] = useState(true);

    // Load user role
    useEffect(() => {
        const loadUserRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const profile = await UserService.getProfile(user.id);
                setUserRole(profile?.role || 'VIEWER');
            }
            setLoadingRole(false);
        };
        loadUserRole();
    }, []);

    // --- MOCK DATA GENERATOR FOR VISUALIZATION ---
    // In a real scenario, this would come from appData

    const handleSaveRequest = (req: PurchaseRequest) => {
        const newRequests = [...requests, req];
        setRequests(newRequests);
        onUpdate({ purchaseRequests: newRequests });
        setActiveTab('warehouse'); // Move to next step visualization
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6">
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Fluxo de Compras (Supply Chain)</h1>
                    <p className="text-slate-500">Gestão de Solicitações: Engenharia → Almoxarifado → Aprovação</p>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex space-x-4 border-b border-slate-200 mb-6">
                <TabButton
                    active={activeTab === 'create'}
                    onClick={() => setActiveTab('create')}
                    icon={<Plus size={18} />}
                    label="Solicitação (Eng)"
                    disabled={!PermissionService.canCreatePurchaseRequests(userRole)}
                />
                <TabButton
                    active={activeTab === 'warehouse'}
                    onClick={() => setActiveTab('warehouse')}
                    icon={<Archive size={18} />}
                    label="Almoxarifado"
                    count={requests.filter(r => r.status === 'Aguardando Almoxarifado').length}
                    disabled={!PermissionService.canEditWarehouse(userRole)}
                />
                <TabButton
                    active={activeTab === 'engineering'}
                    onClick={() => setActiveTab('engineering')}
                    icon={<FileText size={18} />}
                    label="Vínculo Orçamentário"
                    count={requests.filter(r => r.status === 'Em Análise Engenharia').length}
                    disabled={!PermissionService.canEditBudget(userRole)}
                />
                <TabButton
                    active={activeTab === 'manager'}
                    onClick={() => setActiveTab('manager')}
                    icon={<Check size={18} />}
                    label="Aprovação Gerente"
                    count={requests.filter(r => r.status === 'Aguardando Gerente').length}
                    disabled={!PermissionService.canApprovePurchases(userRole)}
                />
                <TabButton
                    active={activeTab === 'totvs'}
                    onClick={() => setActiveTab('totvs')}
                    icon={<ShoppingCart size={18} />}
                    label="Integração TOTVS"
                    count={requests.filter(r => r.status === 'Aprovado').length}
                />
            </div>

            <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                {activeTab === 'create' && <CreateRequestForm
                    onSave={handleSaveRequest}
                    requests={requests}
                    totvsItems={appData.totvsItems || []}
                    onUpdateAppData={onUpdate}
                    onUpdateRequests={(updated) => {
                        const newReqs = requests.map(r => updated.find(u => u.id === r.id) || r);
                        setRequests(newReqs);
                        onUpdate({ purchaseRequests: newReqs });
                    }}
                />}
                {activeTab === 'warehouse' && <WarehouseCheckView requests={requests.filter(r => r.status === 'Aguardando Almoxarifado')} onUpdateRequests={(updated: PurchaseRequest[]) => {
                    const newReqs = requests.map((r) => updated.find((u) => u.id === r.id) || r);
                    setRequests(newReqs);
                    onUpdate({ purchaseRequests: newReqs });
                }} />}
                {activeTab === 'engineering' && <BudgetLinkView
                    requests={requests.filter(r => r.status === 'Em Análise Engenharia')}
                    budgetTree={appData.budgetTree || []}
                    onUpdateRequests={(updated) => {
                        const newReqs = requests.map(r => updated.find(u => u.id === r.id) || r);
                        setRequests(newReqs);
                        onUpdate({ purchaseRequests: newReqs });
                    }}
                />}
                {activeTab === 'manager' && <ManagerApprovalView requests={requests.filter(r => r.status === 'Aguardando Gerente')} onUpdateRequests={(updated: PurchaseRequest[]) => {
                    const newReqs = requests.map(r => updated.find(u => u.id === r.id) || r);
                    setRequests(newReqs);
                    onUpdate({ purchaseRequests: newReqs });
                }} />}
                {activeTab === 'totvs' && <TotvsIntegrationView
                    requests={requests.filter(r => r.status === 'Aprovado' || r.status === 'No TOTVS' || r.status === 'Finalizado')}
                    onUpdateRequests={(updatedRequests) => {
                        const newReqs = requests.map(r => updatedRequests.find(u => u.id === r.id) || r);
                        setRequests(newReqs);
                        onUpdate({ purchaseRequests: newReqs });
                    }}
                />}
            </div>
        </div>
    );
};

// --- SUB COMPONENTS ---

const TabButton = ({ active, onClick, icon, label, count, disabled }: any) => (
    <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors relative ${disabled
            ? 'border-transparent text-slate-300 cursor-not-allowed opacity-50'
            : active
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        title={disabled ? 'Você não tem permissão para acessar esta seção' : ''}
    >
        {icon}
        <span>{label}</span>
        {count > 0 && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{count}</span>}
        {disabled && <Lock size={14} className="ml-1" />}
    </button>
);

// --- MOCK TOTVS ITENS ---
const DEFAULT_TOTVS_ITEMS = [
    { code: '001.002.003', description: 'CIMENTO CP II-32 (SACO 50KG)', unit: 'SC' },
    { code: '003.010.005', description: 'BLOCO DE CONCRETO 14X19X39', unit: 'UN' },
    { code: '010.020.001', description: 'AREIA MEDIA (M3)', unit: 'M3' },
    { code: '015.005.002', description: 'ACO CA-50 10.0MM (BARRA 12M)', unit: 'BR' },
    { code: '020.001.010', description: 'TINTA LATEX ACRILICA (LATA 18L)', unit: 'UN' },
    { code: '999.000.000', description: 'SERVICO DE PEDREIRO (H)', unit: 'H' },
];

const CreateRequestForm = ({ onSave, requests, totvsItems, onUpdateAppData, onUpdateRequests }: { onSave: (r: PurchaseRequest) => void, requests: PurchaseRequest[], totvsItems: TotvsItem[], onUpdateAppData: (data: Partial<AppData>) => void, onUpdateRequests: (reqs: PurchaseRequest[]) => void }) => {
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [items, setItems] = useState<PurchaseRequestItem[]>([]);
    const [description, setDescription] = useState('');

    // New Item Inputs
    const [newItemDesc, setNewItemDesc] = useState('');
    const [newItemCode, setNewItemCode] = useState(''); // New: TOTVS Code
    const [newItemQty, setNewItemQty] = useState(0);
    const [newItemUnit, setNewItemUnit] = useState('UN');

    // Autocomplete State
    const [showSuggestions, setShowSuggestions] = useState(false);

    const handleEdit = (req: PurchaseRequest) => {
        setDescription(req.description);
        setItems(req.items);
        setEditingId(req.id);
        setView('form');
    };

    const handleNew = () => {
        setDescription('');
        setItems([]);
        setEditingId(null);
        setView('form');
    };

    const handleSelectTotvsItem = (item: TotvsItem) => {
        setNewItemDesc(item.description);
        setNewItemCode(item.code);
        setNewItemUnit(item.unit);
        setShowSuggestions(false);
    };

    const handleProductUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const items = await ExcelService.parseTotvsItems(file);
            onUpdateAppData({ totvsItems: items });
            alert(`${items.length} produtos carregados com sucesso!`);
        } catch (error) {
            console.error(error);
            alert("Erro ao processar planilha de produtos.");
        }
    };

    const handleClearProducts = () => {
        if (window.confirm('Tem certeza que deseja remover todos os produtos carregados?')) {
            onUpdateAppData({ totvsItems: [] });
            alert('Lista de produtos limpa com sucesso!');
        }
    };

    const handleAddItem = () => {
        if (!newItemDesc || newItemQty <= 0) return;
        setItems([...items, {
            id: Date.now().toString(),
            description: newItemDesc.toUpperCase(),
            quantityRequested: newItemQty,
            unit: newItemUnit.toUpperCase(),
            quantityToBuy: newItemQty,
            totvsCode: newItemCode || undefined
        }]);
        setNewItemDesc('');
        setNewItemCode('');
        setNewItemQty(0);
        setNewItemUnit('UN');
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const handleSubmit = () => {
        if (items.length === 0 || !description) return;

        if (editingId) {
            // Update existing
            const original = requests.find(r => r.id === editingId);
            if (original) {
                const updated: PurchaseRequest = {
                    ...original,
                    description: description.toUpperCase(),
                    items,
                    history: [...original.history, { date: new Date().toISOString(), user: 'Engenharia', action: 'Edição' }]
                };
                onUpdateRequests([updated]);
            }
        } else {
            // Create new
            onSave({
                id: Date.now().toString(),
                requestId: `REQ-${Math.floor(Math.random() * 10000)}`,
                description: description.toUpperCase(),
                date: new Date().toISOString(),
                requester: 'ENGENHARIA',
                priority: 'Normal',
                status: 'Aguardando Almoxarifado',
                items,
                history: [{ date: new Date().toISOString(), user: 'Engenharia', action: 'Criação' }]
            });
        }
        setView('list');
    };

    if (view === 'list') {
        const myRequests = requests.filter(r => r.status === 'Aguardando Almoxarifado' || r.status === 'Em Análise Engenharia');

        return (
            <div>
                <div className="flex justify-between items-center mb-6">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-xl font-bold uppercase text-slate-700">Minhas Solicitações</h3>
                        <p className="text-xs text-slate-500 uppercase font-bold">Total de {totvsItems.length || DEFAULT_TOTVS_ITEMS.length} itens cadastrados no catálogo TOTVS</p>
                    </div>
                    <div className="flex gap-3">
                        {totvsItems.length > 0 && (
                            <button
                                onClick={handleClearProducts}
                                className="bg-red-50 text-red-600 px-4 py-2 rounded flex items-center gap-2 border border-red-200 hover:bg-red-100 font-bold uppercase text-sm shadow-sm transition-all active:scale-95"
                            >
                                <X size={18} /> Limpar
                            </button>
                        )}
                        <label className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded flex items-center gap-2 hover:bg-slate-50 font-bold uppercase text-sm cursor-pointer shadow-sm transition-all active:scale-95">
                            <Upload size={18} /> Subir Planilha Produtos
                            <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleProductUpload} />
                        </label>
                        <button onClick={handleNew} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 font-bold uppercase text-sm shadow-sm transition-all active:scale-95">
                            <Plus size={18} /> Nova Solicitação
                        </button>
                    </div>
                </div>

                {myRequests.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded border border-dashed border-slate-300">
                        <p className="text-slate-500 uppercase text-sm">Nenhuma solicitação ativa encontrada. Crie uma nova.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {myRequests.map(req => (
                            <div key={req.id} className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group">
                                <div>
                                    <div className="flex items-center gap-2 font-bold text-slate-800">
                                        <span>{req.requestId}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${req.status === 'Aguardando Almoxarifado' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {req.status}
                                        </span>
                                    </div>
                                    <div className="text-sm text-slate-600 uppercase mt-1">{req.description}</div>
                                    <div className="text-xs text-slate-400 mt-1 uppercase">{req.items.length} itens • {new Date(req.date).toLocaleDateString()}</div>
                                </div>
                                <button
                                    onClick={() => handleEdit(req)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1 bg-slate-100 text-slate-600 rounded text-sm font-bold uppercase hover:bg-slate-200"
                                >
                                    Editar
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setView('list')} className="text-sm text-slate-500 hover:text-slate-800 underline uppercase font-bold">Voltar</button>
                <h3 className="text-xl font-bold uppercase text-slate-700">{editingId ? 'Editar Solicitação' : 'Nova Solicitação de Compra'}</h3>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição Geral do Pedido</label>
                    <input
                        className="w-full border rounded p-2 uppercase"
                        placeholder="EX: MATERIAIS PARA FUNDAÇÃO DA TORRE A"
                        value={description}
                        onChange={e => setDescription(e.target.value.toUpperCase())}
                    />
                </div>

                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                    <h4 className="font-bold text-sm text-slate-700 mb-4 uppercase flex items-center gap-2">
                        <ShoppingCart size={16} /> Adicionar Itens
                    </h4>

                    <div className="grid grid-cols-12 gap-3 items-end mb-4 relative z-10">
                        {/* Item Logic with Suggestion */}
                        <div className="col-span-6 relative">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Descrição do Item (Busca TOTVS)</label>
                            <input
                                className="w-full border rounded p-2 uppercase text-sm"
                                placeholder="DIGITE PARA BUSCAR..."
                                value={newItemDesc}
                                onChange={e => {
                                    setNewItemDesc(e.target.value.toUpperCase());
                                    setShowSuggestions(true);
                                    if (e.target.value === '') setNewItemCode('');
                                }}
                                onFocus={() => setShowSuggestions(true)}
                            />
                            {/* Suggestions Dropdown */}
                            {showSuggestions && newItemDesc.length > 0 && (
                                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-lg rounded-b max-h-48 overflow-auto z-50">
                                    {(totvsItems.length > 0 ? totvsItems : DEFAULT_TOTVS_ITEMS)
                                        .filter(i => i.description.includes(newItemDesc) || i.code.includes(newItemDesc))
                                        .map(item => (
                                            <button
                                                key={item.code}
                                                className="w-full text-left p-2 hover:bg-slate-100 text-xs border-b last:border-0"
                                                onClick={() => handleSelectTotvsItem(item)}
                                            >
                                                <div className="font-bold text-slate-700">{item.description}</div>
                                                <div className="text-slate-400 flex justify-between">
                                                    <span>COD: {item.code}</span>
                                                    <span>UN: {item.unit}</span>
                                                </div>
                                            </button>
                                        ))}
                                    <button
                                        className="w-full text-left p-2 bg-slate-50 text-slate-500 text-xs italic hover:bg-slate-100"
                                        onClick={() => setShowSuggestions(false)}
                                    >
                                        Usar texto livre (Novo Item)
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Código</label>
                            <input className="w-full border rounded p-2 text-sm bg-slate-100 text-slate-500" readOnly value={newItemCode} placeholder="AUTO" />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Qtd</label>
                            <input className="w-full border rounded p-2 text-sm" type="number" placeholder="0" value={newItemQty || ''} onChange={e => setNewItemQty(Number(e.target.value))} />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unidade</label>
                            <input
                                className="w-full border rounded p-2 text-sm uppercase"
                                placeholder="UN"
                                value={newItemUnit}
                                onChange={e => setNewItemUnit(e.target.value.toUpperCase())}
                                list="units-list"
                            />
                            <datalist id="units-list">
                                <option value="UN" />
                                <option value="KG" />
                                <option value="M" />
                                <option value="M2" />
                                <option value="M3" />
                                <option value="L" />
                                <option value="CX" />
                                <option value="SC" />
                            </datalist>
                        </div>
                    </div>
                    <button onClick={handleAddItem} className="w-full bg-slate-800 text-white py-2 rounded font-bold uppercase text-xs hover:bg-slate-700">
                        + Incluir Item na Lista
                    </button>
                </div>

                {items.length > 0 && (
                    <div className="bg-white rounded border border-slate-200 overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-100 text-slate-600 border-b">
                                <tr>
                                    <th className="p-3 uppercase text-xs">Código</th>
                                    <th className="p-3 uppercase text-xs">Item</th>
                                    <th className="p-3 uppercase text-xs w-20 text-center">Qtd</th>
                                    <th className="p-3 uppercase text-xs w-20 text-center">Un</th>
                                    <th className="p-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(item => (
                                    <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50">
                                        <td className="p-3 text-xs font-mono text-slate-400">{item.totvsCode || '-'}</td>
                                        <td className="p-3 text-slate-700 font-medium">{item.description}</td>
                                        <td className="p-3 text-center">{item.quantityRequested}</td>
                                        <td className="p-3 text-center text-xs bg-slate-50 mx-1 rounded">{item.unit}</td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => handleRemoveItem(item.id)} className="text-red-400 hover:text-red-600 p-1"><X size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <button onClick={handleSubmit} disabled={items.length === 0} className="w-full bg-green-600 text-white py-4 rounded-lg font-bold uppercase shadow-lg hover:bg-green-700 disabled:opacity-50 mt-4 transition-transform">
                    {editingId ? 'Salvar Alterações e Atualizar' : 'Finalizar e Enviar para Almoxarifado'}
                </button>
            </div>
        </div>
    );
}

const WarehouseCheckView = ({ requests, onUpdateRequests }: { requests: PurchaseRequest[], onUpdateRequests: (reqs: PurchaseRequest[]) => void }) => {
    return (
        <div>
            <h3 className="text-xl font-bold mb-4">Verificação de Estoque (Almoxarifado)</h3>
            {requests.length === 0 ? <p className="text-slate-500">Nenhuma solicitação pendente.</p> : (
                <div className="space-y-6">
                    {requests.map(req => (
                        <WarehouseCard key={req.id} req={req} onProcess={(updatedReq) => onUpdateRequests([updatedReq])} />
                    ))}
                </div>
            )}
        </div>
    );
}

const WarehouseCard = ({ req, onProcess }: { req: PurchaseRequest, onProcess: (r: PurchaseRequest) => void }) => {
    // Local state for edits would be needed here, simplifying for prototype
    const handleConfirm = () => {
        // Assume user validated quantities here
        const updated = {
            ...req,
            status: 'Em Análise Engenharia' as const,
            history: [...req.history, { date: new Date().toISOString(), user: 'Almoxarifado', action: 'Validação de Estoque' }]
        };
        onProcess(updated);
    };

    return (
        <div className="border rounded-lg p-4 shadow-sm">
            <div className="flex justify-between font-bold mb-2">
                <span>{req.requestId} - {req.description}</span>
                <span className="text-orange-600">Aguardando Verificação</span>
            </div>
            <table className="w-full text-sm mb-4">
                <thead><tr className="bg-slate-50"><th className="p-2 text-left">Item</th><th className="p-2">Qtd Solicitada</th><th className="p-2">Em Estoque (Simular)</th><th className="p-2">Comprar</th></tr></thead>
                <tbody>
                    {req.items.map(item => (
                        <tr key={item.id} className="border-t">
                            <td className="p-2">{item.description}</td>
                            <td className="p-2">{item.quantityRequested}</td>
                            <td className="p-2">
                                <input className="w-20 border rounded p-1" type="number" defaultValue={0} />
                            </td>
                            <td className="p-2">{item.quantityRequested}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="flex justify-end gap-2">
                <button onClick={handleConfirm} className="bg-blue-600 text-white px-4 py-2 rounded">Confirmar e Enviar para Engenharia</button>
            </div>
        </div>
    )
}

const BudgetLinkView = ({ requests, onUpdateRequests, budgetTree }: { requests: PurchaseRequest[], onUpdateRequests: (reqs: PurchaseRequest[]) => void, budgetTree: BudgetNode[] }) => {
    // Helper to get flat groups
    const flatGroups = React.useMemo(() => {
        const list: { code: string, desc: string }[] = [];
        const traverse = (nodes: BudgetNode[]) => {
            nodes.forEach(n => {
                // Should we allow selecting Groups or only Items? Usually Items (leafs) or Groups that are cost centers.
                // For simplicity, let's allow any node that has a code.
                if (n.code) list.push({ code: n.code, desc: n.description });
                if (n.children) traverse(n.children);
            });
        };
        traverse(budgetTree);
        return list;
    }, [budgetTree]);

    // Local state to track edits before saving? 
    // Actually we can update the request object directly since it's passed down.

    return (
        <div>
            <h3 className="text-xl font-bold mb-4">Vínculo Orçamentário (Engenharia)</h3>
            {requests.map((req: PurchaseRequest) => (
                <div key={req.id} className="border rounded-xl p-6 mb-6 bg-white shadow-sm border-slate-200">
                    <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                        <div>
                            <div className="font-bold text-lg text-slate-800">{req.requestId} - {req.description}</div>
                            <div className="text-sm text-slate-500 mt-1">
                                Solicitante: {req.requester} • Data: {new Date(req.date).toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {/* Items List with Per-Item Budget Link */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-sm text-slate-700 uppercase">Classificação de Custos (Itens)</h4>
                                {/* Batch Apply Helper */}
                                <div className="flex gap-2 items-center">
                                    <span className="text-[10px] font-bold uppercase text-slate-400">Aplicar a todos:</span>
                                    <select
                                        className="border rounded text-xs p-1 max-w-[200px]"
                                        onChange={(e) => {
                                            if (!e.target.value) return;
                                            const updatedItems = req.items.map(i => ({ ...i, budgetGroupCode: e.target.value }));
                                            const updatedReq = { ...req, items: updatedItems, budgetGroupCode: e.target.value }; // Also set main one as default/fallback
                                            onUpdateRequests([updatedReq]);
                                        }}
                                    >
                                        <option value="">Selecione...</option>
                                        {flatGroups.map(g => <option key={g.code} value={g.code}>{g.code} - {g.desc}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded border border-slate-200 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 text-slate-600">
                                        <tr>
                                            <th className="p-2 text-left text-xs uppercase">Item</th>
                                            <th className="p-2 text-center text-xs w-20 uppercase">Qtd</th>
                                            <th className="p-2 text-center text-xs w-16 uppercase">Un</th>
                                            <th className="p-2 text-left text-xs uppercase w-64 bg-indigo-50 text-indigo-800">Grupo Orçamentário (G.O.)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {req.items.map(item => (
                                            <tr key={item.id} className="border-t border-slate-100 last:border-0 hover:bg-white transition-colors">
                                                <td className="p-2 text-slate-700">
                                                    <div className="font-medium">{item.description}</div>
                                                    {item.totvsCode && <div className="text-[10px] text-slate-400 font-mono">COD: {item.totvsCode}</div>}
                                                </td>
                                                <td className="p-2 text-center font-semibold">{item.quantityToBuy}</td>
                                                <td className="p-2 text-center text-xs text-slate-500">{item.unit}</td>
                                                <td className="p-2 bg-indigo-50/30">
                                                    <select
                                                        className={`w-full border rounded text-xs p-1.5 focus:ring-2 focus:ring-indigo-500 outline-none ${item.budgetGroupCode ? 'border-indigo-300 text-indigo-700 font-bold bg-white' : 'border-red-300 bg-red-50 text-red-700'}`}
                                                        value={item.budgetGroupCode || ''}
                                                        onChange={(e) => {
                                                            const updatedItems = req.items.map(i => i.id === item.id ? { ...i, budgetGroupCode: e.target.value } : i);
                                                            // Check if all items are same, if so update main budgetGroupCode, else maybe clear it or set to 'MIXED'
                                                            const allSame = updatedItems.every(i => i.budgetGroupCode === updatedItems[0].budgetGroupCode);
                                                            const updatedReq = {
                                                                ...req,
                                                                items: updatedItems,
                                                                budgetGroupCode: allSame ? updatedItems[0].budgetGroupCode : 'MULTIPLO'
                                                            };
                                                            onUpdateRequests([updatedReq]);
                                                        }}
                                                    >
                                                        <option value="">Selecione...</option>
                                                        {flatGroups.map(g => <option key={g.code} value={g.code}>{g.code} - {g.desc}</option>)}
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            disabled={req.items.some(i => !i.budgetGroupCode)}
                            onClick={() => {
                                if (req.items.some(i => !i.budgetGroupCode)) return;
                                const updated = {
                                    ...req,
                                    status: 'Aguardando Gerente',
                                    history: [...req.history, { date: new Date().toISOString(), user: 'Engenharia', action: 'Vínculo Orçamentário Finalizado' }]
                                } as PurchaseRequest;
                                onUpdateRequests([updated]);
                            }}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-2"
                            title={req.items.some(i => !i.budgetGroupCode) ? "Vincule todos os itens a um G.O. antes de prosseguir" : "Enviar para Aprovação"}
                        >
                            <Check size={18} /> Confirmar Vínculo e Enviar
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

const ManagerApprovalView = ({ requests, onUpdateRequests }: { requests: PurchaseRequest[], onUpdateRequests: (reqs: PurchaseRequest[]) => void }) => {
    // We can use local state for expanding cards
    const [expanded, setExpanded] = useState<string | null>(null);

    return (
        <div>
            <h3 className="text-xl font-bold mb-4">Aprovação Gerencial</h3>
            {requests.length === 0 ? <p className="text-slate-500">Nenhuma solicitação aguardando aprovação.</p> : (
                <div className="space-y-4">
                    {requests.map((req) => (
                        <div key={req.id} className={`border rounded-xl transition-all ${expanded === req.id ? 'bg-white shadow-md border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                            {/* Header */}
                            <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => setExpanded(expanded === req.id ? null : req.id)}>
                                <div>
                                    <div className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                        {req.requestId}
                                        <span className="text-sm font-normal text-slate-500">- {new Date(req.date).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-slate-600 font-medium">{req.description}</div>
                                    <div className="text-sm mt-1 bg-indigo-50 text-indigo-700 inline-block px-2 py-0.5 rounded border border-indigo-100 font-mono">
                                        G.O.: {req.budgetGroupCode || 'PENDENTE'}
                                    </div>
                                </div>
                                <div className="text-slate-400">
                                    {expanded === req.id ? 'Menos Detalhes ▲' : 'Mais Detalhes ▼'}
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expanded === req.id && (
                                <div className="border-t border-slate-100 p-4 bg-white rounded-b-xl">

                                    {/* Timeline/History Summary */}
                                    <div className="mb-4 text-xs text-slate-500 flex gap-4">
                                        <div>Solicitante: <span className="font-bold">{req.requester}</span></div>
                                        <div>Prioridade: <span className="font-bold">{req.priority}</span></div>
                                    </div>

                                    {/* Items Table */}
                                    <h4 className="font-bold text-sm text-slate-700 mb-2">Itens para Compra</h4>
                                    <table className="w-full text-sm mb-6 border border-slate-100 rounded overflow-hidden">
                                        <thead className="bg-slate-50 text-slate-600">
                                            <tr>
                                                <th className="p-2 text-left">Item</th>
                                                <th className="p-2 text-center w-24">Qtd Solicitada</th>
                                                <th className="p-2 text-center w-24">Qtd Compra</th>
                                                <th className="p-2 text-center w-16">Un</th>
                                                <th className="p-2 text-left w-32">Classificação (G.O.)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {req.items.map(item => (
                                                <tr key={item.id} className="border-t border-slate-50">
                                                    <td className="p-2">{item.description}</td>
                                                    <td className="p-2 text-center text-slate-400">{item.quantityRequested}</td>
                                                    <td className="p-2 text-center font-bold text-slate-800">{item.quantityToBuy}</td>
                                                    <td className="p-2 text-center text-slate-500">{item.unit}</td>
                                                    <td className="p-2 text-xs font-mono text-indigo-700 bg-indigo-50/50">{item.budgetGroupCode || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        {/* Mock Total - Future Price Integration */}
                                        <tfoot className="bg-slate-50 text-slate-500 text-xs">
                                            <tr>
                                                <td colSpan={4} className="p-2 text-center italic">
                                                    *Valores monetários serão vinculados na Ordem de Compra (TOTVS)
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>

                                    {/* Actions */}
                                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                        <button className="px-4 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 text-sm font-bold flex items-center gap-2">
                                            <X size={16} /> Rejeitar / Devolver
                                        </button>
                                        <button onClick={() => {
                                            const updated: PurchaseRequest = {
                                                ...req,
                                                status: 'Aprovado',
                                                history: [...req.history, { date: new Date().toISOString(), user: 'Gerente', action: 'Aprovação Final' }]
                                            };
                                            onUpdateRequests([updated]);
                                        }} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-bold flex items-center gap-2 shadow-sm">
                                            <Check size={16} /> Aprovar Compra
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const TotvsIntegrationView = ({ requests, onUpdateRequests }: { requests: PurchaseRequest[], onUpdateRequests?: (req: PurchaseRequest[]) => void }) => {
    const [expanded, setExpanded] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter requests by search query (Search by OC or Description)
    const filteredRequests = requests.filter(req =>
        req.requestId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.totvsOrderNumber && req.totvsOrderNumber.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Edit State
    const [editDesc, setEditDesc] = useState('');
    const [editItems, setEditItems] = useState<PurchaseRequestItem[]>([]);

    const startEdit = (req: PurchaseRequest) => {
        setEditDesc(req.description);
        setEditItems(req.items);
        setEditingId(req.id);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditDesc('');
        setEditItems([]);
    };

    const saveEdit = (originalReq: PurchaseRequest) => {
        if (onUpdateRequests) {
            const updated = {
                ...originalReq,
                description: editDesc.toUpperCase(),
                items: editItems,
                history: [...originalReq.history, { date: new Date().toISOString(), user: 'Suprimentos', action: 'Correção no TOTVS' }]
            };
            onUpdateRequests([updated]);
        }
        setEditingId(null);
    };

    const updateItemQty = (itemId: string, newQty: number) => {
        setEditItems(prev => prev.map(i => i.id === itemId ? { ...i, quantityToBuy: newQty } : i));
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold uppercase text-slate-700">Painel de Integração TOTVS</h3>
                <div className="relative w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={16} className="text-slate-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all uppercase"
                        placeholder="Pesquisar OC ou Pedido..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {filteredRequests.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <Search size={40} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 uppercase text-sm font-bold">Nenhum pedido encontrado para "{searchQuery}"</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredRequests.map((req) => (
                        <div key={req.id} className={`border rounded-xl transition-all ${expanded === req.id ? 'bg-white shadow-md border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                            {/* Header */}
                            <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => !editingId && setExpanded(expanded === req.id ? null : req.id)}>
                                <div className="flex-1 mr-4">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-bold text-slate-800 text-lg font-mono">{req.requestId}</div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${req.status === 'Finalizado' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {req.status}
                                        </span>
                                    </div>
                                    <div className="text-slate-600 font-bold uppercase">{req.description}</div>
                                    <div className="text-xs text-slate-400 mt-1 uppercase">Solicitante: {req.requester} • G.O: {req.budgetGroupCode}</div>
                                </div>
                                <div className="text-slate-400 w-8 text-center">
                                    {expanded === req.id ? '▲' : '▼'}
                                </div>
                            </div>

                            {/* Expanded Area */}
                            {expanded === req.id && (
                                <div className="border-t border-slate-100 p-6 bg-white rounded-b-xl cursor-default">

                                    {/* OC Input Area (Always Visible) */}
                                    <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                                        <label className="block text-xs font-bold text-blue-800 uppercase mb-2">Número da Ordem de Compra (TOTVS)</label>
                                        <TotvsOrderInput req={req} onUpdate={(val) => {
                                            if (onUpdateRequests) {
                                                const updated = { ...req, totvsOrderNumber: val, status: val ? 'Finalizado' : 'Aprovado' } as PurchaseRequest;
                                                onUpdateRequests([updated]);
                                            }
                                        }} />
                                    </div>

                                    {/* Edit Mode Toggle */}
                                    {!editingId ? (
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="font-bold text-sm text-slate-700 uppercase">Itens do Pedido</h4>
                                            <button onClick={() => startEdit(req)} className="text-blue-600 hover:text-blue-800 text-xs font-bold uppercase flex items-center gap-1 border border-blue-200 px-3 py-1 rounded hover:bg-blue-50">
                                                <FileText size={14} /> Editar Informações
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="mb-4 p-4 bg-orange-50 border border-orange-100 rounded">
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="font-bold text-orange-800 uppercase text-sm flex items-center gap-2"><AlertCircle size={16} /> Modo de Edição</span>
                                                <div className="flex gap-2">
                                                    <button onClick={cancelEdit} className="text-slate-500 hover:text-slate-700 text-xs font-bold uppercase underline">Cancelar</button>
                                                    <button onClick={() => saveEdit(req)} className="bg-orange-600 text-white px-3 py-1 rounded text-xs font-bold uppercase hover:bg-orange-700 shadow-sm">Salvar Correção</button>
                                                </div>
                                            </div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrição do Pedido</label>
                                            <input
                                                className="w-full border rounded p-2 uppercase text-sm mb-2 bg-white"
                                                value={editDesc}
                                                onChange={e => setEditDesc(e.target.value.toUpperCase())}
                                            />
                                        </div>
                                    )}

                                    {/* Items Table */}
                                    <table className="w-full text-sm border-collapse">
                                        <thead className="bg-slate-100 text-slate-600">
                                            <tr>
                                                <th className="p-2 text-left uppercase text-xs">Código</th>
                                                <th className="p-2 text-left uppercase text-xs">Descrição</th>
                                                <th className="p-2 text-center uppercase text-xs w-24">Qtd Aprovada</th>
                                                {editingId && <th className="p-2 text-center uppercase text-xs w-24 text-orange-700 bg-orange-50">Nova Qtd</th>}
                                                <th className="p-2 text-center uppercase text-xs w-16">Un</th>
                                                <th className="p-2 text-left uppercase text-xs w-32">Classificação (G.O.)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(editingId ? editItems : req.items).map(item => (
                                                <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50">
                                                    <td className="p-2 font-mono text-xs text-slate-500">{item.totvsCode || '-'}</td>
                                                    <td className="p-2 font-medium text-slate-700">{item.description}</td>
                                                    <td className="p-2 text-center">{item.quantityToBuy}</td>
                                                    {editingId && (
                                                        <td className="p-2 text-center bg-orange-50">
                                                            <input
                                                                type="number"
                                                                className="w-20 border border-orange-300 rounded p-1 text-center font-bold text-orange-900 focus:ring-1 focus:ring-orange-500 outline-none"
                                                                value={item.quantityToBuy}
                                                                onChange={e => updateItemQty(item.id, Number(e.target.value))}
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="p-2 text-center text-xs text-slate-500">{item.unit}</td>
                                                    <td className="p-2 text-xs font-mono text-indigo-700 bg-indigo-50/50">{item.budgetGroupCode || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const TotvsOrderInput = ({ req, onUpdate }: { req: PurchaseRequest, onUpdate: (val: string) => void }) => {
    const [val, setVal] = useState(req.totvsOrderNumber || '');
    const [isfocused, setIsFocused] = useState(false);

    // Sync external changes if any
    React.useEffect(() => {
        setVal(req.totvsOrderNumber || '');
    }, [req.totvsOrderNumber]);

    const isDirty = (val || '') !== (req.totvsOrderNumber || '');
    const isSaved = !isDirty && !!req.totvsOrderNumber;

    const handleSave = () => {
        onUpdate(val.toUpperCase());
    };

    return (
        <div className="flex items-center gap-2">
            <div className={`relative flex-1 transition-all ${isfocused ? 'ring-2 ring-blue-100 rounded' : ''}`}>
                <input
                    className={`border rounded p-1.5 w-full uppercase font-mono text-slate-700 outline-none transition-colors
                        ${isSaved ? 'border-green-500 bg-green-50 text-green-700 font-bold' : 'border-slate-300 focus:border-blue-500'}
                    `}
                    placeholder="DIGITE Nº OC..."
                    value={val}
                    onChange={(e) => setVal(e.target.value.toUpperCase())}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                        setIsFocused(false);
                        // Optional: Auto-save on blur if dirty, or keep manual button?
                        // User asked "how do I know if it's saved", so manual button or explicit save state is better.
                        // Let's autosave on blur for convenience BUT keep the green state as feedback
                        if (isDirty) handleSave();
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleSave();
                            (e.target as HTMLInputElement).blur();
                        }
                    }}
                />
                {isSaved && (
                    <div className="absolute right-2 top-1.5 text-green-600 pointer-events-none flex items-center gap-1 bg-white pl-1">
                        <span className="text-[10px] font-bold">SALVO</span>
                        <Check size={14} />
                    </div>
                )}
            </div>

            {isDirty && (
                <button
                    onMouseDown={(e) => {
                        // Prevent blur from firing before click
                        e.preventDefault();
                        handleSave();
                    }}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-xs font-bold shadow-sm"
                    title="Salvar Alteração"
                >
                    SALVAR
                </button>
            )}
        </div>
    );
};
