import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Settings, TrendingUp, Printer, Trash2, ArrowUp, ArrowDown, Save, CheckCircle, Play, Pause, Monitor, StopCircle } from 'lucide-react';
import { AppData, ProductionConfig, ServiceDefinition, ProductionStatus } from '../../types';
import { ApiService } from '../services/api';
import { ExcelService } from '../services/excelService';
// Removed direct db import to rely on ApiService which now handles Supabase sync

const DEFAULT_SERVICES: ServiceDefinition[] = [];

export const VisualManagementView = ({ appData, onUpdate }: { appData: AppData, onUpdate?: (data: Partial<AppData>) => void }) => {
    // --- State ---
    const [config, setConfig] = useState<ProductionConfig>(appData.visualManagement?.config || { towers: 4, floors: 12, aptsPerFloor: 8 });
    const [services, setServices] = useState<ServiceDefinition[]>(appData.visualManagement?.services || []);
    const [status, setStatus] = useState<ProductionStatus>(appData.visualManagement?.status || {});

    const [foundationData, setFoundationData] = useState<Record<string, { total: number, realized: number }>>(appData.visualManagement?.foundationData || {});
    const [progressData, setProgressData] = useState<Record<string, Record<string, number>>>(appData.visualManagement?.unitProgress || {});
    const [isPresentationMode, setIsPresentationMode] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [towerNames, setTowerNames] = useState<string[]>(appData.visualManagement?.towerNames || [...Array(config.towers)].map((_, i) => String.fromCharCode(65 + i)));
    const [legendColors, setLegendColors] = useState(appData.visualManagement?.legendColors || { pending: '#e2e8f0', started: '#3b82f6', completed: '#10b981' });
    const [serviceStatus, setServiceStatus] = useState<Record<string, 'pending' | 'executing' | 'completed'>>(appData.visualManagement?.serviceStatus || {});

    // Ensure data is fresh on mount (fetched from Supabase via API)
    useEffect(() => {
        const projectId = appData.activeProjectId;
        if (!projectId) return;

        // --- RESET LOCAL STATES ON PROJECT SWITCH ---
        const defaultConfig = { towers: 4, floors: 12, aptsPerFloor: 8 };
        setConfig(defaultConfig);
        setServices([]);
        setStatus({});
        setFoundationData({});
        setProgressData({});
        setTowerNames([...Array(defaultConfig.towers)].map((_, i) => String.fromCharCode(65 + i)));
        setServiceStatus({});
        setSelectedServiceId('');

        ApiService.getVisualManagementData(projectId).then(data => {
            if (data) {
                console.log("VisualManagementView: Loaded fresh data from Supabase", data);
                if (data.config) {
                    setConfig(data.config);
                    // Update tower names if they were empty or mismatch
                    if (!data.towerNames && data.config.towers) {
                        setTowerNames([...Array(data.config.towers)].map((_, i) => String.fromCharCode(65 + i)));
                    }
                }
                if (data.services) {
                    setServices(data.services);
                    if (data.services.length > 0) setSelectedServiceId(data.services[0].id);
                }
                if (data.status) setStatus(data.status);
                if (data.foundationData) setFoundationData(data.foundationData);
                if (data.unitProgress) setProgressData(data.unitProgress);
                if (data.towerNames) setTowerNames(data.towerNames);
                if (data.legendColors) setLegendColors(data.legendColors);
                if (data.serviceStatus) setServiceStatus(data.serviceStatus);
            }
        });
    }, [appData.activeProjectId]);

    // Layout State
    const [viewMode, setViewMode] = useState<'matrix' | 'config' | 'services' | 'towernames' | 'legend'>('matrix');
    const [selectedServiceId, setSelectedServiceId] = useState<string>(services[1]?.id || services[0]?.id);
    const [isSaving, setIsSaving] = useState(false);
    const [pipelineTab, setPipelineTab] = useState<'pending' | 'executing' | 'completed'>('executing');

    const selectedService = useMemo(() => services.find(s => s.id === selectedServiceId) || services[0], [services, selectedServiceId]);

    const serviceCounts = useMemo(() => ({
        pending: services.filter(s => (serviceStatus[s.id] || 'pending') === 'pending').length,
        executing: services.filter(s => (serviceStatus[s.id] || 'pending') === 'executing').length,
        completed: services.filter(s => (serviceStatus[s.id] || 'pending') === 'completed').length,
    }), [services, serviceStatus]);

    // --- Presentation Mode Logic ---
    useEffect(() => {
        let interval: any;
        if (isPresentationMode && isPlaying) {
            interval = setInterval(() => {
                setSelectedServiceId(prev => {
                    const idx = services.findIndex(s => s.id === prev);
                    const nextIdx = (idx + 1) % services.length;
                    return services[nextIdx].id;
                });
            }, 5000); // 5 seconds per service
        }
        return () => clearInterval(interval);
    }, [isPresentationMode, isPlaying, services]);

    // --- Actions ---

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        const newData = {
            ...appData,
            visualManagement: { config, services, status, foundationData, unitProgress: progressData, towerNames, legendColors, serviceStatus }
        };
        await ApiService.saveAppData(newData);
        if (onUpdate) {
            onUpdate(newData);
        }
        setIsSaving(false);
        alert('Dados salvos com sucesso!');
    }, [appData, config, services, status, foundationData, progressData, towerNames, legendColors, serviceStatus, onUpdate]);

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    }, []);

    const updateProgress = useCallback((unitId: string, serviceId: string, percent: number) => {
        setProgressData(prev => ({
            ...prev,
            [unitId]: {
                ...prev[unitId],
                [serviceId]: percent
            }
        }));
    }, []);

    const updateFoundation = useCallback((towerIdx: number, field: 'total' | 'realized', val: string) => {
        const numVal = val === '' ? 0 : parseInt(val, 10) || 0;
        setFoundationData(prev => ({
            ...prev,
            [towerIdx]: {
                ...prev[towerIdx] || { total: 0, realized: 0 },
                [field]: numVal
            }
        }));
    }, []);

    const toggleStatus = useCallback((unitId: string, serviceId: string) => {
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
    }, []);

    const getStatusStyle = useCallback((st: string | undefined, serviceColor: string) => {
        if (st === 'completed') return { backgroundColor: legendColors.completed, borderColor: 'transparent' };
        if (st === 'started') return { backgroundColor: serviceColor, borderColor: 'transparent' };
        return { backgroundColor: legendColors.pending, borderColor: '#cbd5e1' };
    }, [legendColors.completed, legendColors.pending]);

    const moveService = useCallback((serviceId: string, newStatus: 'pending' | 'executing' | 'completed') => {
        setServiceStatus(prev => ({ ...prev, [serviceId]: newStatus }));
    }, []);

    const reorderService = useCallback((serviceId: string, direction: 'up' | 'down') => {
        setServices(prev => {
            const idx = prev.findIndex(s => s.id === serviceId);
            if (idx === -1) return prev;
            if (direction === 'up' && idx === 0) return prev;
            if (direction === 'down' && idx === prev.length - 1) return prev;

            const newServices = [...prev];
            const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
            [newServices[idx], newServices[targetIdx]] = [newServices[targetIdx], newServices[idx]];

            newServices.forEach((svc, i) => {
                svc.order = i + 1;
            });
            return newServices;
        });
    }, []);

    const getServiceCompletion = useCallback((serviceId: string) => {
        const totalUnits = config.towers * config.floors * config.aptsPerFloor;
        if (totalUnits === 0) return 0;
        let completed = 0;
        for (let t = 1; t <= config.towers; t++) {
            for (let f = 1; f <= config.floors; f++) {
                for (let a = 1; a <= config.aptsPerFloor; a++) {
                    const unitId = `T${t}-F${f}-A${a}`;
                    const st = status[unitId]?.[serviceId];
                    if (st === 'completed') completed++;
                }
            }
        }
        return Math.round((completed / totalUnits) * 100);
    }, [config, status]);

    const getTowerServiceCompletion = useCallback((towerIdx: number, serviceId: string) => {
        const totalUnits = config.floors * config.aptsPerFloor;
        if (totalUnits === 0) return 0;
        let completed = 0;
        const towerNum = towerIdx + 1;

        for (let f = 1; f <= config.floors; f++) {
            for (let a = 1; a <= config.aptsPerFloor; a++) {
                const unitId = `T${towerNum}-F${f}-A${a}`;
                const st = status[unitId]?.[serviceId];
                if (st === 'completed') completed++;
            }
        }
        return Math.round((completed / totalUnits) * 100);
    }, [config.floors, config.aptsPerFloor, status]);

    return (
        <div className="h-full flex flex-col bg-slate-50 relative">
            <PrintView selectedService={selectedService} config={config} status={status} selectedServiceId={selectedServiceId} />

            {/* Header Area */}
            {isPresentationMode ? (
                <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md z-50">
                    <div className="flex items-center gap-4">
                        <Monitor size={24} className="text-blue-400 animate-pulse" />
                        <div>
                            <h2 className="text-xl font-bold uppercase tracking-widest">Modo Apresentação - TV</h2>
                            <p className="text-xs text-slate-400">Exibindo: <span className="text-yellow-400 font-bold">{selectedService?.name}</span></p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setIsPlaying(!isPlaying)} className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold uppercase text-xs transition-colors ${isPlaying ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-green-600 hover:bg-green-500'}`}>
                            {isPlaying ? <Pause size={14} /> : <Play size={14} />} {isPlaying ? 'Pausar Rotação' : 'Continuar'}
                        </button>
                        <button onClick={() => { setIsPresentationMode(false); setIsPlaying(false); }} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-full font-bold uppercase text-xs">
                            <StopCircle size={14} /> Sair
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center shadow-sm shrink-0">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-bold text-slate-800">Painel de Produção Dinâmico</h2>
                        <p className="text-xs text-slate-500">Gestão Visual das {config.towers} Torres e Controle de Gargalos</p>
                    </div>

                    <div className="flex gap-2">
                        {services.filter(s => s.name !== 'Fundação' && (serviceStatus[s.id] || 'pending') === 'executing').sort((a, b) => a.order - b.order).map(s => {
                            const percent = getServiceCompletion(s.id);
                            const isDone = percent === 100;
                            const isSelected = selectedServiceId === s.id;

                            return (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedServiceId(s.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex flex-col items-center min-w-[80px] ${isSelected
                                        ? 'bg-slate-800 text-white border-slate-800 shadow-sm transform scale-105'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <span>{s.name}</span>
                                    {isDone ? (
                                        <span className={`text-[10px] flex items-center gap-1 ${isSelected ? 'text-green-400' : 'text-green-500'}`}><CheckCircle size={10} /> 100%</span>
                                    ) : (
                                        <div className="w-full bg-slate-100 h-1 mt-1 rounded-full overflow-hidden">
                                            <div className={`h-full ${isSelected ? 'bg-blue-400' : 'bg-blue-500'}`} style={{ width: `${percent}%` }}></div>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {!isPresentationMode && (
                <div className="bg-white px-6 py-2 border-b border-slate-100 flex justify-end gap-2 shrink-0">
                    <button onClick={() => setViewMode('config')} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                        <Settings size={12} /> Configurar
                    </button>
                    <button onClick={() => setViewMode('services')} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                        <Settings size={12} /> Serviços
                    </button>
                    <button onClick={() => setViewMode('towernames')} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                        <Settings size={12} /> Nomes Torres
                    </button>
                    <button onClick={() => setViewMode('legend')} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                        <Settings size={12} /> Cores Legenda
                    </button>
                    <button onClick={() => window.print()} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                        <Printer size={12} /> Imprimir
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="text-xs font-bold text-green-600 hover:text-green-700 flex items-center gap-1 bg-green-50 border border-green-100 px-2 py-1 rounded">
                        <Save size={12} /> {isSaving ? '...' : 'Salvar'}
                    </button>
                    <button
                        onClick={() => {
                            if (window.confirm('⚠️ ATENÇÃO: Isso vai limpar TODOS os dados do sistema e carregar a configuração padrão (4 torres, 12 andares, 8 apts/andar). Deseja continuar?')) {
                                indexedDB.deleteDatabase('ConstructionDB').onsuccess = () => {
                                    alert('✅ Dados limpos! A página será recarregada...');
                                    window.location.reload();
                                };
                            }
                        }}
                        className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-red-50 border border-red-100 px-2 py-1 rounded"
                    >
                        <Trash2 size={12} /> Resetar Dados
                    </button>
                    <div className="w-[1px] h-4 bg-slate-300 mx-2"></div>
                    <button onClick={() => { setIsPresentationMode(true); setIsPlaying(true); }} className="text-xs font-bold text-white hover:bg-slate-700 flex items-center gap-1 bg-slate-800 px-3 py-1 rounded shadow-sm animate-pulse">
                        <Play size={12} /> Modo Apresentação (TV)
                    </button>
                </div>
            )}

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
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                Gerenciar Serviços
                                <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full ml-2">Total: {services.length}</span>
                            </h3>
                            <div className="flex items-center gap-2">
                                {services.length > 0 && (
                                    <>
                                        <button
                                            onClick={() => {
                                                const randomColor = () => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
                                                setServices(services.map(s => ({ ...s, color: randomColor() })));
                                            }}
                                            className="text-purple-600 text-xs font-bold border border-purple-200 px-3 py-1 rounded hover:bg-purple-50"
                                        >
                                            🎨 Cores
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (window.confirm(' Tem certeza que deseja EXCLUIR TODOS os serviços? \nIsso não pode ser desfeito e limpará todo o progresso vinculado.')) {
                                                    setServices([]);
                                                }
                                            }}
                                            className="text-red-500 text-xs font-bold border border-red-200 px-3 py-1 rounded hover:bg-red-50 flex items-center gap-1"
                                        >
                                            <Trash2 size={12} /> Excluir Todos
                                        </button>
                                    </>
                                )}
                                <div className="relative">
                                    <input type="file" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".xlsx,.xls,.csv" />
                                    <button className="text-blue-600 text-xs font-bold border border-blue-200 px-3 py-1 rounded hover:bg-blue-50">+ Importar</button>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto space-y-2 pr-2">
                            {services.map((svc, idx) => (
                                <div key={svc.id} className="flex flex-col gap-2 p-3 border border-slate-100 rounded bg-slate-50">
                                    <div className="flex items-center gap-3">
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
                                    <div className="flex items-center gap-2 pl-9">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Vincular Orçado (G.O):</label>
                                        <select
                                            className="flex-1 text-[11px] p-1 border rounded bg-white"
                                            value={svc.budgetCode || ''}
                                            onChange={(e) => {
                                                const ns = [...services];
                                                ns[idx].budgetCode = e.target.value;
                                                setServices(ns);
                                            }}
                                        >
                                            <option value="">Não vinculado</option>
                                            {appData.budget?.filter(b => b.isGroup).map(b => (
                                                <option key={b.code} value={b.code}>{b.code} - {b.desc}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => setServices([...services, { id: `S${Date.now()}`, name: 'Novo', color: '#000000', order: services.length + 1 }])} className="w-full py-2 border border-dashed border-slate-300 text-slate-500 font-bold text-xs rounded">+ Adicionar</button>
                        </div>
                        <button onClick={async () => { await handleSave(); setViewMode('matrix'); }} className="w-full py-3 bg-blue-600 text-white font-bold rounded mt-4" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</button>
                    </div>
                </div>
            )}

            {/* Tower Names Mode Overlay */}
            {viewMode === 'towernames' && (
                <div className="absolute inset-0 bg-white/90 z-[50] flex items-center justify-center p-10">
                    <div className="bg-white p-8 rounded-xl shadow-2xl border border-slate-200 max-w-md w-full relative">
                        <button onClick={() => setViewMode('matrix')} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 font-bold">X</button>
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">Personalizar Nomes das Torres</h3>
                        <div className="space-y-3">
                            {[...Array(config.towers)].map((_, idx) => (
                                <div key={idx}>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Torre {idx + 1}</label>
                                    <input
                                        type="text"
                                        value={towerNames[idx] || ''}
                                        onChange={e => {
                                            const newNames = [...towerNames];
                                            newNames[idx] = e.target.value.toUpperCase();
                                            setTowerNames(newNames);
                                        }}
                                        placeholder={String.fromCharCode(65 + idx)}
                                        className="w-full p-2 border rounded uppercase font-bold"
                                        maxLength={15}
                                    />
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setViewMode('matrix')} className="w-full py-3 bg-blue-600 text-white font-bold rounded mt-6">Aplicar</button>
                    </div>
                </div>
            )}

            {/* Legend Colors Mode Overlay */}
            {viewMode === 'legend' && (
                <div className="absolute inset-0 bg-white/90 z-[50] flex items-center justify-center p-10">
                    <div className="bg-white p-8 rounded-xl shadow-2xl border border-slate-200 max-w-md w-full relative">
                        <button onClick={() => setViewMode('matrix')} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 font-bold">X</button>
                        <h3 className="text-lg font-bold mb-6">Personalizar Cores da Legenda</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">Cor: A Iniciar (Pendente)</label>
                                <div className="flex gap-3 items-center">
                                    <input
                                        type="color"
                                        value={legendColors.pending}
                                        onChange={e => setLegendColors({ ...legendColors, pending: e.target.value })}
                                        className="w-16 h-10 rounded cursor-pointer border"
                                    />
                                    <div className="flex-1 text-sm text-slate-600">Unidades que ainda não iniciaram o serviço</div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">Cor: Concluído</label>
                                <div className="flex gap-3 items-center">
                                    <input
                                        type="color"
                                        value={legendColors.completed}
                                        onChange={e => setLegendColors({ ...legendColors, completed: e.target.value })}
                                        className="w-16 h-10 rounded cursor-pointer border"
                                    />
                                    <div className="flex-1 text-sm text-slate-600">Unidades com serviço 100% finalizado</div>
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded border border-slate-200">
                                <div className="text-xs text-slate-500 mb-2"><strong>Nota:</strong> A cor "Andamento" usa a cor de cada serviço individual (configurável em Gerenciar Serviços).</div>
                            </div>
                        </div>
                        <button onClick={() => setViewMode('matrix')} className="w-full py-3 bg-blue-600 text-white font-bold rounded mt-6">Aplicar</button>
                    </div>
                </div>
            )}

            {/* Main Content Render */}
            {viewMode === 'matrix' && (
                <div className="flex h-full bg-slate-50 overflow-hidden">
                    <div className="flex-1 flex flex-col overflow-hidden p-6 pb-2">
                        <div className="flex-1 w-full h-full">
                            <div className="flex h-full gap-4 w-full">
                                {[...Array(config.towers)].map((_, tIdx) => {
                                    const towerNum = tIdx + 1;
                                    return (
                                        <TowerCard
                                            key={towerNum}
                                            tIdx={tIdx}
                                            towerNum={towerNum}
                                            config={config}
                                            towerNames={towerNames}
                                            selectedServiceId={selectedServiceId}
                                            selectedService={selectedService}
                                            getTowerServiceCompletion={getTowerServiceCompletion}
                                            status={status}
                                            toggleStatus={toggleStatus}
                                            getStatusStyle={getStatusStyle}
                                            foundationData={foundationData}
                                            updateFoundation={updateFoundation}
                                            isPresentationMode={isPresentationMode}
                                            legendColors={legendColors}
                                            setViewMode={setViewMode}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {!isPresentationMode && (
                        <div className="w-[340px] bg-white border-l border-slate-200 flex flex-col shadow-xl z-20 shrink-0">
                            <div className="p-5 border-b border-slate-100 pb-0">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 text-base">
                                    <TrendingUp size={18} className="text-slate-600" />
                                    Pipeline de Produção
                                </h3>
                                <div className="flex text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    <button onClick={() => setPipelineTab('pending')} className={`flex-1 py-2 border-b-2 hover:bg-slate-50 transition-colors ${pipelineTab === 'pending' ? 'border-yellow-400 text-slate-800' : 'border-transparent'}`}>
                                        A INICIAR <span className="ml-1 opacity-60">({serviceCounts.pending})</span>
                                    </button>
                                    <button onClick={() => setPipelineTab('executing')} className={`flex-1 py-2 border-b-2 hover:bg-slate-50 transition-colors ${pipelineTab === 'executing' ? 'border-yellow-400 text-slate-800' : 'border-transparent'}`}>
                                        EM EXECUÇÃO <span className="ml-1 opacity-60">({serviceCounts.executing})</span>
                                    </button>
                                    <button onClick={() => setPipelineTab('completed')} className={`flex-1 py-2 border-b-2 hover:bg-slate-50 transition-colors ${pipelineTab === 'completed' ? 'border-yellow-400 text-slate-800' : 'border-transparent'}`}>
                                        CONCLUÍDO <span className="ml-1 opacity-60">({serviceCounts.completed})</span>
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto p-5 space-y-3 bg-slate-50/50">
                                {pipelineTab === 'executing' && services.filter(s => (serviceStatus[s.id] || 'pending') === 'executing').map((svc, idx, arr) => (
                                    <div key={svc.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: svc.color }}></div>
                                                <div className="font-bold text-sm text-slate-800">{svc.name}</div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => reorderService(svc.id, 'up')} disabled={idx === 0} className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"><ArrowUp size={12} /></button>
                                                <button onClick={() => reorderService(svc.id, 'down')} disabled={idx === arr.length - 1} className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"><ArrowDown size={12} /></button>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => moveService(svc.id, 'pending')} className="flex-1 py-1.5 rounded-lg bg-slate-50 text-[10px] font-bold border hover:bg-slate-100">← Parar</button>
                                            <button onClick={() => moveService(svc.id, 'completed')} className="flex-1 py-1.5 rounded-lg bg-green-50 text-green-700 text-[10px] font-bold border border-green-200 hover:bg-green-100">Concluir →</button>
                                        </div>
                                    </div>
                                ))}
                                {pipelineTab === 'pending' && services.filter(s => (serviceStatus[s.id] || 'pending') === 'pending').map(svc => (
                                    <div key={svc.id} className="bg-white p-3 rounded-lg border flex items-center justify-between">
                                        <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: svc.color }}></div><div className="text-sm font-medium">{svc.name}</div></div>
                                        <button onClick={() => moveService(svc.id, 'executing')} className="px-3 py-1 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border">Iniciar →</button>
                                    </div>
                                ))}
                                {pipelineTab === 'completed' && services.filter(s => (serviceStatus[s.id] || 'pending') === 'completed').map(svc => (
                                    <div key={svc.id} className="bg-white p-3 rounded-lg border border-green-100 bg-green-50/30 flex items-center justify-between">
                                        <div className="flex items-center gap-3"><CheckCircle size={14} className="text-green-600" /><div className="text-sm font-medium">{svc.name}</div></div>
                                        <button onClick={() => moveService(svc.id, 'executing')} className="px-3 py-1 rounded text-[10px] font-bold bg-slate-50 border">← Reabrir</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

interface TowerCardProps {
    tIdx: number;
    towerNum: number;
    config: ProductionConfig;
    towerNames: string[];
    selectedServiceId: string;
    selectedService: ServiceDefinition;
    getTowerServiceCompletion: (tIdx: number, svcId: string) => number;
    status: ProductionStatus;
    toggleStatus: (unitId: string, svcId: string) => void;
    getStatusStyle: (st: string | undefined, color: string) => any;
    foundationData: Record<string, { total: number, realized: number }>;
    updateFoundation: (tIdx: number, field: 'total' | 'realized', val: string) => void;
    isPresentationMode: boolean;
    legendColors: { pending: string, completed: string };
    setViewMode: (mode: any) => void;
}

const TowerCard = React.memo(({
    tIdx,
    towerNum,
    config,
    towerNames,
    selectedServiceId,
    selectedService,
    getTowerServiceCompletion,
    status,
    toggleStatus,
    getStatusStyle,
    foundationData,
    updateFoundation,
    isPresentationMode,
    legendColors,
    setViewMode
}: TowerCardProps) => (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col h-full min-w-0">
        <div className="flex justify-between items-center mb-4 shrink-0">
            <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-slate-800">Torre {towerNames[tIdx] || String.fromCharCode(65 + tIdx)}</h3>
                {(() => {
                    const towerPercent = getTowerServiceCompletion(tIdx, selectedServiceId);
                    const isDone = towerPercent === 100;
                    return (
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${isDone ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {isDone && <CheckCircle size={10} />}
                            {towerPercent}%
                        </div>
                    );
                })()}
            </div>
            <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded">{config.floors} Pav</span>
        </div>

        <div className="flex-1 flex flex-col gap-[1px] overflow-hidden">
            {[...Array(config.floors)].map((_, fIdx) => {
                const floorNum = config.floors - fIdx;
                return (
                    <div key={floorNum} className="flex-1 flex gap-2 items-center">
                        <div className="w-4 text-[10px] font-bold text-slate-300 text-right shrink-0">{floorNum}</div>
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
                );
            })}
        </div>

        <div className="mt-auto pt-3 border-t border-slate-100">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500 mb-1">
                <span>Fundação (Estacas)</span>
                <span>{Math.round(((foundationData[tIdx]?.realized || 0) / (foundationData[tIdx]?.total || 1)) * 100)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                <div
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, ((foundationData[tIdx]?.realized || 0) / (foundationData[tIdx]?.total || 1)) * 100)}%` }}
                ></div>
            </div>
            {!isPresentationMode && (
                <div className="flex gap-2 text-[10px]">
                    <div className="flex-1">
                        <label className="text-[8px] text-slate-400 block">Total</label>
                        <input
                            className="w-full border rounded px-1 py-0.5"
                            type="number"
                            value={foundationData[tIdx]?.total || ''}
                            placeholder="Qtd"
                            onChange={(e) => updateFoundation(tIdx, 'total', e.target.value)}
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-[8px] text-slate-400 block">Realizado</label>
                        <input
                            className="w-full border rounded px-1 py-0.5"
                            type="number"
                            value={foundationData[tIdx]?.realized || ''}
                            placeholder="Qtd"
                            onChange={(e) => updateFoundation(tIdx, 'realized', e.target.value)}
                        />
                    </div>
                </div>
            )}
        </div>

        <div
            className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-[10px] text-slate-400 shrink-0 cursor-pointer hover:bg-slate-50 rounded px-2 py-1 -mx-2 transition-colors"
            onClick={() => !isPresentationMode && setViewMode('legend')}
        >
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: legendColors.pending }}></div> A Iniciar</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedService?.color }}></div> Andamento</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: legendColors.completed }}></div> Concluído</div>
        </div>
    </div>
));

const PrintView = ({ selectedService, config, status, selectedServiceId }: any) => (
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
                                            return (
                                                <div key={aIdx} className="w-6 h-4 border border-black/30 flex items-center justify-center"
                                                    style={{ backgroundColor: st === 'completed' ? '#10b981' : (st === 'started' ? selectedService?.color : '#e2e8f0') }}
                                                ></div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);
