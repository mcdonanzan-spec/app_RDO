import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Sparkles, Send, BrainCircuit, FileText, PieChart, BarChart3, Bot, Save, History, Clock, Trash2 } from 'lucide-react';
import { AppData, AIResponse, SavedAnalysis } from '../../types';
import { ApiService } from '../services/api';

interface IntelligenceViewProps {
    appData: AppData;
}

export const IntelligenceView: React.FC<IntelligenceViewProps> = ({ appData }) => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<AIResponse | null>(null);
    const [manualApiKey, setManualApiKey] = useState('');
    const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [forecastData, setForecastData] = useState<any>(null);
    const [budgetOverrides, setBudgetOverrides] = useState<any>(null);
    const [descriptionOverrides, setDescriptionOverrides] = useState<any>(null);

    React.useEffect(() => {
        loadHistory();
        loadForecastData();
    }, []);

    const loadForecastData = async () => {
        const { db } = await import('../services/db');
        const fd = await db.meta.get('disbursementForecast');
        const bo = await db.meta.get('disbursementBudgetOverrides');
        const d_o = await db.meta.get('disbursementDescOverrides');
        if (fd) setForecastData(fd.value);
        if (bo) setBudgetOverrides(bo.value);
        if (d_o) setDescriptionOverrides(d_o.value);
    };

    const loadHistory = async () => {
        const history = await ApiService.getSavedAnalyses();
        setSavedAnalyses(history);
    };

    const handleSaveAnalysis = async () => {
        if (!response || !query) return;
        const newAnalysis: SavedAnalysis = {
            date: new Date().toISOString(),
            query,
            response
        };
        await ApiService.saveAnalysis(newAnalysis);
        await loadHistory();
        alert("Análise salva com sucesso!");
    };

    const apiKey = manualApiKey || import.meta.env.VITE_API_KEY || "";

    const getContextData = () => {
        let contextText = "";

        // RDO Data
        if (appData.rdoData && appData.rdoData.length > 0) {
            contextText += "=== DADOS RDO (REALIZADO) ===\n";
            const groupedRDO: Record<string, number> = {};
            appData.rdoData.forEach(item => {
                const group = item.group || "Outros";
                groupedRDO[group] = (groupedRDO[group] || 0) + (item.accumulatedValue || 0);
            });

            contextText += "RESUMO POR GRUPO ORÇAMENTÁRIO (RDO):\n";
            Object.entries(groupedRDO).forEach(([group, val]) => {
                contextText += `- ${group}: R$${val.toFixed(2)}\n`;
            });

            const topItems = [...appData.rdoData].sort((a, b) => (b.accumulatedValue || 0) - (a.accumulatedValue || 0)).slice(0, 20);
            contextText += "\nTOP 20 ITENS MAIS CAROS (RDO):\n";
            topItems.forEach(item => {
                contextText += `- ${item.service}: R$${(item.accumulatedValue || 0).toFixed(2)} (Data: ${item.date})\n`;
            });
        }

        // Budget Data
        if (appData.budget && appData.budget.length > 0) {
            contextText += "\n=== DADOS ORÇAMENTO (META) ===\n";
            const groupedBudget: Record<string, number> = {};
            appData.budget.forEach(item => {
                if (item.isGroup) return;
                const group = item.desc || "Outros";
                groupedBudget[group] = (groupedBudget[group] || 0) + (item.total || 0);
            });

            contextText += "RESUMO POR GRUPO (ORÇAMENTO):\n";
            Object.entries(groupedBudget).forEach(([group, val]) => {
                contextText += `- ${group}: R$${val.toFixed(2)}\n`;
            });
        }

        // POC Analysis
        if (appData.rdoData && appData.budget) {
            const rdoItems = appData.rdoData;
            const budgetItems = appData.budget.filter(i => !i.isGroup);
            const totalRDO = rdoItems.reduce((acc, i) => acc + (i.accumulatedValue || 0), 0);
            const totalBudget = budgetItems.reduce((acc, i) => acc + (i.total || 0), 0);
            const poc = totalBudget > 0 ? (totalRDO / totalBudget) * 100 : 0;

            contextText += `\n=== ANÁLISE DE POC (PERCENTUAL DE OBRA CONCLUÍDA) ===\n`;
            contextText += `Total Realizado (RDO): R$${totalRDO.toFixed(2)}\n`;
            contextText += `Total Orçado (Meta): R$${totalBudget.toFixed(2)}\n`;
            contextText += `POC Financeiro: ${poc.toFixed(2)}%\n`;
        }

        // Master Plan
        if (appData.masterPlanSheets && appData.masterPlanSheets.length > 0) {
            contextText += `\n\n=== CRONOGRAMA MESTRE ===\n`;
            const meaningfulData = appData.masterPlanSheets.map(s =>
                `Planilha: ${s.name}\n` +
                s.data.slice(0, 20).map(row => row.join(' | ')).join('\n')
            ).join('\n');
            contextText += meaningfulData;
        }

        // Production / Visual Management (Physical Status)
        if (appData.visualManagement) {
            contextText += `\n\n=== STATUS DE PRODUÇÃO FÍSICA (GESTÃO À VISTA) ===\n`;
            const { services, status, config } = appData.visualManagement;
            const totalUnits = config.towers * config.floors * config.aptsPerFloor;
            services.forEach(svc => {
                let completed = 0;
                Object.values(status).forEach(unitServices => {
                    if (unitServices[svc.id] === 'completed') completed++;
                });
                const percent = totalUnits > 0 ? (completed / totalUnits) * 100 : 0;
                contextText += `- Serviço: ${svc.name} [Vínculo G.O: ${svc.budgetCode || 'N/A'}] | Progresso: ${percent.toFixed(1)}% (${completed}/${totalUnits} unidades)\n`;
            });
        }

        // Financial Entries
        if (appData.financialEntries && appData.financialEntries.length > 0) {
            contextText += `\n\n=== LANÇAMENTOS FINANCEIROS (DESEMBOLSO) ===\n`;
            const entries = appData.financialEntries;
            const totalNFs = entries.reduce((acc, e) => acc + e.totalValue, 0);
            const paid = entries.filter(e => e.status === 'PAID').reduce((acc, e) => acc + e.totalValue, 0);
            const approvedPending = entries.filter(e => e.status === 'APPROVED').reduce((acc, e) => acc + e.totalValue, 0);

            contextText += `Total Lançado: R$${totalNFs.toFixed(2)}\n`;
            contextText += `Total Aprovado Pendente: R$${approvedPending.toFixed(2)}\n`;
            contextText += `Total Pago: R$${paid.toFixed(2)}\n`;
            contextText += `Qtd NFs: ${entries.length}\n`;

            const rdoTotalVal = appData.rdoData.reduce((acc, r) => acc + (r.accumulatedValue || 0), 0);
            contextText += `CONCILIAÇÃO FÍSICO x FINANCEIRO:\n`;
            contextText += `Realizado Físico (RDO): R$${rdoTotalVal.toFixed(2)}\n`;
            contextText += `Realizado Financeiro (NF): R$${totalNFs.toFixed(2)}\n`;
            contextText += `Diferença: R$${(rdoTotalVal - totalNFs).toFixed(2)}\n\n`;

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let forecastNextMonth = 0;
            let forecastNext3Months = 0;
            const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
            const threeMonthsOut = new Date(today);
            threeMonthsOut.setMonth(threeMonthsOut.getMonth() + 3);

            entries.forEach(entry => {
                entry.installments?.forEach(inst => {
                    const dueDate = new Date(inst.dueDate + 'T12:00:00');
                    if (inst.status === 'PENDING') {
                        if (dueDate >= nextMonthStart && dueDate <= nextMonthEnd) forecastNextMonth += inst.value;
                        if (dueDate >= today && dueDate <= threeMonthsOut) forecastNext3Months += inst.value;
                    }
                });
            });

            contextText += `PREVISÃO DE DESEMBOLSO (SISTEMA):\n`;
            contextText += `Próximo Mês: R$${forecastNextMonth.toFixed(2)}\n`;
            contextText += `Próximos 3 Meses: R$${forecastNext3Months.toFixed(2)}\n`;
        }

        // Forecast Scenarios
        if (forecastData) {
            contextText += `\n=== CENÁRIOS DE PROJEÇÃO (MANUAL/FORECAST VIEW) ===\n`;
            Object.entries(forecastData).forEach(([code, months]: [string, any]) => {
                const desc = descriptionOverrides?.[code] || code;
                const budgetActual = budgetOverrides?.[code] || 0;
                const totalProj = Object.values(months).reduce((a: any, b: any) => a + b, 0) as number;
                if (totalProj > 0 || budgetActual > 0) {
                    contextText += `- G.O ${code} (${desc}): Budget Simulado: R$${budgetActual.toFixed(2)} | Total Projetado: R$${totalProj.toFixed(2)}\n`;
                }
            });
        }

        return contextText;
    };

    const handleAskAI = async () => {
        if (!query) return;
        setLoading(true);
        try {
            if (!apiKey) throw new Error("Chave API não configurada.");
            const ai = new GoogleGenAI({ apiKey });
            const context = getContextData();
            const prompt = `
            Atue como um Diretor de Engenharia e Analista de BI da BRZ Empreendimentos.
            Analise os dados financeiros da obra e responda à pergunta do usuário.
            VERTENTES:
            1. OFICIAL: NFs, RDO físico, Orçamento.
            2. CENÁRIOS: Projeções mensais manuais.
            3. FÍSICO: Progresso real de torres (Gestão à Vista) e vínculo com Orçamento.
            CROSS-CHECK: Se um serviço físico está atrasado, alerte sobre o impacto no desembolso futuro (G.O vinculado).
            CONTEXTO:\n${context}\nPERGUNTA: "${query}"
            SAÍDA JSON: { "analysis": "texto", "kpis": [{ "label": "...", "value": "..." }], "chart": { ... } }`;

            const result = await ai.models.generateContent({
                model: "gemini-2.0-flash", // Using a stable version
                contents: prompt
            });

            const text = result?.text || "{}";
            const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
            let parsed = JSON.parse(jsonString);
            setResponse(parsed);
        } catch (error: any) {
            console.error(error);
            setResponse({ analysis: "Erro ao processar consulta IA.", kpis: [] });
        } finally {
            setLoading(false);
        }
    };

    const handleQuickPrompt = (q: string) => setQuery(q);

    return (
        <div className="h-full flex flex-col bg-slate-50">
            <div className="bg-white p-6 border-b border-slate-200 shadow-sm flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Sparkles className="text-yellow-500" /> Construction Brain
                    </h2>
                    <p className="text-sm text-slate-500">Inteligência Artificial Generativa aplicada ao Controle de Obras</p>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setShowHistory(!showHistory)} className={`p-2 rounded-lg border flex items-center gap-2 ${showHistory ? 'bg-slate-200 text-slate-800' : 'bg-white text-slate-500'}`}>
                        <History size={20} /> Histórico
                    </button>
                    {!apiKey && (
                        <input type="password" placeholder="API Key..." className="text-xs border rounded px-2 py-1 w-48" value={manualApiKey} onChange={(e) => setManualApiKey(e.target.value)} />
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-5xl mx-auto space-y-6">
                    {!response && !loading && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            {["Qual o resumo financeiro?", "Riscos de estouro?", "Previsão para o próximo mês?"].map((q, i) => (
                                <button key={i} onClick={() => handleQuickPrompt(q)} className="p-4 bg-white rounded-xl border hover:border-yellow-400 text-left text-sm flex items-center justify-between group">
                                    <span>{q}</span><Send size={16} className="text-slate-300 group-hover:text-yellow-500" />
                                </button>
                            ))}
                        </div>
                    )}

                    {showHistory ? (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold flex items-center gap-2"><History size={20} /> Histórico</h3>
                            {savedAnalyses.map((item) => (
                                <div key={item.id} className="bg-white p-4 rounded-xl border cursor-pointer" onClick={() => { setQuery(item.query); setResponse(item.response); setShowHistory(false); }}>
                                    <h4 className="font-bold">"{item.query}"</h4>
                                    <p className="text-xs text-slate-500">{new Date(item.date).toLocaleString()}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        loading ? (
                            <div className="text-center p-8 animate-pulse">
                                <BrainCircuit className="text-yellow-600 animate-spin-slow mx-auto mb-4" size={48} />
                                <h3>Analisando Dados Complexos...</h3>
                            </div>
                        ) : response ? (
                            <div className="space-y-6">
                                {response.kpis && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {response.kpis.map((kpi, idx) => (
                                            <div key={idx} className="bg-white p-4 rounded-xl border">
                                                <p className="text-xs text-slate-500 uppercase">{kpi.label}</p>
                                                <p className="text-2xl font-bold">{kpi.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="bg-white p-6 rounded-xl border">
                                    <h3 className="font-bold mb-4 flex items-center gap-2"><FileText size={18} /> Relatório</h3>
                                    <div className="prose prose-sm whitespace-pre-wrap">{response.analysis}</div>
                                </div>
                                <button onClick={handleSaveAnalysis} className="flex items-center gap-2 bg-white border p-2 rounded-lg text-sm font-medium">
                                    <Save size={18} /> Salvar análise
                                </button>
                            </div>
                        ) : null
                    )}
                </div>
            </div>

            <div className="p-4 bg-white border-t">
                <div className="max-w-5xl mx-auto flex gap-2">
                    <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAskAI()} placeholder="Pergunte algo..." className="flex-1 px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-yellow-400" />
                    <button onClick={handleAskAI} disabled={loading || !query} className="bg-slate-900 text-white px-6 py-3 rounded-lg font-bold disabled:opacity-50">
                        {loading ? "Processando..." : "Analisar"}
                    </button>
                </div>
            </div>
        </div>
    );
};
