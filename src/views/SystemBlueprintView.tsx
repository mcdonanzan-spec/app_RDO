import React from 'react';
import {
    Layout,
    BrainCircuit,
    BarChart3,
    ShieldCheck,
    ArrowRightCircle,
    Layers,
    Boxes,
    GitBranch,
    Zap,
    Users,
    MessageSquare,
    Target,
    TrendingUp
} from 'lucide-react';

const FeatureCard = ({ icon: Icon, title, description, color }: { icon: any, title: string, description: string, color: string }) => (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-[0_30px_60px_rgba(0,0,0,0.1)] transition-all duration-500 transform hover:-translate-y-2 group">
        <div className={`w-16 h-16 ${color} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-500`}>
            <Icon size={32} className="text-white" />
        </div>
        <h3 className="text-xl font-black text-slate-800 mb-3 tracking-tight">{title}</h3>
        <p className="text-slate-500 leading-relaxed text-sm font-medium">
            {description}
        </p>
    </div>
);

const CaseStudy = ({ title, insight }: { title: string, insight: string }) => (
    <div className="border-l-4 border-yellow-400 bg-yellow-400/5 p-6 rounded-r-2xl">
        <h4 className="text-sm font-black text-slate-900 mb-1 uppercase tracking-widest">{title}</h4>
        <p className="text-slate-600 text-sm leading-relaxed">{insight}</p>
    </div>
);

export const SystemBlueprintView: React.FC = () => {
    return (
        <div className="h-full bg-slate-50 overflow-auto scrollbar-thin scrollbar-thumb-slate-200">
            {/* Hero Section */}
            <div className="bg-slate-900 text-white py-24 px-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-yellow-400/10 to-transparent pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="flex flex-col md:flex-row items-center gap-12">
                        <div className="flex-1 text-center md:text-left">
                            <span className="inline-block bg-yellow-400 text-slate-900 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-6 shadow-lg shadow-yellow-400/20">
                                Digital Twin SGO v5.0
                            </span>
                            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-tight">
                                Torre de <span className="text-yellow-400">Controle</span> de Engenharia.
                            </h1>
                            <p className="text-slate-400 text-lg md:text-xl font-medium max-w-2xl mb-10 leading-relaxed">
                                Uma plataforma inteligente que sincroniza dados orçamentários, suprimentos e produção
                                para criar uma visão 360° da sua obra em tempo real.
                            </p>
                            <div className="flex flex-wrap justify-center md:justify-start gap-4">
                                <div className="flex items-center gap-3 bg-slate-800/80 backdrop-blur px-6 py-3 rounded-2xl border border-slate-700 shadow-xl">
                                    <Zap size={20} className="text-yellow-400" />
                                    <span className="text-sm font-bold tracking-tight">Análise Preditiva</span>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-800/80 backdrop-blur px-6 py-3 rounded-2xl border border-slate-700 shadow-xl">
                                    <BarChart3 size={20} className="text-blue-400" />
                                    <span className="text-sm font-bold tracking-tight">Painéis Executivos</span>
                                </div>
                            </div>
                        </div>
                        <div className="w-full md:w-1/3 flex justify-center">
                            <div className="relative">
                                <div className="w-64 h-64 bg-yellow-400 rounded-[3rem] rotate-12 flex items-center justify-center shadow-[0_0_50px_rgba(250,204,21,0.3)] animate-pulse-slow">
                                    <BrainCircuit size={100} className="text-slate-900 -rotate-12" />
                                </div>
                                <div className="absolute -top-4 -right-4 w-20 h-20 bg-blue-500 rounded-2xl -rotate-6 flex items-center justify-center shadow-xl">
                                    <Target size={32} className="text-white" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Core Modules Grid */}
            <div className="max-w-7xl mx-auto px-8 py-24">
                <div className="text-center mb-20 px-8">
                    <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter mb-4">Como o sistema funciona?</h2>
                    <p className="text-slate-500 text-lg font-medium max-w-3xl mx-auto italic">
                        "Transformamos planilhas complexas em decisões estratégicas."
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    <FeatureCard
                        icon={Layers}
                        title="Estrutura de Dados"
                        description="Sincronização nativa entre Orçamento Base vs. Realizado (RDO). O sistema entende a hierarquia de códigos da obra e consolida os valores automaticamente."
                        color="bg-slate-900"
                    />
                    <FeatureCard
                        icon={TrendingUp}
                        title="Estratégia & BI"
                        description="Nosso Painel Executivo (Digital Twin) que analisa a Curva S Tridimensional: Orçado vs. Realizado vs. Projetado, com Pareto automático de estouros."
                        color="bg-indigo-600"
                    />
                    <FeatureCard
                        icon={BrainCircuit}
                        title="IA Generativa"
                        description="O 'Construction Brain' que entende o contexto da obra, cruza atrasos físicos com impactos financeiros e responde perguntas complexas em tempo real."
                        color="bg-purple-600"
                    />
                    <FeatureCard
                        icon={Boxes}
                        title="Sincronização Físico-Fin."
                        description="Vínculo direto entre serviços do canteiro e grupos orçamentários (G.O). Um atraso na torre é automaticamente traduzido em impacto no fluxo de caixa."
                        color="bg-amber-600"
                    />
                    <FeatureCard
                        icon={GitBranch}
                        title="Previsão (Forecast)"
                        description="Criação de cenários de desembolso futuro. Substitua a incerteza por projeções detalhadas de G.O mensais totalmente editáveis."
                        color="bg-yellow-500"
                    />
                    <FeatureCard
                        icon={ShieldCheck}
                        title="Conformidade Financeira"
                        description="Validação rigorosa de DOCs vs. Orçamentos. Garanta que nenhum gasto exceda a verba aprovada sem devida justificativa."
                        color="bg-red-600"
                    />
                </div>
            </div>

            {/* Scenarios & Insights */}
            <div className="bg-slate-100 py-24">
                <div className="max-w-6xl mx-auto px-8">
                    <div className="bg-white rounded-[3rem] p-12 md:p-20 shadow-2xl relative overflow-hidden flex flex-col md:flex-row gap-16">
                        <div className="flex-1">
                            <h2 className="text-4xl font-black text-slate-900 mb-8 tracking-tighter">Cenários & Insights</h2>
                            <p className="text-slate-500 font-medium mb-12 leading-relaxed">
                                Veja como a Torre de Controle ajuda na gestão do dia-a-dia da obra através de análises inteligentes.
                            </p>

                            <div className="space-y-6">
                                <CaseStudy
                                    title="Desvios de Orçamento"
                                    insight="A IA detecta que o preço do aço subiu 15% acima da média histórica e alerta o gestor para renegociar lotes futuros ou ajustar a projeção de custo final."
                                />
                                <CaseStudy
                                    title="Sincronização Físico-Financeira"
                                    insight="Se a Alvenaria (vinculada ao G.O 01.02) atrasa na Torre 1, a IA sugere o deslocamento da verba de materiais para o mês seguinte, mantendo o saldo de caixa equilibrado."
                                />
                                <CaseStudy
                                    title="Pareto de Desvios"
                                    insight="O Dashboard de BI identifica instantaneamente que 80% do estouro de orçamento está concentrado em apenas 2 grupos de custo secundários."
                                />
                            </div>
                        </div>

                        <div className="w-full md:w-1/3 space-y-8">
                            <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative group border border-slate-800">
                                <Users size={40} className="text-yellow-400 mb-4" />
                                <h4 className="text-lg font-bold mb-2">Público Alvo</h4>
                                <ul className="text-slate-400 text-sm space-y-2">
                                    <li className="flex items-center gap-2">
                                        <div className="w-1 h-1 bg-yellow-400 rounded-full"></div>
                                        Diretores e Gerentes de Obra
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <div className="w-1 h-1 bg-yellow-400 rounded-full"></div>
                                        Engenheiros de Planejamento
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <div className="w-1 h-1 bg-yellow-400 rounded-full"></div>
                                        Setor de Suprimentos (Supply)
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <div className="w-1 h-1 bg-yellow-400 rounded-full"></div>
                                        Controladoria Financeira
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2rem] p-8 text-white shadow-xl">
                                <MessageSquare size={40} className="text-white/50 mb-4" />
                                <h4 className="text-lg font-bold mb-2">Dica do Especialista</h4>
                                <p className="text-blue-100 text-sm leading-relaxed italic">
                                    "Utilize a IA Estratégica semanalmente após o upload do RDO para capturar tendências de mercado antes que elas virem prejuízo."
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="py-20 px-8 text-center bg-white border-t border-slate-200">
                <div className="flex items-center justify-center gap-4 mb-8">
                    <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center font-bold text-slate-900">BRZ</div>
                    <div className="w-px h-6 bg-slate-300"></div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Propulsão Digital para Engenharia Civil</p>
                </div>
                <p className="text-slate-400 text-sm mb-0">© 2026 BRZ Torre de Controle • Todos os direitos reservados.</p>
            </div>
        </div>
    );
};
