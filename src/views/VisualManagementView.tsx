import React, { useState, useMemo } from 'react';
import { Settings, TrendingUp, Printer, Upload, Plus, Trash2, ArrowUp, ArrowDown, Save, CheckCircle, XCircle, Hammer, AlertTriangle } from 'lucide-react';
import { AppData, ProductionConfig, ServiceDefinition, ProductionStatus } from '../../types';
import { ApiService } from '../services/api';
import { ExcelService } from '../services/ExcelService';

// --- Default Services ---
const DEFAULT_SERVICES: ServiceDefinition[] = [
    { id: 'S1', name: 'Fundação', color: '#94a3b8', order: 1 },
    { id: 'S2', name: 'Alvenaria', color: '#3b82f6', order: 2 },
    { id: 'S3', name: 'Elétrica', color: '#f59e0b', order: 3 },
    { id: 'S4', name: 'Hidráulica', color: '#0ea5e9', order: 4 },
    { id: 'S5', name: 'Pintura', color: '#ec4899', order: 5 },
    { id: 'S6', name: 'Acabamento', color: '#10b981', order: 6 },
];

export const VisualManagementView = ({ appData }: { appData: AppData }) => {
    // --- State ---
    const [config, setConfig] = useState<ProductionConfig>(appData.visualManagement?.config || { towers: 4, floors: 12, aptsPerFloor: 6 });
    const [services, setServices] = useState<ServiceDefinition[]>(appData.visualManagement?.services || DEFAULT_SERVICES);
    const [status, setStatus] = useState<ProductionStatus>(appData.visualManagement?.status || {});

    // Layout State
    const [viewMode, setViewMode] = useState<'matrix' | 'config' | 'services'>('matrix');
    const [selectedServiceId, setSelectedServiceId] = useState<string>(services[1]?.id || services[0]?.id);
    const [isSaving, setIsSaving] = useState(false);
    const [pipelineTab, setPipelineTab] = useState<'backlog' | 'execution' | 'done'>('execution');

    const selectedService = services.find(s => s.id === selectedServiceId) || services[0];

    // --- Derived State for Pipeline ---
    const pipelineData = useMemo(() => {
        const execution: any[] = [];

        for (let t = 1; t <= config.towers; t++) {
            for (let f = 1; f <= config.floors; f++) {
                for (let a = 1; a <= config.aptsPerFloor; a++) {
                    const unitId = `T${t}-F${f}-A${a}`;
                    services.forEach(svc => {
                        const st = status[unitId]?.[svc.id];
                        if (st === 'started') {
                            execution.push({ unitId, service: svc, tower: t, floor: f, apt: a });
                        }
                    });
                }
            }
        }
        return { execution };
    }, [status, config, services]);


    // --- Actions ---

    const handleSave = async () => {
        setIsSaving(true);
        const newData = {
            ...appData,
            visualManagement: { config, services, status }
        };
        await ApiService.saveAppData(newData);
        setIsSaving(false);
        alert('Dados salvos com sucesso!');
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        try {
            const newServices = await ExcelService.parseServices(file);
            if (newServices.length > 0) {
                if (window.confirm(`Foram encontrados ${newServices.length} serviços. Deseja substituir a lista atual?`)) {
                    setServices(newServices);
                    if (newServices.length > 0) setSelectedServiceId(newServices[0].id);
                }
            } else {
                alert('Nenhum serviço encontrado na planilha.');
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao processar planilha.');
        }
        e.target.value = '';
    };

    const toggleStatus = (unitId: string, serviceId: string) => {
        setStatus(prev => {
            const current = prev[unitId]?.[serviceId] || 'pending';
            const next = current === 'pending' ? 'started' : (current === 'started' ? 'completed' : 'pending');

            return {
                ...prev,
                [unitId]: {
                    ...prev[unitId],
                    [serviceId]: next
                }
            };
        });
    };

    const getStatusStyle = (st: string | undefined, serviceColor: string) => {
        if (st === 'completed') return { backgroundColor: '#10b981', borderColor: 'transparent' }; // Green
        if (st === 'started') return { backgroundColor: serviceColor, borderColor: 'transparent' }; // Service Color
        return { backgroundColor: '#e2e8f0', borderColor: '#cbd5e1' }; // Gray (Slate 200)
    };

    // --- Components ---

    const MatrixView = () => (
        <div className="flex h-full bg-slate-50 overflow-hidden">

            {/* Main Content - Towers Area */}
            <div className="flex-1 flex flex-col overflow-hidden p-6 pb-2">

                {/* Towers Container - Fit to screen (flex-1) */}
                <div className="flex-1 w-full h-full">
                    <div className="flex h-full gap-4 w-full">
                        {/* Responsive Grid for Towers: Force 4 columns if possible, or flex */}
                        {[...Array(config.towers)].map((_, tIdx) => {
                            const towerNum = tIdx + 1;
                            return (
                                <div key={towerNum} className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col h-full min-w-0">
                                    {/* Tower Header */}
                                    <div className="flex justify-between items-center mb-4 shrink-0">
                                        <h3 className="text-xl font-bold text-slate-800">Torre {String.fromCharCode(65 + tIdx)}</h3>
                                        <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded">{config.floors} Pav</span>
                                    </div>

                                    {/* Matrix Grid - Building Fill */}
                                    <div className="flex-1 flex flex-col gap-[1px] overflow-hidden">
                                        {[...Array(config.floors)].map((_, fIdx) => {
                                            const floorNum = config.floors - fIdx;
                                            return (
                                                <div key={floorNum} className="flex-1 flex gap-2 items-center">
                                                    {/* Floor Number */}
                                                    <div className="w-4 text-[10px] font-bold text-slate-300 text-right shrink-0">{floorNum}</div>

                                                    {/* Apartments Row - Full flex grow/shrink */}
                                                    <div className="flex-1 grid gap-[1px] h-full" style={{ gridTemplateColumns: `repeat(${config.aptsPerFloor}, 1fr)` }}>
                                                        {[...Array(config.aptsPerFloor)].map((_, aIdx) => {
                                                            const aptNum = aIdx + 1;
                                                            const unitId = `T${towerNum}-F${floorNum}-A${aptNum}`;
                                                            const st = status[unitId]?.[selectedServiceId];
                                                            const style = getStatusStyle(st, selectedService?.color || '#3b82f6');

                                                            return (
                                                                <div
                                                                    key={unitId}
                                                                    onClick={() => toggleStatus(unitId, selectedServiceId)}
                                                                    className="w-full h-full rounded-[1px] cursor-pointer hover:brightness-95 transition-colors"
                                                                    style={style}
                                                                    title={`T${towerNum} F${floorNum} A${aptNum}: ${st || 'Pendente'}`}
                                                                ></div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Legend Bottom */}
                                    <div className="mt-4 pt-2 border-t border-slate-100 flex justify-between text-[10px] text-slate-400 shrink-0">
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-200"></div> A Iniciar</div>
                                        {/* Dynamic Legend based on screenshot logic */}
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedService?.color }}></div> Andamento</div>
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Concluído</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Right Sidebar - Pipeline */}
            <div className="w-[340px] bg-white border-l border-slate-200 flex flex-col shadow-xl z-20 shrink-0">
                <div className="p-5 border-b border-slate-100 pb-0">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 text-base">
                        <TrendingUp size={18} className="text-slate-600" />
                        Pipeline de Produção
                    </h3>

                    <div className="flex text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <button onClick={() => setPipelineTab('backlog')} className={`flex-1 py-2 border-b-2 hover:bg-slate-50 transition-colors ${pipelineTab === 'backlog' ? 'border-yellow-400 text-slate-800' : 'border-transparent'}`}>BACKLOG</button>
                        <button onClick={() => setPipelineTab('execution')} className={`flex-1 py-2 border-b-2 hover:bg-slate-50 transition-colors ${pipelineTab === 'execution' ? 'border-yellow-400 text-slate-800' : 'border-transparent'}`}>EXECUÇÃO</button>
                        <button onClick={() => setPipelineTab('done')} className={`flex-1 py-2 border-b-2 hover:bg-slate-50 transition-colors ${pipelineTab === 'done' ? 'border-yellow-400 text-slate-800' : 'border-transparent'}`}>CONCLUÍDO</button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-5 space-y-4 bg-slate-50/50">
                    {pipelineTab === 'execution' && (
                        <>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Frentes Ativas ({pipelineData.execution.length})</div>

                            {pipelineData.execution.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 text-sm">Nenhuma atividade em andamento.</div>
                            ) : (
                                pipelineData.execution.map((item: any) => (
                                    <div key={`${item.unitId}-${item.service.id}`} className="bg-white p-4 rounded-xl border border-slate-100 shadow-[0_2px_4px_rgba(0,0,0,0.02)] relative group hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="text-xs font-bold text-slate-800 mb-0.5">{item.service.name} Torre {String.fromCharCode(64 + item.tower)} - {item.floor}º Pav</div>
                                                <div className="text-[10px] text-slate-500">Apto {item.apt}</div>
                                            </div>
                                            <Hammer size={14} className="text-slate-300" />
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => toggleStatus(item.unitId, item.service.id)}
                                                className="flex-1 py-1.5 rounded-lg bg-green-50 text-green-700 text-[10px] font-bold border border-green-100 hover:bg-green-100 flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <CheckCircle size={10} /> Concluir
                                            </button>
                                            <button
                                                onClick={() => toggleStatus(item.unitId, item.service.id)}
                                                className="flex-1 py-1.5 rounded-lg bg-red-50 text-red-700 text-[10px] font-bold border border-red-100 hover:bg-red-100 flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <XCircle size={10} /> Parar
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    const PrintView = () => (
        <div className="print-section hidden">
            <style>{`
                @media print {
                    @page { size: landscape; margin: 5mm; }
                    body * { visibility: hidden; }
                    .print-section, .print-section * { visibility: visible; }
                    .print-section { position: absolute; left: 0; top: 0; width: 100%; }
                    .no-print { display: none !important; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>
            <div className="p-4 bg-white min-h-screen">
                <div className="flex justify-between items-center mb-6 border-b-2 border-black pb-2">
                    <h1 className="text-2xl font-bold uppercase">Mapa de Produção - {selectedService?.name || 'Geral'}</h1>
                    <div className="text-sm font-mono">Data: {new Date().toLocaleDateString()}</div>
                </div>

                <div className="flex flex-wrap gap-4 justify-center">
                    {[...Array(config.towers)].map((_, tIdx) => (
                        <div key={tIdx} className="border border-black p-2 bg-white break-inside-avoid">
                            <h2 className="text-center font-bold border-b border-black mb-2">Torre {String.fromCharCode(65 + tIdx)}</h2>
                            <div className="flex flex-col gap-1">
                                {[...Array(config.floors)].map((_, fIdx) => {
                                    const floor = config.floors - fIdx;
                                    return (
                                        <div key={floor} className="flex gap-1 h-4">
                                            <div className="w-4 text-[8px] font-bold text-right pr-1">{floor}</div>
                                            {[...Array(config.aptsPerFloor)].map((_, aIdx) => {
                                                const unitId = `T${tIdx + 1}-F${floor}-A${aIdx + 1}`;
                                                const st = status[unitId]?.[selectedServiceId];
                                                const isDone = st === 'completed';
                                                const isStarted = st === 'started';
                                                return (
                                                    <div key={aIdx} className="w-6 h-4 border border-black/30 flex items-center justify-center text-[8px]"
                                                        style={{ backgroundColor: isDone ? '#10b981' : (isStarted ? selectedService?.color : '#e2e8f0') }}
                                                    >
                                                        {isDone ? '●' : (isStarted ? '/' : '')}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-50 relative">
            <PrintView />

            {/* Header Area */}
            <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center shadow-sm shrink-0">
                <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-slate-800">Painel de Produção Dinâmico</h2>
                    <p className="text-xs text-slate-500">Gestão Visual das {config.towers} Torres e Controle de Gargalos</p>
                </div>

                {/* Service Filters */}
                <div className="flex gap-2">
                    {services.map(s => (
                        <button
                            key={s.id}
                            onClick={() => setSelectedServiceId(s.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedServiceId === s.id
                                    ? 'bg-slate-800 text-white border-slate-800 shadow-sm transform scale-105'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            {s.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Utility Bar */}
            <div className="bg-white px-6 py-2 border-b border-slate-100 flex justify-end gap-2 shrink-0">
                <button onClick={() => setViewMode('config')} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                    <Settings size={12} /> Configurar
                </button>
                <button onClick={() => setViewMode('services')} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                    <Settings size={12} /> Serviços
                </button>
                <button onClick={() => window.print()} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                    <Printer size={12} /> Imprimir
                </button>
                <button onClick={handleSave} disabled={isSaving} className="text-xs font-bold text-green-600 hover:text-green-700 flex items-center gap-1 bg-green-50 border border-green-100 px-2 py-1 rounded">
                    <Save size={12} /> {isSaving ? '...' : 'Salvar'}
                </button>
            </div>

            {/* Config Mode Overlay */}
            {viewMode === 'config' && (
                <div className="absolute inset-0 bg-white/90 z-[50] flex items-center justify-center p-10">
                    <div className="bg-white p-8 rounded-xl shadow-2xl border border-slate-200 max-w-md w-full relative">
                        <button onClick={() => setViewMode('matrix')} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 font-bold">X</button>
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">Configuração da Obra</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Número de Torres</label>
                                <input type="number" value={config.towers} onChange={e => setConfig({ ...config, towers: parseInt(e.target.value) || 1 })} className="w-full p-2 border rounded" min="1" max="10" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Pavimentos</label>
                                <input type="number" value={config.floors} onChange={e => setConfig({ ...config, floors: parseInt(e.target.value) || 1 })} className="w-full p-2 border rounded" min="1" max="100" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Aptos por Andar</label>
                                <input type="number" value={config.aptsPerFloor} onChange={e => setConfig({ ...config, aptsPerFloor: parseInt(e.target.value) || 1 })} className="w-full p-2 border rounded" min="1" max="30" />
                            </div>
                            <button onClick={() => setViewMode('matrix')} className="w-full py-3 bg-blue-600 text-white font-bold rounded mt-4">Aplicar Configuração</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Services Mode Overlay */}
            {viewMode === 'services' && (
                <div className="absolute inset-0 bg-white/90 z-[50] flex items-center justify-center p-10">
                    <div className="bg-white p-8 rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full relative h-3/4 flex flex-col">
                        <button onClick={() => setViewMode('matrix')} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 font-bold">X</button>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold flex items-center gap-2">Gerenciar Serviços</h3>
                            <div className="relative">
                                <input type="file" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".xlsx,.xls,.csv" />
                                <button className="text-blue-600 text-xs font-bold border border-blue-200 px-3 py-1 rounded hover:bg-blue-50">+ Importar</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto space-y-2 pr-2">
                            {services.map((svc, idx) => (
                                <div key={svc.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded bg-slate-50">
                                    <input type="color" value={svc.color} onChange={e => {
                                        const ns = [...services];
                                        ns[idx].color = e.target.value;
                                        setServices(ns);
                                    }} className="w-6 h-6 rounded cursor-pointer border-0" />
                                    <input value={svc.name} onChange={e => {
                                        const ns = [...services];
                                        ns[idx].name = e.target.value;
                                        setServices(ns);
                                    }} className="flex-1 bg-transparent font-medium text-sm outline-none" />
                                    <button onClick={() => setServices(services.filter(s => s.id !== svc.id))}><Trash2 size={14} className="text-red-400" /></button>
                                </div>
                            ))}
                            <button onClick={() => setServices([...services, { id: `S${Date.now()}`, name: 'Novo', color: '#000000', order: services.length + 1 }])} className="w-full py-2 border border-dashed border-slate-300 text-slate-500 font-bold text-xs rounded">+ Adicionar</button>
                        </div>
                        <button onClick={() => setViewMode('matrix')} className="w-full py-3 bg-blue-600 text-white font-bold rounded mt-4">Salvar Alterações</button>
                    </div>
                </div>
            )}

            {/* Main Content Render */}
            {viewMode === 'matrix' && <MatrixView />}

        </div>
    );
};
