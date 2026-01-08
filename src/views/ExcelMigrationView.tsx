import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Database, CheckCircle2, History, Target, TrendingUp, Upload, BrainCircuit, PenTool, LayoutTemplate, Download } from 'lucide-react';
import { AppData } from '../../types';
import { ApiService } from '../services/api';
import { ExcelService } from '../services/ExcelService';
import { ProjectService } from '../services/projectService';
import { getColumnWidth } from '../utils';

export const ExcelMigrationView = ({ onDataLoaded }: { onDataLoaded: (data: AppData) => void }) => {
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [files, setFiles] = useState<Record<string, File | null>>({});
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const [showValidation, setShowValidation] = useState(false);
    const [validationData, setValidationData] = useState<AppData | null>(null);

    const [manualRDO, setManualRDO] = useState<number>(0);
    const [manualBudget, setManualBudget] = useState<number>(0);

    const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
    const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);

    const handleFileChange = (key: string, file: File) => {
        setFiles(prev => ({ ...prev, [key]: file }));
    };

    const triggerFileInput = (key: string) => {
        if (fileInputRefs.current[key]) {
            fileInputRefs.current[key].value = '';
            fileInputRefs.current[key].click();
        }
    };

    const processFiles = async () => {
        setLoading(true);
        setLoadingMessage('Iniciando processamento...');

        const newAppData: AppData = {
            budget: [],
            masterPlanSheets: [],
            rhPremises: [],
            contractorData: { contracts: [] },
            supplyChainData: { orders: [] },
            isLoaded: true,
            rdoData: [],
            projectionData: [],
            rdoSheets: [],
            budgetSheets: [],
            activeProjectId: ''
        };

        try {
            // Get Active Project ID
            const projects = await ProjectService.getProjects();
            if (projects.length > 0) {
                newAppData.activeProjectId = projects[0].id;
                newAppData.activeProject = projects[0];
            } else {
                alert("Aviso: Nenhum projeto ativo encontrado. O salvamento pode falhar.");
            }
            // 1. Process Master Plan (Sheet 01)
            if (files.sheet01) {
                setLoadingMessage('Processando Cronograma Mestre...');
                const wb = await ExcelService.readExcelFile(files.sheet01);
                newAppData.masterPlanSheets = await ExcelService.parseExcelToSheets(wb);
            }

            // 2. Process Budget (The Path) - PRIORITY for Linking
            if (files.budget) {
                setLoadingMessage('Processando Orçamento...');
                const wb = await ExcelService.readExcelFile(files.budget);

                const [budgetData, budgetSheets] = await Promise.all([
                    ExcelService.parseBudget(wb),
                    ExcelService.parseExcelToSheets(wb)
                ]);

                newAppData.budget = budgetData;
                newAppData.budgetSheets = budgetSheets;
            }

            // 3. Process RDO (The Past)
            if (files.rdo) {
                setLoadingMessage('Processando RDO...');
                const wb = await ExcelService.readExcelFile(files.rdo);

                const [rdoData, costSummary, rdoSheets] = await Promise.all([
                    ExcelService.parseRDO(wb),
                    ExcelService.parseCostSummary(wb),
                    ExcelService.parseExcelToSheets(wb)
                ]);

                newAppData.rdoData = rdoData;
                newAppData.costSummary = costSummary;
                newAppData.rdoSheets = rdoSheets;

                // 4. LINK RDO TO BUDGET
                if (newAppData.budget && newAppData.budget.length > 0) {
                    setLoadingMessage('Vinculando Financeiro ao Orçamento...');
                    newAppData.rdoData = ExcelService.linkRDOToBudget(newAppData.rdoData, newAppData.budget);
                }
            }

            setLoadingMessage('Validando dados...');

            // Calculate Initial Totals for Manual Override Inputs
            const totalRDO = newAppData.rdoData?.reduce((acc, i) => acc + (i.accumulatedValue || 0), 0) || 0;
            const totalBudget = newAppData.budget?.filter(i => !i.isGroup).reduce((acc, i) => acc + (i.total || 0), 0) || 0;

            setValidationData(newAppData);
            setManualRDO(totalRDO);
            setManualBudget(totalBudget);

            setShowValidation(true);
            setLoading(false);

        } catch (error) {
            console.error("Error processing files:", error);
            alert("Erro ao processar arquivos. Verifique o console para mais detalhes.");
            setLoading(false);
        } finally {
            setLoadingMessage('');
        }
    };

    const confirmSave = async () => {
        if (validationData) {
            setLoading(true);
            setLoadingMessage('Aplicando correções manuais e salvando...');

            // Apply Manual Override Corrections (Ratio Strategy)
            let finalData = { ...validationData };

            // 1. Correct RDO
            const currentTotalRDO = finalData.rdoData?.reduce((acc, i) => acc + (i.accumulatedValue || 0), 0) || 0;
            if (manualRDO > 0 && currentTotalRDO > 0 && Math.abs(manualRDO - currentTotalRDO) > 1) {
                const ratio = manualRDO / currentTotalRDO;
                console.log(`Aplicando Correção Manual RDO: Ratio ${ratio} (Manual: ${manualRDO} / Lido: ${currentTotalRDO})`);
                finalData.rdoData = finalData.rdoData?.map(item => ({
                    ...item,
                    accumulatedValue: item.accumulatedValue * ratio
                }));
            }

            // 2. Correct Budget
            const currentTotalBudget = finalData.budget?.filter(i => !i.isGroup).reduce((acc, i) => acc + (i.total || 0), 0) || 0;
            if (manualBudget > 0 && currentTotalBudget > 0 && Math.abs(manualBudget - currentTotalBudget) > 1) {
                const ratio = manualBudget / currentTotalBudget;
                console.log(`Aplicando Correção Manual Orçamento: Ratio ${ratio} (Manual: ${manualBudget} / Lido: ${currentTotalBudget})`);
                finalData.budget = finalData.budget?.map(item => ({
                    ...item,
                    unitPrice: item.unitPrice * ratio, // Scale unit price too
                    total: item.total * ratio
                }));
            }

            await saveDataToApi(finalData);
            setLoading(false);
            setShowValidation(false);
        }
    };

    const saveDataToApi = async (data: AppData) => {
        try {
            await ApiService.saveAppData(data);
            alert("Dados processados e salvos com sucesso!");
            onDataLoaded(data);
        } catch (error) {
            console.error("Erro ao salvar na API:", error);
            alert("Erro ao salvar dados na API. Verifique se o servidor está rodando.");
            onDataLoaded(data);
        }
    };

    const handleManualGeneration = async () => {
        if (manualRDO <= 0 && manualBudget <= 0) {
            alert("Por favor, insira valores maiores que zero.");
            return;
        }

        const newAppData: AppData = {
            budget: [],
            masterPlanSheets: [],
            rhPremises: [],
            contractorData: { contracts: [] },
            supplyChainData: { orders: [] },
            isLoaded: true,
            rdoData: [],
            projectionData: [],
            rdoSheets: [],
            budgetSheets: []
        };

        // Create Synthetic Budget Item
        if (manualBudget > 0) {
            newAppData.budget = [{
                code: 'MANUAL-01',
                desc: 'Orçamento Global (Manual)',
                unit: 'vb',
                qty: 1,
                unitPrice: manualBudget,
                total: manualBudget,
                type: 'st',
                originSheet: 'Entrada Manual',
                isGroup: false,
                isConstructionCost: true,
                itemType: 'MACRO_ETAPA'
            }];
        }

        // Create Synthetic RDO Item
        if (manualRDO > 0) {
            newAppData.rdoData = [{
                id: `RDO-MANUAL-${manualDate}`,
                service: 'Lançamento Consolidado (Manual)',
                group: 'Geral',
                accumulatedValue: manualRDO,
                monthlyValue: manualRDO,
                date: manualDate,
                status: 'concluido',
                isConstructionCost: true,
                budgetGroupCode: 'MANUAL-01',
                sigla: 'MAN',
                history: 'Inserção Manual de Totais'
            }];
        }

        // Link them
        newAppData.rdoData = ExcelService.linkRDOToBudget(newAppData.rdoData, newAppData.budget);

        await saveDataToApi(newAppData);
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Validation Modal */}
            {showValidation && validationData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 sticky top-0 bg-white pb-2 border-b">
                            <CheckCircle2 className="text-green-600" />
                            Validação de Dados
                        </h2>
                        <p className="mb-4 text-slate-600 mt-2">Confira os totais identificados. <strong>Se os valores estiverem incorretos, digite os valores reais abaixo</strong> para que o sistema calibre a Inteligência Artificial.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="bg-slate-50 p-4 rounded border border-blue-100">
                                <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                    <History size={16} className="text-blue-600" /> RDO (Realizado)
                                </h3>
                                <div className="flex justify-between text-sm mb-2">
                                    <span>Itens Lidos:</span>
                                    <span className="font-bold">{validationData.rdoData?.length || 0}</span>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Total Realizado (R$)</label>
                                    <input
                                        type="number"
                                        value={manualRDO}
                                        onChange={(e) => setManualRDO(parseFloat(e.target.value) || 0)}
                                        className="w-full text-right font-bold text-slate-700 p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none text-lg bg-white"
                                    />
                                    <p className="text-[10px] text-right text-slate-400 mt-1">
                                        Detectado: {validationData.rdoData?.reduce((acc, i) => acc + (i.accumulatedValue || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded border border-amber-100">
                                <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                    <Target size={16} className="text-amber-600" /> Orçamento (Meta)
                                </h3>
                                <div className="flex justify-between text-sm mb-2">
                                    <span>Itens Lidos:</span>
                                    <span className="font-bold">{validationData.budget?.length || 0}</span>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Total Orçamento (R$)</label>
                                    <input
                                        type="number"
                                        value={manualBudget}
                                        onChange={(e) => setManualBudget(parseFloat(e.target.value) || 0)}
                                        className="w-full text-right font-bold text-amber-600 p-2 border rounded focus:ring-2 focus:ring-amber-500 outline-none text-lg bg-white"
                                    />
                                    <p className="text-[10px] text-right text-slate-400 mt-1">
                                        Detectado: {validationData.budget?.filter(i => !i.isGroup).reduce((acc, i) => acc + (i.total || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded border mb-6">
                            <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                <TrendingUp size={16} className="text-blue-600" />
                                POC (Percentual de Obra Concluída)
                            </h3>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-500">Baseado no Custo Informado:</span>
                                <span className="text-2xl font-bold text-slate-800">
                                    {(() => {
                                        const poc = manualBudget > 0 ? (manualRDO / manualBudget) * 100 : 0;
                                        return `${poc.toFixed(2)}%`;
                                    })()}
                                </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2.5 mt-2">
                                <div
                                    className={`h-2.5 rounded-full transition-all duration-1000 ${manualRDO > manualBudget ? 'bg-red-500' : 'bg-blue-600'}`}
                                    style={{ width: `${Math.min((manualRDO / (manualBudget || 1)) * 100, 100)}%` }}
                                ></div>
                            </div>
                            {manualRDO > manualBudget && (
                                <p className="text-xs text-red-500 mt-1 font-bold">Atenção: O custo realizado ultrapassa o orçamento previsto!</p>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 sticky bottom-0 bg-white pt-2 border-t">
                            <button
                                onClick={() => setShowValidation(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmSave}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                            >
                                <CheckCircle2 size={18} />
                                Confirmar e Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-slate-900 text-white rounded-lg">
                    <Database size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Origem de Dados</h2>
                    <p className="text-slate-500">Escolha como deseja alimentar o sistema: via Arquivos Excel ou Entrada Manual.</p>
                </div>
                <div className="ml-auto">
                    <button
                        onClick={async () => {
                            if (!confirm("Isso irá pegar os dados que estão no seu navegador (Versão Antiga) e enviar para a Nuvem (Supabase). Se você já tem dados na nuvem, eles poderão ser sobrescritos. Continuar?")) return;

                            setLoading(true);
                            setLoadingMessage("Resgatando dados locais...");

                            try {
                                // Ensure we have a project ID
                                let projectId = (validationData as any)?.activeProjectId;
                                if (!projectId) {
                                    const projects = await ProjectService.getProjects();
                                    projectId = projects[0]?.id;
                                }

                                if (!projectId) throw new Error("Nenhum projeto encontrado para migrar.");

                                const success = false; // Feature disabled
                                if (success) {
                                    alert("Dados recuperados com sucesso! O sistema será recarregado.");
                                    window.location.reload();
                                } else {
                                    alert("Falha ao recuperar dados. Verifique o console.");
                                }
                            } catch (e: any) {
                                console.error(e);
                                alert("Erro: " + e.message);
                            } finally {
                                setLoading(false);
                                setLoadingMessage('');
                            }
                        }}
                        className="bg-orange-100 text-orange-700 hover:bg-orange-200 px-4 py-2 rounded-lg text-sm font-bold transition-colors border border-orange-200 flex items-center gap-2"
                        title="Use isto se seus dados sumiram após a atualização"
                    >
                        <Download size={16} /> Resgatar Dados Antigos (Local)
                    </button>
                </div>
            </div>

            <div className="flex gap-4 mb-8 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('upload')}
                    className={`pb-4 px-4 font-bold flex items-center gap-2 transition-all ${activeTab === 'upload' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Upload size={18} /> Importar Excel
                </button>
                <button
                    onClick={() => setActiveTab('manual')}
                    className={`pb-4 px-4 font-bold flex items-center gap-2 transition-all ${activeTab === 'manual' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <PenTool size={18} /> Entrada Manual
                </button>
            </div>

            {activeTab === 'manual' ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
                            <LayoutTemplate size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Criação Rápida de Cenário</h3>
                        <p className="text-slate-500 max-w-md mx-auto mt-2">
                            Insira os totais gerais da obra para habilitar imediatamente os painéis de indicadores e a Inteligência Artificial, sem precisar processar planilhas complexas.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <Target size={16} className="text-amber-500" />
                                    Orçamento Total (Meta)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-slate-400 font-bold">R$</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={manualBudget || ''}
                                        onChange={(e) => setManualBudget(parseFloat(e.target.value))}
                                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none font-mono text-lg"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <History size={16} className="text-blue-500" />
                                    Total Realizado (RDO)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-slate-400 font-bold">R$</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={manualRDO || ''}
                                        onChange={(e) => setManualRDO(parseFloat(e.target.value))}
                                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-lg"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Data de Referência</label>
                            <input
                                type="date"
                                value={manualDate}
                                onChange={(e) => setManualDate(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
                            />
                        </div>

                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-600">
                            <strong>Nota:</strong> Esta ação criará um "Banco de Dados Sintético" com apenas 2 itens (um de Orçamento e um de RDO). Isso permitirá calcular o POC e usar a IA, mas você perderá a granularidade (detalhes item a item).
                        </div>

                        <button
                            onClick={handleManualGeneration}
                            disabled={!manualBudget && !manualRDO}
                            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-3 text-lg"
                        >
                            <CheckCircle2 size={24} />
                            GERAR DADOS E ACESSAR PAINEL
                        </button>
                    </div>
                </div>
            ) : (
                null
            )}

            {
                loading ? (
                    <div className="text-center py-32 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                        <div className="animate-spin w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mb-6"></div>
                        <p className="text-slate-800 font-bold text-xl animate-pulse">{loadingMessage}</p>
                        <p className="text-sm text-slate-400 mt-2">Isso pode levar alguns segundos dependendo do tamanho dos arquivos.</p>
                    </div>
                ) : activeTab === 'upload' && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* RDO */}
                            <div
                                onClick={() => triggerFileInput('rdo')}
                                className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer bg-white h-64 ${files.rdo ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-500 hover:shadow-md'}`}
                            >
                                <input ref={el => { fileInputRefs.current['rdo'] = el }} type="file" className="hidden" accept=".xlsx" onChange={(e) => e.target.files && handleFileChange('rdo', e.target.files[0])} />
                                <div className={`p-4 rounded-full mb-4 ${files.rdo ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {files.rdo ? <CheckCircle2 size={32} /> : <History size={32} />}
                                </div>
                                <div className="font-bold text-lg text-slate-800">O PASSADO</div>
                                <div className="font-medium text-blue-600 mb-2">RDO (Realizado)</div>
                                <div className="text-xs text-slate-500 max-w-[200px] truncate">{files.rdo ? files.rdo.name : 'Relatório Diário de Obra'}</div>
                            </div>

                            {/* BUDGET */}
                            <div
                                onClick={() => triggerFileInput('budget')}
                                className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer bg-white h-64 ${files.budget ? 'border-amber-400 bg-amber-50' : 'border-slate-300 hover:border-amber-500 hover:shadow-md'}`}
                            >
                                <input ref={el => { fileInputRefs.current['budget'] = el }} type="file" className="hidden" accept=".xlsx" onChange={(e) => e.target.files && handleFileChange('budget', e.target.files[0])} />
                                <div className={`p-4 rounded-full mb-4 ${files.budget ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {files.budget ? <CheckCircle2 size={32} /> : <Target size={32} />}
                                </div>
                                <div className="font-bold text-lg text-slate-800">O CAMINHO</div>
                                <div className="font-medium text-amber-600 mb-2">Orçamento (Meta)</div>
                                <div className="text-xs text-slate-500 max-w-[200px] truncate">{files.budget ? files.budget.name : 'Orçamento Executivo (REV02)'}</div>
                            </div>

                            {/* MASTER PLAN */}
                            <div
                                onClick={() => triggerFileInput('sheet01')}
                                className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer bg-white h-64 ${files.sheet01 ? 'border-purple-400 bg-purple-50' : 'border-slate-300 hover:border-purple-500 hover:shadow-md'}`}
                            >
                                <input ref={el => { fileInputRefs.current['sheet01'] = el }} type="file" className="hidden" accept=".xls,.xlsx,.xlsm,.xlsb" onChange={(e) => e.target.files && handleFileChange('sheet01', e.target.files[0])} />
                                <div className={`p-4 rounded-full mb-4 ${files.sheet01 ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {files.sheet01 ? <CheckCircle2 size={32} /> : <TrendingUp size={32} />}
                                </div>
                                <div className="font-bold text-lg text-slate-800">O FUTURO</div>
                                <div className="font-medium text-purple-600 mb-2">Planejamento Mestre</div>
                                <div className="text-xs text-slate-500 max-w-[200px] truncate">{files.sheet01 ? files.sheet01.name : 'Planilha 01 (Master)'}</div>
                            </div>
                        </div>

                        {/* PROJECTIONS */}
                        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mt-6">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                                <BrainCircuit size={16} /> Planejamento Complementar (Projeções)
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {['sheet02', 'sheet03', 'sheet04', 'sheet05'].map((id) => (
                                    <div
                                        key={id}
                                        onClick={() => triggerFileInput(id)}
                                        className={`border-2 border-dashed rounded-lg p-3 flex flex-col items-center justify-center text-center transition-all cursor-pointer bg-white h-24 ${files[id] ? 'border-purple-300 bg-purple-50' : 'border-slate-300 hover:border-purple-400 hover:shadow-sm'}`}
                                    >
                                        <input ref={el => { fileInputRefs.current[id] = el }} type="file" className="hidden" accept=".xls,.xlsx,.xlsm,.xlsb" onChange={(e) => e.target.files && handleFileChange(id, e.target.files[0])} />
                                        <div className={`p-1.5 rounded-full mb-1 ${files[id] ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                                            {files[id] ? <CheckCircle2 size={14} /> : <Upload size={14} />}
                                        </div>
                                        <div className="font-bold text-[10px] text-slate-600 uppercase">
                                            {`PROJ. ${id.slice(-2)}`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => processFiles()}
                            disabled={!files.sheet01 && !files.rdo && !files.budget}
                            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-3 text-lg"
                        >
                            <BrainCircuit size={24} />
                            PROCESSAR GÊMEO DIGITAL
                        </button>
                    </div>
                )
            }
        </div>
    );
};
