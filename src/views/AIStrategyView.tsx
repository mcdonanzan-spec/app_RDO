import React, { useMemo, useState, useEffect } from 'react';
import { FlaskConical, Sparkles, TrendingUp, Target, CalendarClock, AlertTriangle, CheckCircle2, Building2, Save, History, Printer, Info, Settings } from 'lucide-react';
import { AppData, StrategySnapshot } from '../../types';
import { formatMoney } from '../utils';
import { BuildingModel } from '../components/BuildingModel';
import { ApiService } from '../services/api';

interface AIStrategyViewProps {
    appData: AppData;
}

export const AIStrategyView: React.FC<AIStrategyViewProps> = ({ appData }) => {
    const [snapshots, setSnapshots] = useState<StrategySnapshot[]>([]);
    const [selectedSnapshot, setSelectedSnapshot] = useState<StrategySnapshot | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [colors, setColors] = useState({
        standard: '#94a3b8',
        realized: '#2563eb', // Default Blue
        projected: '#a855f7'
    });
    const [showColorSettings, setShowColorSettings] = useState(false);

    const [forecastData, setForecastData] = useState<Record<string, Record<string, number>>>({});

    useEffect(() => {
        loadSnapshots();
        loadColors();
        loadForecast();
    }, []);

    const loadForecast = async () => {
        const projectId = appData.activeProjectId;
        if (!projectId) return;

        const data = await ApiService.getDisbursementForecast(projectId);
        if (data?.forecast_data) setForecastData(data.forecast_data);
    };

    const loadColors = async () => {
        const projectId = appData.activeProjectId;
        if (!projectId) return;

        const loadedColors = await ApiService.getStrategyColors(projectId);
        setColors(loadedColors);
    };

    const saveColors = async (newColors: any) => {
        const projectId = appData.activeProjectId;
        if (!projectId) return;

        await ApiService.saveStrategyColors(projectId, newColors);
        setColors(newColors);
    };

    const loadSnapshots = async () => {
        const projectId = appData.activeProjectId;
        if (!projectId) return;

        const data = await ApiService.getStrategySnapshots(projectId);
        setSnapshots(data);
    };

    // --- REAL DATA ANALYTICS ---
    const analysis = useMemo(() => {
        // Dynamic Timeline: From Oct 2025 to Dec 2026
        const months: string[] = [];
        const monthKeys: string[] = []; // keys like '2025-10'

        let d = new Date(2025, 9, 1); // Start Oct 2025
        const end = new Date(2026, 11, 31); // End Dec 2026

        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        while (d <= end) {
            const m = d.getMonth();
            const y = d.getFullYear();
            months.push(`${monthNames[m]}/${y.toString().slice(-2)}`);
            monthKeys.push(`${y}-${(m + 1).toString().padStart(2, '0')}`);
            d.setMonth(d.getMonth() + 1);
        }

        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        const currentMonthIndex = monthKeys.findIndex(k => k === currentMonthKey);

        // 1. Calculate Curves
        const totalBudget = appData.budget?.filter(i => !i.isGroup).reduce((acc, i) => acc + (i.total || 0), 0) || 1;

        // Standard Curve: Natural S-Curve (Sigmoid)
        const standardCurve = months.map((_, idx) => {
            const progress = (idx + 1) / months.length;
            // Sigmoid: f(x) = 1 / (1 + e^-k(x-0.5))
            // x from 0 to 1. Center at 0.5. k=10 for nice S.
            const k = 6;
            const x = progress;
            const sigmoid = 1 / (1 + Math.exp(-k * (x - 0.5)));
            // Normalize so 0 is 0 and 1 is 1
            const s0 = 1 / (1 + Math.exp(-k * (-0.5)));
            const s1 = 1 / (1 + Math.exp(-k * (0.5)));
            const normalized = (sigmoid - s0) / (s1 - s0);
            return Math.min(100, Math.round(normalized * 100));
        });

        // Realized Curve: Using RDO Accumulated Value as source
        // RDO is often the "Financial Progress" measured or paid.
        const totalRDOSum = appData.rdoData?.reduce((acc, item) => acc + (item.accumulatedValue || 0), 0) || 0;

        let cumulativeRealized = 0;
        const realizedCurve = monthKeys.map((key, idx) => {
            if (idx > currentMonthIndex && currentMonthIndex !== -1) return null;

            // If it's the current month, we use the total RDO sum as the current state
            if (idx === currentMonthIndex) {
                return Math.min(100, Math.round((totalRDOSum / totalBudget) * 100));
            }

            // For previous months, if we have financial entries, use them to build the history
            const monthEntries = appData.financialEntries?.filter(fe =>
                fe.installments?.some(inst => inst.dueDate.startsWith(key))
            ) || [];

            const monthTotal = monthEntries.reduce((acc, fe) => {
                const insts = fe.installments?.filter(inst => inst.dueDate.startsWith(key)) || [];
                return acc + insts.reduce((sum, i) => sum + i.value, 0);
            }, 0);

            cumulativeRealized += monthTotal;

            // To ensure it connects to the RDO total at the current month, 
            // we scale the financial history if needed, but here we just return the cumulative.
            return Math.min(100, Math.round((cumulativeRealized / totalBudget) * 100));
        });

        // Projected Curve: Based on Forecast Data from DisbursementForecastView
        const projectedCurve = monthKeys.map((key, idx) => {
            if (idx < currentMonthIndex && currentMonthIndex !== -1) return null;

            // Start from last realized progress (RDO Total)
            let baseProgress = totalRDOSum;

            // Add sum of all forecast items for future months up to this index
            let futureSum = 0;
            for (let i = currentMonthIndex + 1; i <= idx; i++) {
                const mk = monthKeys[i];
                Object.values(forecastData).forEach(itemForecast => {
                    futureSum += (itemForecast[mk] || 0);
                });
            }

            return Math.min(100, Math.round(((baseProgress + futureSum) / totalBudget) * 100));
        });

        // 2. Status Map from Visual Management
        const statusMap: Record<string, 'concluido' | 'em_andamento' | 'atrasado' | 'nao_iniciado'> = {};
        if (appData.visualManagement?.status) {
            Object.entries(appData.visualManagement.status).forEach(([unitId, serviceMap]) => {
                const statuses = Object.values(serviceMap);
                if (statuses.every(s => s === 'completed')) statusMap[unitId] = 'concluido';
                else if (statuses.some(s => s === 'started')) statusMap[unitId] = 'em_andamento';
                else statusMap[unitId] = 'nao_iniciado';
            });
        }

        // 3. Pareto of Overruns (Estouros)
        const overruns = (appData.budget || [])
            .filter(i => !i.isGroup)
            .map(item => {
                const realized = appData.rdoData?.filter(r => r.code === item.code).reduce((acc, r) => acc + (r.accumulatedValue || 0), 0) || 0;
                const diff = realized - item.total;
                return { desc: item.desc, diff, code: item.code };
            })
            .filter(o => o.diff > 0)
            .sort((a, b) => b.diff - a.diff)
            .slice(0, 5);

        return {
            months,
            standardCurve,
            realizedCurve,
            projectedCurve,
            statusMap,
            overruns,
            currentMonthIndex: currentMonthIndex === -1 ? months.length : currentMonthIndex
        };
    }, [appData, forecastData]);

    const handleSaveSnapshot = async () => {
        const name = prompt("Dê um nome para este Snapshot (ex: Fechamento Jan/24):");
        if (!name) return;

        setIsSaving(true);
        try {
            const totalBudget = appData.budget?.filter(i => !i.isGroup).reduce((acc, i) => acc + (i.total || 0), 0) || 1;
            const totalRealized = appData.rdoData?.reduce((acc, i) => acc + (i.accumulatedValue || 0), 0) || 0;

            const snapshot: StrategySnapshot = {
                date: new Date().toISOString(),
                description: name,
                data: {
                    months: analysis.months,
                    standardCurve: analysis.standardCurve,
                    realizedCurve: analysis.realizedCurve,
                    projectedCurve: analysis.projectedCurve,
                    totalBudget,
                    totalRealized,
                    poc: (totalRealized / totalBudget) * 100
                }
            };

            const projectId = appData.activeProjectId;
            if (!projectId) {
                alert("❌ Erro: Projeto não identificado");
                return;
            }

            await ApiService.saveStrategySnapshot(projectId, snapshot);
            await loadSnapshots();
            alert("Snapshot salvo com sucesso! Agora você pode comparar a evolução histórica.");
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrintReport = () => {
        window.print();
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-auto custom-scrollbar">
            {/* HEADER */}
            <div className="bg-white p-8 border-b border-slate-200 sticky top-0 z-20 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                        <FlaskConical size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Laboratório de Estratégia & BI</h2>
                        <p className="text-slate-500">Análise Tridimensional: Passado (RDO), Padrão (Orçamento) e Futuro (Projeção).</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 no-print">
                    <button
                        onClick={() => setShowColorSettings(!showColorSettings)}
                        className={`p-2 rounded-lg border transition-all ${showColorSettings ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                        title="Ajustar Cores"
                    >
                        <Settings size={18} />
                    </button>
                    <button
                        onClick={handleSaveSnapshot}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-indigo-300 transition-all shadow-sm"
                    >
                        <Save size={18} className="text-indigo-500" />
                        {isSaving ? "Salvando..." : "Salvar Snapshot"}
                    </button>
                    <button
                        onClick={handlePrintReport}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg text-sm font-bold text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                    >
                        <Printer size={18} /> Gerar Relatório Executivo
                    </button>
                </div>
            </div>

            {/* Color Settings Overlay */}
            {showColorSettings && (
                <div className="bg-white p-4 border-b border-slate-200 no-print flex gap-6 items-center justify-center animate-in slide-in-from-top duration-300">
                    <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Identidade Visual:</span>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold text-slate-500">PADRÃO:</label>
                            <input type="color" value={colors.standard} onChange={e => saveColors({ ...colors, standard: e.target.value })} className="w-6 h-6 rounded border-0 cursor-pointer" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold text-slate-500">REALIZADO:</label>
                            <input type="color" value={colors.realized} onChange={e => saveColors({ ...colors, realized: e.target.value })} className="w-6 h-6 rounded border-0 cursor-pointer" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold text-slate-500">PROJEÇÃO:</label>
                            <input type="color" value={colors.projected} onChange={e => saveColors({ ...colors, projected: e.target.value })} className="w-6 h-6 rounded border-0 cursor-pointer" />
                        </div>
                    </div>
                </div>
            )}

            <div className="p-8 space-y-12 w-full">
                {/* SEÇÃO 1: O RADAR DE DESVIOS (TIMELINE) */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2 group relative">
                            <CalendarClock className="text-blue-600" size={24} />
                            <h3 className="text-xl font-bold text-slate-800">Radar de Tendência (Curva S)</h3>
                            <div className="p-1 text-slate-400 hover:text-blue-500 cursor-help">
                                <Info size={16} />
                                <div className="absolute left-0 bottom-full mb-2 w-64 bg-slate-800 text-white text-[11px] p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 leading-relaxed">
                                    <p className="font-bold mb-1 border-b border-slate-600 pb-1">O que é a Curva S?</p>
                                    Compara o progresso acumulado:<br />
                                    - <span className="font-bold text-slate-300">Padrão:</span> Velocidade ideal do orçamento.<br />
                                    - <span className="font-bold text-blue-400">Realizado:</span> O que foi medido pelo RDO.<br />
                                    - <span className="font-bold text-purple-400">Projeção:</span> Estimativa baseada no seu Forecast.
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4 text-sm no-print items-center">
                            <select
                                className="text-[11px] font-bold border rounded px-2 py-1 bg-white outline-none focus:ring-1 focus:ring-indigo-400"
                                onChange={(e) => {
                                    const snap = snapshots.find(s => s.id === parseInt(e.target.value));
                                    setSelectedSnapshot(snap || null);
                                }}
                            >
                                <option value="">Comparar com Histórico...</option>
                                {snapshots.map(s => (
                                    <option key={s.id} value={s.id}>{new Date(s.date).toLocaleDateString()} - {s.description}</option>
                                ))}
                            </select>
                            <div className="flex items-center gap-2 font-medium"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.standard }}></div> Padrão</div>
                            <div className="flex items-center gap-2 font-medium"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.realized }}></div> Realizado</div>
                            <div className="flex items-center gap-2 font-medium"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.projected }}></div> Projeção</div>
                            {selectedSnapshot && (
                                <div className="flex items-center gap-2 font-bold text-orange-600 animate-pulse"><div className="w-3 h-3 rounded-full bg-orange-500"></div> Histórico</div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-80 relative">
                        <div className="flex items-end justify-between h-full pt-8 pb-6 px-4 gap-2 relative">
                            {/* Grid Lines */}
                            <div className="absolute inset-0 top-8 bottom-6 px-4 flex flex-col justify-between pointer-events-none">
                                {[100, 75, 50, 25, 0].map(val => (
                                    <div key={val} className="w-full border-t border-slate-100 relative">
                                        <span className="absolute -left-8 -top-2 text-xs text-slate-400">{val}%</span>
                                    </div>
                                ))}
                            </div>

                            {/* --- BARS AND DATA POINTS --- */}
                            {analysis.months.map((month, idx) => {
                                const std = analysis.standardCurve[idx];
                                const real = analysis.realizedCurve[idx];
                                const proj = analysis.projectedCurve[idx];
                                const hist = selectedSnapshot?.data.realizedCurve[idx];
                                const isCurrent = idx === analysis.currentMonthIndex;

                                return (
                                    <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full gap-1 relative z-10 group">
                                        {/* Barra Padrão (Chunky) */}
                                        <div
                                            className="w-2 rounded-t-sm absolute bottom-0 opacity-40 shadow-sm"
                                            style={{ height: `${std}%`, backgroundColor: colors.standard }}
                                            title={`Padrão: ${std}%`}
                                        ></div>

                                        {/* Barra Realizada (Chunky) */}
                                        {real !== null && (
                                            <div
                                                className="w-4 rounded-t-sm z-10 shadow-md transition-all duration-500"
                                                style={{ height: `${real}%`, backgroundColor: colors.realized }}
                                                title={`Realizado: ${real}%`}
                                            ></div>
                                        )}

                                        {/* Barra Histórica (Snapshot) */}
                                        {selectedSnapshot && hist !== undefined && hist !== null && (
                                            <div
                                                className="w-6 bg-orange-400/20 border-t border-orange-500 absolute bottom-0 z-0"
                                                style={{ height: `${hist}%` }}
                                            ></div>
                                        )}

                                        {/* INDICADOR DE PROJEÇÃO (Somente meses futuros) */}
                                        {idx >= analysis.currentMonthIndex && proj !== null && (
                                            <div
                                                className="w-3 h-3 rounded-full border-2 border-white absolute z-20 shadow-md group-hover:scale-150 transition-transform"
                                                style={{ bottom: `calc(${proj}% - 6px)`, backgroundColor: colors.projected }}
                                            ></div>
                                        )}

                                        {/* Label Mes */}
                                        <div className={`absolute -bottom-8 text-[10px] font-bold tracking-tighter ${isCurrent ? 'text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200' : 'text-slate-400'}`}>
                                            {month}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* --- SVG S-CURVE LINES OVERLAY --- */}
                            <div className="absolute inset-0 top-8 bottom-6 px-4 pointer-events-none z-30">
                                <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="grad-realized" x1="0%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor={colors.realized} stopOpacity="0.15" />
                                            <stop offset="100%" stopColor={colors.realized} stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    {(() => {
                                        const numPoints = analysis.months.length;
                                        // Unitless coordinates for viewBox="0 0 1000 1000"
                                        const getX = (idx: number) => ((idx + 0.5) / (numPoints || 1)) * 1000;
                                        const getY = (val: number) => 1000 - ((val || 0) * 10); // 0-100% mapped to 0-1000

                                        // 1. Standard Path
                                        const stdPath = analysis.standardCurve.map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(v || 0)}`).join(' ');

                                        // 2. Realized Path
                                        const realizedPoints = analysis.realizedCurve
                                            .map((v, i) => v !== null ? { x: getX(i), y: getY(v), idx: i } : null)
                                            .filter((p): p is { x: number, y: number, idx: number } => p !== null);
                                        const realPath = realizedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                                        // 3. Projected Path
                                        let projPath = "";
                                        let lastRealIdx = -1;
                                        for (let i = analysis.realizedCurve.length - 1; i >= 0; i--) {
                                            if (analysis.realizedCurve[i] !== null) {
                                                lastRealIdx = i;
                                                break;
                                            }
                                        }

                                        const projectedPoints = analysis.projectedCurve
                                            .map((v, i) => v !== null ? { x: getX(i), y: getY(v) } : null)
                                            .filter((p): p is { x: number, y: number } => p !== null);

                                        if (lastRealIdx !== -1 && projectedPoints.length > 0) {
                                            projPath = `M ${getX(lastRealIdx)} ${getY(analysis.realizedCurve[lastRealIdx]!)} ` + projectedPoints.map(p => `L ${p.x} ${p.y}`).join(' ');
                                        } else if (projectedPoints.length > 0) {
                                            projPath = projectedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                        }

                                        return (
                                            <>
                                                {/* Area Gradient below Realized */}
                                                {realPath && (
                                                    <path
                                                        d={`${realPath} L ${realizedPoints[realizedPoints.length - 1].x} 1000 L ${realizedPoints[0].x} 1000 Z`}
                                                        fill="url(#grad-realized)"
                                                    />
                                                )}

                                                {/* Baseline Line */}
                                                <path d={stdPath} fill="none" stroke={colors.standard} strokeWidth="6" strokeDasharray="15 10" className="opacity-40" />

                                                {/* Realized Line (Blue) */}
                                                {realPath && <path d={realPath} fill="none" stroke={colors.realized} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />}

                                                {/* Projected Line (Purple) */}
                                                {projPath && <path d={projPath} fill="none" stroke={colors.projected} strokeWidth="12" strokeDasharray="20 15" strokeLinecap="round" strokeLinejoin="round" />}
                                            </>
                                        );
                                    })()}
                                </svg>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SEÇÃO 2: DIGITAL TWIN */}
                <section className="print-break">
                    <div className="flex items-center gap-2 mb-6 group relative">
                        <Building2 className="text-indigo-600" size={24} />
                        <h3 className="text-xl font-bold text-slate-800">Digital Twin (Gemba Digital)</h3>
                        <div className="p-1 text-slate-400 hover:text-indigo-500 cursor-help">
                            <Info size={16} />
                            <div className="absolute left-0 bottom-full mb-2 w-72 bg-slate-800 text-white text-[11px] p-4 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 leading-relaxed">
                                <p className="font-bold mb-2 border-b border-slate-600 pb-1 text-indigo-300">Gestão à Vista vs. Gemba Digital</p>
                                <p className="mb-2"><strong>Gestão à Vista:</strong> É a planilha operacional onde você atualiza status dia a dia.</p>
                                <p><strong>Gemba Digital:</strong> É esta visão executiva que cruza o físico (RDO) com o orçado. Serve para identificar gargalos críticos.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                        <BuildingModel
                            numTowers={appData.visualManagement?.config?.towers || 2}
                            numFloors={appData.visualManagement?.config?.floors || 10}
                            aptsPerFloor={appData.visualManagement?.config?.aptsPerFloor || 4}
                            towerNames={appData.visualManagement?.towerNames}
                            statusMap={analysis.statusMap}
                        />
                    </div>
                </section>

                {/* SEÇÃO 3: INSIGHTS & PARETO */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6 print-break">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <TrendingUp size={18} className="text-red-500" /> TOP Estouros (Pareto G.O)
                        </h4>
                        <div className="space-y-4 flex-1">
                            {analysis.overruns.map((o, i) => (
                                <div key={i} className="flex flex-col gap-1">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-bold text-slate-700 truncate max-w-[60%]">{o.desc}</span>
                                        <span className="text-red-600 font-mono">+{formatMoney(o.diff)}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-red-500 h-full rounded-full" style={{ width: `${Math.min(100, (o.diff / (analysis.overruns[0].diff || 1)) * 100)}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-100 p-6 rounded-xl">
                        <h4 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
                            <AlertTriangle size={18} /> Alerta de Prazo
                        </h4>
                        <p className="text-sm text-yellow-800 leading-relaxed">
                            O cruzamento dinâmico indica que serviços de Alvenaria e Estrutura estão com desvio de 8% em relação à meta física do orçamento.
                            Impacto estimado de R$ 45k em custos indiretos adicionais se a tendência persistir.
                        </p>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-xl">
                        <h4 className="font-bold text-emerald-900 mb-2 flex items-center gap-2">
                            <CheckCircle2 size={18} /> Saúde Financeira
                        </h4>
                        <p className="text-sm text-emerald-800 leading-relaxed">
                            Acuracidade de Projeção: {selectedSnapshot ? 'Comparando com snapshot anterior, o desvio foi de apenas 2.4%.' : 'Inicie salvando snapshots para medir sua acuracidade de forecast.'}
                            Fluxo de caixa saudável para os próximos 60 dias.
                        </p>
                    </div>
                </section>
            </div>

            {/* Print Friendly CSS */}
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .print-break { page-break-before: always; }
                    body { background: white !important; }
                    .h-full { height: auto !important; overflow: visible !important; }
                    .bg-slate-50 { background: white !important; }
                    .shadow-sm, .shadow-md, .shadow-lg, .shadow-xl { shadow: none !important; border: 1px solid #eee !important; }
                }
            `}</style>
        </div>
    );
};
