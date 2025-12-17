import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Sparkles, Send, BrainCircuit, FileText, PieChart, BarChart3, Bot } from 'lucide-react';
import { AppData, AIResponse } from '../../types';

interface IntelligenceViewProps {
    appData: AppData;
}

export const IntelligenceView: React.FC<IntelligenceViewProps> = ({ appData }) => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<AIResponse | null>(null);
    const [manualApiKey, setManualApiKey] = useState('');
    const [includeDI, setIncludeDI] = useState(true);

    // Tenta pegar do env, mas permite override manual
    const apiKey = manualApiKey || import.meta.env.VITE_API_KEY || "";

    const getContextData = () => {
        let contextText = "";

        // RDO Data
        if (appData.rdoData && appData.rdoData.length > 0) {
            contextText += "=== DADOS RDO (REALIZADO) ===\n";
            // Group by 'group' (Column I)
            const groupedRDO: Record<string, number> = {};
            appData.rdoData.forEach(item => {
                const group = item.group || "Outros";
                groupedRDO[group] = (groupedRDO[group] || 0) + (item.accumulatedValue || 0);
            });

            contextText += "RESUMO POR GRUPO ORÇAMENTÁRIO (RDO):\n";
            Object.entries(groupedRDO).forEach(([group, val]) => {
                contextText += `- ${group}: R$${val.toFixed(2)}\n`;
            });

            // Top items
            const topItems = [...appData.rdoData].sort((a, b) => (b.accumulatedValue || 0) - (a.accumulatedValue || 0)).slice(0, 20);
            contextText += "\nTOP 20 ITENS MAIS CAROS (RDO):\n";
            topItems.forEach(item => {
                contextText += `- ${item.service}: R$${(item.accumulatedValue || 0).toFixed(2)} (Data: ${item.date})\n`;
            });
        }

        // Budget Data
        if (appData.budget && appData.budget.length > 0) {
            contextText += "\n=== DADOS ORÇAMENTO (META) ===\n";
            // Group by 'desc' (Column D)
            const groupedBudget: Record<string, number> = {};
            appData.budget.forEach(item => {
                if (item.isGroup) return; // Skip groups
                if (!includeDI && item.isConstructionCost === false) return; // Skip DI if filter is active

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
            const rdoItems = includeDI ? appData.rdoData : appData.rdoData.filter(i => i.isConstructionCost !== false);
            const budgetItems = includeDI ? appData.budget.filter(i => !i.isGroup) : appData.budget.filter(i => !i.isGroup && i.isConstructionCost !== false);

            const totalRDO = rdoItems.reduce((acc, i) => acc + (i.accumulatedValue || 0), 0);
            const totalBudget = budgetItems.reduce((acc, i) => acc + (i.total || 0), 0);
            const poc = totalBudget > 0 ? (totalRDO / totalBudget) * 100 : 0;

            contextText += `\n=== ANÁLISE DE POC (PERCENTUAL DE OBRA CONCLUÍDA) ===\n`;
            contextText += `Total Realizado (RDO): R$${totalRDO.toFixed(2)}\n`;
            contextText += `Total Orçado (Meta): R$${totalBudget.toFixed(2)}\n`;
            contextText += `POC Financeiro: ${poc.toFixed(2)}%\n`;
        }

        // Cost Summary (Timeline)
        if (appData.costSummary && appData.costSummary.length > 0) {
            contextText += "\n=== RESUMO DE CUSTO (TIMELINE) ===\n";
            contextText += "Period | Material | Service | Equipment | Indirect | Total\n";
            appData.costSummary.forEach(item => {
                contextText += `${item.period} | R$${item.materials.toFixed(2)} | R$${item.services.toFixed(2)} | R$${item.equipment.toFixed(2)} | R$${item.indirect.toFixed(2)} | R$${item.total.toFixed(2)}\n`;
            });
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

        if (appData.rhPremises && appData.rhPremises.length > 0) {
            contextText += `\n\n=== PREMISSAS DE RH ===\n`;
            appData.rhPremises.forEach(p => {
                const total = p.baseSalary * (1 + p.chargesPct / 100) + p.foodCost + (p.transportCost || 0) + (p.housingCost || 0);
                contextText += `- ${p.role}: Custo Total Est. R$${total.toFixed(2)} (Qtd: ${p.quantity})\n`;
            });
        }

        // Contracts Data
        if (appData.contractorData?.contracts?.length > 0) {
            contextText += `\n\n=== TABELA DE CONTRATOS (DETALHADA) ===\n`;
            const contracts = appData.contractorData.contracts;

            const totalContracts = contracts.reduce((acc, c) => acc + (c.totalValue || 0), 0);
            const totalInitial = contracts.reduce((acc, c) => acc + (c.initialValue || 0), 0);
            const totalAdditives = contracts.reduce((acc, c) => acc + (c.additives || 0), 0);
            const totalMeasured = contracts.reduce((acc, c) => acc + (c.measuredTotal || 0), 0);
            const totalBalance = contracts.reduce((acc, c) => acc + (c.balance || 0), 0);

            contextText += `RESUMO GERAL CONTRATOS:\n`;
            contextText += `Total Atualizado: R$${totalContracts.toFixed(2)}\n`;
            contextText += `Total Inicial: R$${totalInitial.toFixed(2)}\n`;
            contextText += `Total Aditivos: R$${totalAdditives.toFixed(2)}\n`;
            contextText += `Total Medido (Realizado): R$${totalMeasured.toFixed(2)}\n`;
            contextText += `Saldo a Medir: R$${totalBalance.toFixed(2)}\n\n`;

            contextText += `DETALHE DOS PRINCIPAIS CONTRATOS (Top 20):\n`;
            // Sort by total value desc
            contracts.sort((a, b) => b.totalValue - a.totalValue).slice(0, 20).forEach(c => {
                contextText += `- ${c.supplier} (ID: ${c.id}) | Total: R$${c.totalValue.toFixed(2)} | Inicial: R$${(c.initialValue || 0).toFixed(2)} | Adit: R$${(c.additives || 0).toFixed(2)} | Medido: R$${(c.measuredTotal || 0).toFixed(2)} | Saldo: R$${(c.balance || 0).toFixed(2)}\n`;
            });
        }

        // Supply Chain Data
        if (appData.supplyChainData?.orders?.length > 0) {
            contextText += `\n\n=== ORDENS DE COMPRA (SUPRIMENTOS) ===\n`;
            const orders = appData.supplyChainData.orders;

            const totalOrders = orders.reduce((acc, o) => acc + (o.totalValue || 0), 0);
            const totalOpen = orders.filter(o => o.status === 'programmed').reduce((acc, o) => acc + (o.totalValue || 0), 0);
            const totalPartial = orders.filter(o => o.status === 'partial').reduce((acc, o) => acc + (o.totalValue || 0), 0);

            contextText += `Total Geral Suprimentos: R$${totalOrders.toFixed(2)}\n`;
            contextText += `Total A Receber (Programado/Aberto): R$${totalOpen.toFixed(2)}\n`;
            contextText += `Total Parcialmente Entregue: R$${totalPartial.toFixed(2)}\n`;

            orders.slice(0, 15).forEach(o => {
                contextText += `- Fornecedor: ${o.supplier} | Desc: ${o.description} | Valor: R$${o.totalValue.toFixed(2)} | Status: ${o.status}\n`;
            });
        }

        return contextText;
    };

    const handleAskAI = async () => {
        if (!query) return;
        setLoading(true);

        try {
            if (!apiKey) {
                throw new Error("Chave API não configurada. Por favor, insira a chave API nas configurações ou no código.");
            }

            const ai = new GoogleGenAI({ apiKey: apiKey });
            const context = getContextData();
            const prompt = `
        Atue como um Diretor de Engenharia e Analista de BI da BRZ Empreendimentos.
        Analise os dados financeiros da obra abaixo e responda à pergunta do usuário.
        
        CONTEXTO DOS DADOS (Excel):
        ${context}

        PERGUNTA DO USUÁRIO: "${query}"

        INSTRUÇÃO DE SAÍDA:
        Retorne APENAS um JSON válido (sem markdown \`\`\`json) com a seguinte estrutura:
        {
          "analysis": "Texto explicativo direto, estilo executivo, focado em insights financeiros e riscos.",
          "kpis": [
            { "label": "Nome do Indicador", "value": "Valor R$", "trend": "up/down/neutral", "color": "text-red-500/text-green-500/text-slate-500" }
          ],
          "chart": {
            "title": "Título do Gráfico",
            "type": "bar",
            "labels": ["Label1", "Label2"],
            "values": [100, 200]
          }
        }
        Se a pergunta não puder ser respondida com os dados, diga isso na analysis.
      `;

            // Retry logic for 503 errors
            let attempts = 0;
            const maxAttempts = 3;
            let result: any = null;
            let lastError: any = null;

            while (attempts < maxAttempts) {
                try {
                    result = await ai.models.generateContent({
                        model: "gemini-2.5-flash",
                        contents: prompt
                    });
                    break; // Success
                } catch (e: any) {
                    lastError = e;
                    if (e.message?.includes('503') || e.message?.includes('overloaded')) {
                        attempts++;
                        if (attempts < maxAttempts) {
                            // Wait 2 seconds before retrying
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            continue;
                        }
                    }
                    throw e; // Throw other errors or if max attempts reached
                }
            }

            const text = result?.text || "";
            const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

            let parsed;
            try {
                parsed = JSON.parse(jsonString);
            } catch (e) {
                console.error("JSON Parse Error:", e);
                // Fallback if AI returns plain text instead of JSON
                parsed = {
                    analysis: text,
                    kpis: []
                };
            }

            // Validação de Tipos para evitar Crash na Renderização
            if (!parsed || typeof parsed !== 'object') {
                throw new Error("Resposta da IA inválida (não é um objeto JSON).");
            }

            // Garantir que arrays sejam arrays
            if (parsed.kpis && !Array.isArray(parsed.kpis)) {
                parsed.kpis = [];
            }

            if (parsed.chart) {
                if (!parsed.chart.values || !Array.isArray(parsed.chart.values)) {
                    parsed.chart = null; // Descarta gráfico inválido
                } else if (!parsed.chart.labels || !Array.isArray(parsed.chart.labels)) {
                    parsed.chart = null;
                }
            }

            setResponse(parsed);
        } catch (error: any) {
            console.error("AI Error:", error);
            let errorMessage = `Erro ao consultar a IA: ${error.message || error}.`;

            // Tratamento de Erros Específicos
            const errStr = String(error.message || error);

            if (errStr.includes('503') || errStr.includes('overloaded')) {
                errorMessage = "O modelo de IA está sobrecarregado no momento. Por favor, aguarde alguns instantes e tente novamente.";
            } else if (errStr.includes('API key')) {
                errorMessage = "Chave API inválida ou não configurada. Verifique suas configurações.";
            } else if (errStr.includes('429') || errStr.includes('Quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
                errorMessage = "⚠️ Limite de requisições da versão gratuita atingido. O sistema de IA precisa de uma pausa de ~30 segundos. Por favor, tente novamente em breve.";
            }

            setResponse({
                analysis: errorMessage,
                kpis: [],
            });
        } finally {
            setLoading(false);
        }
    };

    const handleQuickPrompt = (q: string) => {
        setQuery(q);
    };

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
                    <div className="flex gap-2 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                        <span title="Contratos Carregados">📄 Prj: {appData.contractorData?.contracts?.length || 0}</span>
                        <span className="text-slate-300">|</span>
                        <span title="Suprimentos Carregados">📦 Sup: {appData.supplyChainData?.orders?.length || 0}</span>
                        <span className="text-slate-300">|</span>
                        <span title="RDO Carregados">🏗️ RDO: {appData.rdoData?.length || 0}</span>
                        <span className="text-slate-300">|</span>
                        <span title="Orçamento Carregado">💰 Orc: {appData.budget?.length || 0}</span>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button
                            onClick={() => setIncludeDI(true)}
                            className={`px-3 py-1 text-xs font-bold rounded transition-all ${includeDI ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Com DI
                        </button>
                        <button
                            onClick={() => setIncludeDI(false)}
                            className={`px-3 py-1 text-xs font-bold rounded transition-all ${!includeDI ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Sem DI (Construção)
                        </button>
                    </div>

                    {!apiKey && (
                        <div className="flex items-center gap-2">
                            <div className="text-xs bg-red-50 text-red-600 px-3 py-1 rounded border border-red-200">
                                ⚠️ API_KEY ausente
                            </div>
                            <input
                                type="password"
                                placeholder="Cole sua API Key aqui..."
                                className="text-xs border border-slate-300 rounded px-2 py-1 w-48"
                                value={manualApiKey}
                                onChange={(e) => setManualApiKey(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-5xl mx-auto space-y-6">
                    {!response && !loading && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            {[
                                "Qual o resumo financeiro atual da obra?",
                                "Existem riscos de estouro orçamentário?",
                                "Qual a previsão de desembolso para o próximo mês?"
                            ].map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleQuickPrompt(q)}
                                    className="p-4 bg-white rounded-xl border border-slate-200 hover:border-yellow-400 hover:shadow-md transition-all text-left text-sm text-slate-700 flex items-center justify-between group"
                                >
                                    <span>{q}</span>
                                    <Send size={16} className="text-slate-300 group-hover:text-yellow-500" />
                                </button>
                            ))}
                        </div>
                    )}

                    {loading ? (
                        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 text-center animate-pulse">
                            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <BrainCircuit className="text-yellow-600 animate-spin-slow" size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">Analisando Dados Complexos...</h3>
                            <p className="text-slate-500 mt-2">A IA está cruzando o Cronograma Mestre com o Orçamento Detalhado.</p>
                        </div>
                    ) : response ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {response.kpis && response.kpis.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {response.kpis.map((kpi, idx) => (
                                        <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <p className="text-xs text-slate-500 font-bold uppercase">{kpi.label}</p>
                                            <p className={`text-2xl font-bold mt-1 ${kpi.color || 'text-slate-800'}`}>{kpi.value}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <FileText size={18} className="text-blue-500" /> Relatório Executivo
                                    </h3>
                                    <div className="prose prose-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                        {response.analysis}
                                    </div>
                                </div>

                                {response.chart && (
                                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                            {response.chart.type === 'pie' ? <PieChart size={18} className="text-purple-500" /> : <BarChart3 size={18} className="text-purple-500" />}
                                            {response.chart.title}
                                        </h3>
                                        <div className="flex flex-col gap-4">
                                            {response.chart.values.map((val, idx) => {
                                                // Type guard for simple number array
                                                if (typeof val !== 'number') return null;

                                                // Safe cast since we checked type
                                                const numericValues = response.chart!.values.filter((v): v is number => typeof v === 'number');
                                                const max = Math.max(...numericValues);

                                                // Evita divisão por zero e garante largura mínima visível
                                                const widthPct = max > 0 ? (val / max) * 100 : 0;
                                                const label = response.chart!.labels[idx];

                                                return (
                                                    <div key={idx} className="w-full">
                                                        <div className="flex justify-between text-xs mb-1">
                                                            <span className="font-bold text-slate-700 truncate max-w-[70%]" title={label}>
                                                                {label}
                                                            </span>
                                                            <span className="font-mono text-slate-500">
                                                                {val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                                            <div
                                                                className="bg-blue-500 h-2.5 rounded-full transition-all duration-1000 ease-out"
                                                                style={{ width: `${Math.max(widthPct, 1)}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <BrainCircuit size={48} className="mb-4 opacity-20" />
                            <p>Faça uma pergunta para iniciar a análise estratégica.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200">
                <div className="max-w-5xl mx-auto flex gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                        placeholder="Pergunte sobre custos, prazos ou riscos..."
                        className="flex-1 px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition-all"
                    />
                    <button
                        onClick={handleAskAI}
                        disabled={loading || !query}
                        className="bg-slate-900 text-white px-6 py-3 rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                        {loading ? <span>Processando...</span> : <><Send size={18} /> <span>Analisar</span></>}
                    </button>
                </div>
            </div>
        </div>
    );
};
