import React, { useMemo } from 'react';
import { FlaskConical, Sparkles, TrendingUp, Target, CalendarClock, AlertTriangle, CheckCircle2, Building2 } from 'lucide-react';
import { AppData } from '../../types';
import { formatMoney } from '../utils';
import { BuildingModel } from '../components/BuildingModel';

interface AIStrategyViewProps {
    appData: AppData;
}

export const AIStrategyView: React.FC<AIStrategyViewProps> = ({ appData }) => {

    // --- MOCK DATA GENERATOR (Enquanto não temos os arquivos reais) ---
    // Simula dados do RDO (Passado), Orçamento (Padrão) e Projeção (Futuro)
    const mockAnalysis = useMemo(() => {
        // 1. Timeline Data
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        // Curva S Padrão (Orçamento REV02)
        const standardCurve = [10, 25, 45, 60, 75, 85, 92, 96, 98, 100, 100, 100];

        // Curva Realizada (RDO - Passado) - Vamos simular que estamos em Junho (Mês 6)
        // Atraso leve no início, recuperando agora
        const realizedCurve = [8, 22, 40, 58, 74, 86, null, null, null, null, null, null];

        // Curva Projetada (Futuro - 5 Planilhas)
        // Projeção mostra que vamos acelerar e terminar antes
        const projectedCurve = [null, null, null, null, null, 86, 94, 98, 100, 100, 100, 100];

        // 2. Building Status Map (Mock)
        const statusMap: Record<string, 'concluido' | 'em_andamento' | 'atrasado' | 'nao_iniciado'> = {};

        // Torre 1: Quase pronta
        for (let f = 1; f <= 10; f++) {
            for (let a = 1; a <= 4; a++) {
                const key = `T1-F${f}-A${a}`;
                if (f <= 8) statusMap[key] = 'concluido';
                else if (f === 9) statusMap[key] = 'em_andamento';
                else statusMap[key] = 'nao_iniciado';
            }
        }

        // Torre 2: Estrutura subindo (atrasada nos andares baixos)
        for (let f = 1; f <= 10; f++) {
            for (let a = 1; a <= 4; a++) {
                const key = `T2-F${f}-A${a}`;
                if (f <= 3) statusMap[key] = 'concluido';
                else if (f === 4) statusMap[key] = 'atrasado'; // Deveria estar pronto
                else if (f === 5) statusMap[key] = 'em_andamento';
                else statusMap[key] = 'nao_iniciado';
            }
        }

        return {
            months,
            standardCurve,
            realizedCurve,
            projectedCurve,
            statusMap,
            currentMonthIndex: 5 // Junho (0-based)
        };
    }, []);

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-auto custom-scrollbar">
            {/* HEADER */}
            <div className="bg-white p-8 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                        <FlaskConical size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Laboratório de Estratégia & IA</h2>
                        <p className="text-slate-500">Análise Tridimensional: Passado (RDO), Padrão (Orçamento) e Futuro (Projeção).</p>
                    </div>
                </div>
            </div>

            <div className="p-8 max-w-7xl mx-auto space-y-12">

                {/* SEÇÃO 1: O RADAR DE DESVIOS (TIMELINE) */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <CalendarClock className="text-blue-600" size={24} />
                            <h3 className="text-xl font-bold text-slate-800">Radar de Tendência (Curva S)</h3>
                        </div>
                        <div className="flex gap-4 text-sm">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-400"></div> Padrão (Orçamento)</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-600"></div> Realizado (RDO)</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500 border border-dashed border-white"></div> Projeção (Futuro)</div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-80 relative">
                        {/* GRÁFICO SIMPLIFICADO COM CSS (Para evitar deps de chart lib por enquanto) */}
                        <div className="flex items-end justify-between h-full pt-8 pb-6 px-4 gap-2 relative">
                            {/* Grid Lines */}
                            <div className="absolute inset-0 top-8 bottom-6 px-4 flex flex-col justify-between pointer-events-none">
                                {[100, 75, 50, 25, 0].map(val => (
                                    <div key={val} className="w-full border-t border-slate-100 relative">
                                        <span className="absolute -left-8 -top-2 text-xs text-slate-400">{val}%</span>
                                    </div>
                                ))}
                            </div>

                            {mockAnalysis.months.map((month, idx) => {
                                const std = mockAnalysis.standardCurve[idx];
                                const real = mockAnalysis.realizedCurve[idx];
                                const proj = mockAnalysis.projectedCurve[idx];
                                const isCurrent = idx === mockAnalysis.currentMonthIndex;

                                return (
                                    <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full gap-1 relative group z-10">
                                        {/* Barra Padrão (Fundo) */}
                                        <div
                                            className="w-2 bg-slate-200 rounded-t-sm absolute bottom-0"
                                            style={{ height: `${std}%` }}
                                            title={`Padrão: ${std}%`}
                                        ></div>

                                        {/* Barra Realizada */}
                                        {real !== null && (
                                            <div
                                                className={`w-4 rounded-t-sm z-10 ${real >= std ? 'bg-green-500' : 'bg-blue-600'}`}
                                                style={{ height: `${real}%` }}
                                                title={`Realizado: ${real}%`}
                                            ></div>
                                        )}

                                        {/* Ponto Projetado */}
                                        {proj !== null && idx > mockAnalysis.currentMonthIndex && (
                                            <div
                                                className="w-3 h-3 rounded-full bg-purple-500 border-2 border-white absolute shadow-sm"
                                                style={{ bottom: `calc(${proj}% - 6px)` }}
                                                title={`Projeção: ${proj}%`}
                                            ></div>
                                        )}

                                        {/* Label Mes */}
                                        <div className={`absolute -bottom-8 text-xs font-medium ${isCurrent ? 'text-blue-700 font-bold bg-blue-50 px-2 py-1 rounded' : 'text-slate-500'}`}>
                                            {month}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* SEÇÃO 2: GESTÃO À VISTA (GEMBA DIGITAL) */}
                <section>
                    <div className="flex items-center gap-2 mb-6">
                        <Building2 className="text-indigo-600" size={24} />
                        <h3 className="text-xl font-bold text-slate-800">Gestão à Vista (Gemba Digital)</h3>
                    </div>

                    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-start mb-6">
                            <p className="text-slate-500 max-w-2xl">
                                Visualização do progresso físico baseada no cruzamento do <strong>RDO (Realizado)</strong> com o <strong>Orçamento (Escopo)</strong>.
                                Cada célula representa uma unidade habitacional.
                            </p>
                            <div className="flex gap-2">
                                <button className="px-3 py-1 text-xs font-bold bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100">Estrutura</button>
                                <button className="px-3 py-1 text-xs font-bold bg-white text-slate-500 border border-slate-200 rounded hover:bg-slate-50">Alvenaria</button>
                                <button className="px-3 py-1 text-xs font-bold bg-white text-slate-500 border border-slate-200 rounded hover:bg-slate-50">Acabamento</button>
                            </div>
                        </div>

                        <BuildingModel
                            numTowers={2}
                            numFloors={10}
                            aptsPerFloor={4}
                            statusMap={mockAnalysis.statusMap}
                        />
                    </div>
                </section>

                {/* SEÇÃO 3: INSIGHTS DA IA */}
                <section>
                    <div className="flex items-center gap-2 mb-6">
                        <Sparkles className="text-yellow-500" size={24} />
                        <h3 className="text-xl font-bold text-slate-800">Insights Estratégicos (IA)</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-yellow-50 border border-yellow-100 p-6 rounded-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <AlertTriangle size={100} className="text-yellow-600" />
                            </div>
                            <h4 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
                                <AlertTriangle size={18} /> Ponto de Atenção
                            </h4>
                            <p className="text-sm text-yellow-800 leading-relaxed">
                                A <strong>Torre 2</strong> apresenta um gargalo no <strong>4º Pavimento</strong>.
                                O Orçamento previa conclusão para 15/Mai, mas o RDO aponta status "Em Andamento" há 20 dias.
                                Isso pode impactar o início da Alvenaria previsto para a próxima semana.
                            </p>
                        </div>

                        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <TrendingUp size={100} className="text-emerald-600" />
                            </div>
                            <h4 className="font-bold text-emerald-900 mb-2 flex items-center gap-2">
                                <CheckCircle2 size={18} /> Oportunidade
                            </h4>
                            <p className="text-sm text-emerald-800 leading-relaxed">
                                A <strong>Torre 1</strong> está 2% acima da curva padrão.
                                A projeção indica que, mantendo esse ritmo, a obra poderá ser entregue <strong>15 dias antes do prazo contratual</strong>, gerando uma economia estimada de R$ 45.000 em custos indiretos.
                            </p>
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
};
