import React, { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Sparkles, Send, BrainCircuit, FileText, PieChart, BarChart3, Bot, Save, History, Clock, Trash2, AlertTriangle, ChevronRight, CheckCircle, Settings } from 'lucide-react';
import { AppData, AIResponse, SavedAnalysis } from '../../types';
import { ApiService } from '../services/api';

interface IntelligenceViewProps {
    appData: AppData;
}

// Basic Markdown-like formatter for AI text
const MarkdownText: React.FC<{ text: string }> = ({ text }) => {
    // Replace markdown-style bold, lists and paragraphs
    const formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^# (.*)/gm, '<h1 class="text-2xl font-black text-slate-800 mt-6 mb-3 border-b pb-2">$1</h1>')
        .replace(/^## (.*)/gm, '<h2 class="text-xl font-bold text-slate-800 mt-5 mb-2">$1</h2>')
        .replace(/^### (.*)/gm, '<h3 class="text-lg font-bold text-slate-700 mt-4 mb-2">$1</h3>')
        .replace(/^- (.*)/gm, '<li class="ml-4 list-disc text-slate-600 mb-1">$1</li>')
        .replace(/\n\n/g, '</p><p class="mb-4">')
        .replace(/\n/g, '<br/>');

    return <div className="text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: `<p class="mb-4">${formatted}</p>` }} />;
};

// Simple Bar Chart for AI Insights
const AIInsightChart: React.FC<{ data: any }> = ({ data }) => {
    if (!data || !data.items || !Array.isArray(data.items)) return null;

    const maxVal = Math.max(...data.items.map((i: any) => i.value || 0), 1);

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mt-6">
            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <BarChart3 size={16} className="text-indigo-500" />
                {data.title || 'Visualização de Tendências'}
            </h4>
            <div className="space-y-4">
                {data.items.map((item: any, i: number) => (
                    <div key={i} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-600">{item.label}</span>
                            <span className="text-slate-900 font-mono">
                                {typeof item.value === 'number' ?
                                    (item.format === 'currency' ? `R$ ${item.value.toLocaleString('pt-BR')}` : `${item.value}%`) :
                                    item.value}
                            </span>
                        </div>
                        <div className="h-4 bg-slate-50 rounded-full overflow-hidden border border-slate-100 flex items-center">
                            <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(99,102,241,0.3)]"
                                style={{ width: `${(item.value / maxVal) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const BRZ_SUPPORT_KEY = "AIzaSyDGWmGZr4hPwUjAZU_xBu9bKm-W9yJd7rU";

export const IntelligenceView: React.FC<IntelligenceViewProps> = ({ appData }) => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<AIResponse | null>(null);
    const [manualApiKey, setManualApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
    const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [forecastData, setForecastData] = useState<any>(null);
    const [budgetOverrides, setBudgetOverrides] = useState<any>(null);
    const [descriptionOverrides, setDescriptionOverrides] = useState<any>(null);
    const [initialRealized, setInitialRealized] = useState<any>(null);
    const [cooldownSeconds, setCooldownSeconds] = useState(0);
    const [lastQueryTime, setLastQueryTime] = useState<number>(0);

    const [selectedModel, setSelectedModel] = useState(localStorage.getItem('gemini_selected_model') || "gemini-1.5-flash");
    const [showSettings, setShowSettings] = useState(false);
    const [availableModels, setAvailableModels] = useState<string[]>([]);

    // Persistence Effects
    React.useEffect(() => {
        if (manualApiKey) localStorage.setItem('gemini_api_key', manualApiKey);
    }, [manualApiKey]);

    React.useEffect(() => {
        if (selectedModel) localStorage.setItem('gemini_selected_model', selectedModel);
    }, [selectedModel]);

    // Auto-fetch and Auto-configure models
    React.useEffect(() => {
        const key = manualApiKey || (import.meta.env.VITE_API_KEY as string);

        // Only fetch if we don't have models yet (or if key changes)
        if (key) {
            fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
                .then(res => res.json())
                .then(data => {
                    if (data.models) {
                        const models = data.models.map((m: any) => m.name.replace('models/', ''));
                        setAvailableModels(models);

                        // SMART AUTO-SELECT: If current model is not in list, pick the first valid one
                        // This fixes the "Default to 1.5-flash" issue if the key doesn't support it
                        if (models.length > 0) {
                            // Check if current selected model is valid
                            const isCurrentValid = models.includes(selectedModel);

                            if (!isCurrentValid) {
                                // Prefer "pro" or "flash" models that look stable
                                const bestModel = models.find((m: string) => m.includes('1.5-pro')) ||
                                    models.find((m: string) => m.includes('2.5')) ||
                                    models.find((m: string) => m.includes('flash')) ||
                                    models[0];

                                console.log("Auto-switching model to:", bestModel);
                                setSelectedModel(bestModel);
                            }
                        }
                    }
                })
                .catch(err => console.error("Auto-configuration failed:", err));
        }
    }, [manualApiKey]);

    React.useEffect(() => {
        setQuery('');
        setResponse(null);
        setForecastData(null);
        setBudgetOverrides(null);
        setDescriptionOverrides(null);
        setInitialRealized(null);

        loadHistory();
        loadForecastData();
    }, [appData.activeProjectId]);

    // Cooldown timer effect
    React.useEffect(() => {
        if (cooldownSeconds > 0) {
            const timer = setTimeout(() => {
                setCooldownSeconds(prev => prev - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldownSeconds]);

    const loadForecastData = async () => {
        const projectId = appData.activeProjectId;
        if (!projectId) return;

        const data = await ApiService.getDisbursementForecast(projectId);
        if (data) {
            if (data.forecast_data) setForecastData(data.forecast_data);
            if (data.budget_overrides) setBudgetOverrides(data.budget_overrides);
            if (data.description_overrides) setDescriptionOverrides(data.description_overrides);
            if (data.initial_realized) setInitialRealized(data.initial_realized);
        }
    };

    const loadHistory = async () => {
        const projectId = appData.activeProjectId;
        if (!projectId) return;

        const history = await ApiService.getAIAnalyses(projectId);
        setSavedAnalyses(history);
    };

    const handleSaveAnalysis = async () => {
        if (!response || !query) return;

        const projectId = appData.activeProjectId;
        if (!projectId) {
            alert("❌ Erro: Projeto não identificado");
            return;
        }

        await ApiService.saveAnalysis(projectId, { query, response });
        await loadHistory();
        alert("✅ Análise salva com sucesso no Supabase!");
    };

    // Priority: Manual -> Vite Env -> Process Env (replaced by define)
    const apiKey = manualApiKey ||
        (import.meta.env.VITE_API_KEY as string) ||
        (process.env.VITE_API_KEY as string) ||
        (process.env.GEMINI_API_KEY as string) ||
        "";

    const handleTestConnection = async () => {
        if (!apiKey) {
            alert("❌ Insira uma Chave API primeiro.");
            return;
        }
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: selectedModel });
            const result = await model.generateContent("Say 'OK' if you can hear me.");
            const response = await result.response;
            const text = response.text();
            alert(`✅ Conexão BEM SUCEDIDA com modelo ${selectedModel}!\nResposta: ${text}`);
        } catch (error: any) {
            console.error("Test Error:", error);
            alert(`❌ Falha na conexão com ${selectedModel}:\n${error.message}`);
        }
    };

    const handleListModels = async () => {
        if (!apiKey) {
            alert("❌ Insira uma Chave API primeiro.");
            return;
        }
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const data = await response.json();

            if (data.models) {
                const modelNames = data.models.map((m: any) => m.name.replace('models/', ''));
                setAvailableModels(modelNames);
                if (modelNames.length > 0) {
                    setSelectedModel(modelNames[0]);
                }
                alert(`✅ ${modelNames.length} Modelos encontrados!\n\nO seletor foi atualizado com as opções disponíveis para sua conta.`);
                console.log("Available Models:", data.models);
            } else {
                alert(`⚠️ Nenhum modelo listado. Resposta da API:\n${JSON.stringify(data, null, 2)}`);
            }
        } catch (error: any) {
            alert(`❌ Erro ao listar modelos:\n${error.message}`);
        }
    };



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

            const topItems = [...appData.rdoData].sort((a, b) => (b.accumulatedValue || 0) - (a.accumulatedValue || 0)).slice(0, 30);
            contextText += "\nTOP 30 ITENS MAIS RELEVANTES (RDO):\n";
            topItems.forEach(item => {
                contextText += `- Serviço: ${item.service} | Código: ${item.code} | Grupo: ${item.group} | Valor Acumulado: R$${(item.accumulatedValue || 0).toFixed(2)} (Ref: ${item.date})\n`;
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

            // Add Retroactive Realized to POC
            const totalRetro = initialRealized ? Object.values(initialRealized).reduce((acc: any, val: any) => acc + (val || 0), 0) as number : 0;
            const totalWithRetro = totalRDO + totalRetro;
            const poc = totalBudget > 0 ? (totalWithRetro / totalBudget) * 100 : 0;

            contextText += `\n=== ANÁLISE DE POC (PERCENTUAL DE OBRA CONCLUÍDA) ===\n`;
            contextText += `Total Realizado (RDO): R$${totalRDO.toFixed(2)}\n`;
            if (totalRetro > 0) contextText += `Saldo Retroativo (Implantação): R$${totalRetro.toFixed(2)}\n`;
            contextText += `Total Orçado (Meta): R$${totalBudget.toFixed(2)}\n`;
            contextText += `POC Financeiro Real (Com Retroativo): ${poc.toFixed(2)}%\n`;
        }

        // Master Plan
        if (appData.masterPlanSheets && appData.masterPlanSheets.length > 0) {
            contextText += `\n\n=== CRONOGRAMA MESTRE ===\n`;
            const meaningfulData = appData.masterPlanSheets.map(s =>
                `Planilha: ${s.name}\n` +
                s.data.slice(0, 50).map(row => row.join(' | ')).join('\n')
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

            const rdoTotalVal = (appData.rdoData || []).reduce((acc, r) => acc + (r.accumulatedValue || 0), 0);
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
                const retro = initialRealized?.[code] || 0;
                const totalProj = Object.values(months).reduce((a: any, b: any) => a + b, 0) as number;
                if (totalProj > 0 || budgetActual > 0 || retro > 0) {
                    contextText += `- G.O ${code} (${desc}): Budget Simulado: R$${budgetActual.toFixed(2)} | Retroativo: R$${retro.toFixed(2)} | Projeção Futura: R$${totalProj.toFixed(2)}\n`;
                }
            });
        }

        return contextText;
    };

    const handleAskAI = async () => {
        if (!query || cooldownSeconds > 0) return;

        // Set cooldown for 60 seconds
        setCooldownSeconds(60);
        setLastQueryTime(Date.now());
        setLoading(true);
        try {
            if (!apiKey) throw new Error("Chave API não configurada. Por favor, insira manualmente ou configure na Vercel.");

            console.log("AI Config Check:");
            console.log("- Env VITE_API_KEY:", import.meta.env.VITE_API_KEY ? "Detected" : "Missing");
            const maskedKey = apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}` : "None";
            console.log("- Effective Key detected:", maskedKey);

            const genAI = new GoogleGenerativeAI(apiKey);

            const context = getContextData();
            const prompt = `
            Você é o "Construction Brain", um Diretor de Inteligência da BRZ Empreendimentos.
            Analise os dados financeiros e técnicos fornecidos e gere um relatório PREMIUM e ESTRATÉGICO.

            DADOS CONTEXTUAIS:
            ${context}

            PERGUNTA DO USUÁRIO: "${query}"

            REQUISITOS DE SAÍDA (Obrigatório JSON válido com a estrutura abaixo):
            {
              "analysis": "Texto rico em Markdown (## Títulos, **Negrito**, - Listas). Seja executivo.",
              "kpis": [{ "label": "Título", "value": "Valor" }],
              "chart": { "title": "...", "items": [{ "label": "...", "value": 0, "format": "currency" }] }
            }
            
            ESTILO: Tom de voz executivo, focado em riscos financeiros e desvios de obra.
            SAÍDA JSON APENAS. SEM CODE BLOCKS.`;

            let result;
            try {
                // Use selected model from validation tool
                console.log(`Attempting Selected Model: ${selectedModel}...`);
                const model = genAI.getGenerativeModel({ model: selectedModel });
                result = await model.generateContent(prompt);
            } catch (err: any) {
                console.warn(`${selectedModel} failed:`, err.message);

                if (err.message && (err.message.includes('404') || err.message.includes('not found'))) {
                    // Fallback only if different
                    if (selectedModel !== 'gemini-1.5-flash') {
                        console.log("Attempting Fallback to Gemini 1.5 Flash...");
                        const modelFallback = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                        result = await modelFallback.generateContent(prompt);
                    } else {
                        throw err;
                    }
                } else {
                    throw err;
                }
            }

            // Handle response based on SDK structure
            let text = "";
            const res = result as any;
            if (res.text && typeof res.text !== 'function') {
                text = res.text;
            } else if (typeof res.text === 'function') {
                text = await res.text();
            } else if (res.response?.text) {
                text = typeof res.response.text === 'function' ? res.response.text() : res.response.text;
            } else if (res.candidates?.[0]?.content?.parts?.[0]?.text) {
                text = res.candidates[0].content.parts[0].text;
            }

            if (!text) text = "{}";

            const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonString);
            setResponse(parsed);
        } catch (error: any) {
            console.error("Critical AI Error:", error);
            let userMessage = "Erro ao processar consulta IA.";

            if (error.message?.includes('429')) {
                userMessage = "⚠️ Limite de Uso Atingido (Quota). Por favor aguarde 60 segundos.";
            } else if (error.message?.includes('404')) {
                userMessage = "⚠️ Erro de Modelo (404). Verifique se sua chave suporta 'gemini-1.5-flash' ou 'gemini-pro'.";
            } else if (error.message?.includes('401') || error.message?.includes('403')) {
                userMessage = "⚠️ Chave API Inválida ou Rejeitada (401/403). Verifique no AI Studio se a chave está ativa.";
            } else {
                userMessage = `Erro: ${error.message || 'Falha de conexão com a IA'}`;
            }

            setResponse({
                analysis: userMessage,
                kpis: []
            });
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
                    <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-lg border flex items-center gap-2 ${showSettings ? 'bg-slate-200 text-slate-800' : 'bg-white text-slate-500'}`}>
                        <Settings size={20} /> Config
                    </button>
                    <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-2 py-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">API KEY:</span>
                        <input
                            type="password"
                            placeholder={apiKey ? "Reconhecida (Autofill)" : "Cole sua chave aqui..."}
                            className="text-xs bg-transparent outline-none w-32 text-slate-600 placeholder:text-slate-300"
                            value={manualApiKey}
                            onChange={(e) => setManualApiKey(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="w-full space-y-6">
                    {showSettings ? (
                        <div className="space-y-6 max-w-4xl mx-auto bg-white p-8 rounded-3xl border border-slate-100 shadow-lg">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800 border-b pb-4">
                                <Settings size={24} className="text-slate-400" /> Configurações Avançadas da IA
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Modelo Generativo (Google Gemini)</label>
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {availableModels.length > 0 ? (
                                            availableModels.map(model => (
                                                <option key={model} value={model}>{model}</option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Rápido & Econômico)</option>
                                                <option value="gemini-pro">Gemini 1.0 Pro (Estável)</option>
                                                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Mais Inteligente)</option>
                                            </>
                                        )}
                                    </select>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Se estiver recebendo erro 404, tente alternar entre os modelos acima. O modelo "Pro" geralmente é o mais compatível com chaves antigas.
                                    </p>
                                </div>

                                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-3">
                                    <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                                        <CheckCircle size={18} /> Chave de Suporte BRZ (Homologada)
                                    </div>
                                    <p className="text-xs text-indigo-600/80 leading-relaxed">
                                        Se a chave automática da Vercel falhar, use esta chave mestra de suporte para ativar o Construction Brain imediatamente.
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <code className="text-[10px] bg-white px-2 py-1 rounded border border-indigo-200 text-indigo-500 font-mono">
                                            AIzaSyD...Jd7rU
                                        </code>
                                        <button
                                            onClick={() => {
                                                setManualApiKey(BRZ_SUPPORT_KEY);
                                                alert("✅ Chave de Suporte BRZ aplicada com sucesso!");
                                            }}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm"
                                        >
                                            Aplicar Esta Chave
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100">
                                    <h4 className="font-bold text-slate-800 mb-2">Diagnóstico de Conexão</h4>
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={handleTestConnection}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                                            >
                                                <BrainCircuit size={16} /> Testar Conexão Agora
                                            </button>
                                            <span className="text-xs text-slate-400">
                                                Testa envio de mensagem simples.
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={handleListModels}
                                                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                                            >
                                                <FileText size={16} /> Listar Modelos Disponíveis
                                            </button>
                                            <span className="text-xs text-slate-400">
                                                Consulta a API para ver quais modelos sua chave tem permissão para acessar.
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : showHistory ? (
                        <div className="space-y-4 max-w-4xl mx-auto">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-700">
                                <History size={20} className="text-indigo-500" /> Histórico de Análises
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {savedAnalyses.length > 0 ? savedAnalyses.map((item) => (
                                    <div
                                        key={item.id}
                                        className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
                                        onClick={() => { setQuery(item.query); setResponse(item.response); setShowHistory(false); }}
                                    >
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">"{item.query}"</h4>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded-md">{new Date(item.date).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2 line-clamp-2">{item.response.analysis.substring(0, 150)}...</p>
                                    </div>
                                )) : (
                                    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                                        <Clock size={48} className="text-slate-200 mx-auto mb-4" />
                                        <p className="text-slate-400 font-medium">Nenhuma análise salva no histórico deste projeto.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : !response && !loading && !showHistory ? (
                        <div className="max-w-4xl mx-auto space-y-12 py-10">
                            {/* Empty State / Welcome */}
                            <div className="text-center space-y-4">
                                <div className="w-20 h-20 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-3xl shadow-xl shadow-yellow-100 flex items-center justify-center mx-auto mb-6 transform -rotate-6">
                                    <BrainCircuit size={40} className="text-white" />
                                </div>
                                <h2 className="text-4xl font-black text-slate-900 tracking-tight">O que vamos analisar hoje?</h2>
                                <p className="text-slate-500 max-w-lg mx-auto leading-relaxed">
                                    Eu sou o seu copiloto de gestão. Tenho acesso a todos os dados de orçamento,
                                    RDO, produção física e fluxo de caixa do projeto.
                                </p>
                            </div>

                            {/* API Key Setup (Visual Alert) */}
                            {!apiKey && (
                                <div className="bg-white p-8 rounded-[32px] border-2 border-dashed border-indigo-200 shadow-xl shadow-indigo-50/50 flex flex-col items-center text-center space-y-6">
                                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
                                        <Bot size={32} />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-slate-800">Cérebro Desconectado</h3>
                                        <p className="text-sm text-slate-500 max-w-sm">Para ativar a análise avançada, insira sua chave do Google Gemini no campo abaixo ou configure nas variáveis de ambiente.</p>
                                    </div>
                                    <div className="flex gap-2 w-full max-w-md">
                                        <input
                                            type="password"
                                            placeholder="Cole sua API Key aqui..."
                                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                                            value={manualApiKey}
                                            onChange={(e) => setManualApiKey(e.target.value)}
                                        />
                                        <button
                                            onClick={() => {
                                                if (manualApiKey) {
                                                    alert("✅ Chave ativada localmente!");
                                                }
                                            }}
                                            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors"
                                        >
                                            Ativar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Quick Prompts */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { q: "Qual o resumo financeiro?", icon: <FileText size={18} /> },
                                    { q: "Quais os riscos de estouro?", icon: <AlertTriangle size={18} /> },
                                    { q: "Previsão para o próximo mês?", icon: <PieChart size={18} /> }
                                ].map((item, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleQuickPrompt(item.q)}
                                        className="p-6 bg-white rounded-2xl border border-slate-100 hover:border-yellow-400 hover:shadow-xl hover:shadow-yellow-50 text-left transition-all group relative overflow-hidden"
                                    >
                                        <div className="mb-4 text-slate-400 group-hover:text-yellow-500 transition-colors">
                                            {item.icon}
                                        </div>
                                        <span className="text-sm font-bold text-slate-700 block group-hover:text-slate-900">{item.q}</span>
                                        <ChevronRight size={16} className="absolute right-4 bottom-4 text-slate-200 group-hover:text-yellow-500 group-hover:translate-x-1 transition-all" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : loading ? (
                        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
                            <div className="relative mb-10">
                                <div className="absolute inset-0 bg-yellow-400/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
                                <div className="relative w-24 h-24 bg-white rounded-[32px] shadow-2xl flex items-center justify-center border border-slate-50">
                                    <BrainCircuit className="text-yellow-500 animate-spin-slow" size={48} />
                                </div>
                                <div className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                                    <Sparkles size={14} className="text-white animate-pulse" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Processando Inteligência...</h3>
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">Analisando Orçamento vs Realizado vs Chronograma</p>
                        </div>
                    ) : response ? (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
                            {response.kpis && (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {response.kpis.map((kpi, idx) => (
                                        <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 group-hover:text-indigo-600 transition-colors">{kpi.label}</p>
                                            <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">{kpi.value}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-100/50">
                                    <div className="flex items-center justify-between mb-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                                                <Bot size={32} />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Relatório Executivo</h3>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Construction Brain AI • Online</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <MarkdownText text={response.analysis} />

                                    <div className="mt-10 pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle size={16} className="text-green-500" />
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Dados integrados com sucesso da base de produção</p>
                                        </div>
                                        <button
                                            onClick={handleSaveAnalysis}
                                            className="w-full md:w-auto flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-bold hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-100 active:scale-95"
                                        >
                                            <Save size={18} /> Salvar no Histórico
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {response.chart && <AIInsightChart data={response.chart} />}

                                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 rounded-[40px] text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                                        <div className="relative z-10">
                                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4 backdrop-blur-md">
                                                <Sparkles size={20} />
                                            </div>
                                            <h4 className="text-lg font-black tracking-tight mb-2 uppercase">Dica Premium</h4>
                                            <p className="text-sm text-indigo-100 leading-relaxed font-medium">
                                                Você pode pedir para a IA comparar o cenário de projeção manual com o realizado oficial das notas fiscais para identificar desvios de provisionamento.
                                            </p>
                                        </div>
                                        <BrainCircuit className="absolute -right-8 -bottom-8 text-white opacity-10 group-hover:scale-125 group-hover:rotate-12 transition-all duration-1000" size={180} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="p-4 bg-white border-t">
                <div className="w-full flex gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !cooldownSeconds && handleAskAI()}
                        placeholder={cooldownSeconds > 0 ? `Aguarde ${cooldownSeconds}s para próxima análise...` : "Pergunte algo..."}
                        disabled={cooldownSeconds > 0}
                        className="flex-1 px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-yellow-400 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                    <button
                        onClick={handleAskAI}
                        disabled={loading || !query || cooldownSeconds > 0}
                        className="bg-slate-900 text-white px-6 py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <BrainCircuit className="animate-spin" size={18} />
                                Processando...
                            </span>
                        ) : cooldownSeconds > 0 ? (
                            <span className="flex items-center gap-2">
                                <Clock size={18} />
                                {cooldownSeconds}s
                            </span>
                        ) : (
                            "Analisar"
                        )}
                        {cooldownSeconds > 0 && (
                            <div
                                className="absolute bottom-0 left-0 h-1 bg-yellow-400 transition-all duration-1000 ease-linear"
                                style={{ width: `${((60 - cooldownSeconds) / 60) * 100}%` }}
                            />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
