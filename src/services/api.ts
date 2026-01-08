import { AppData, ContractBox, RHPremise, SupplyChainBox } from '../../types';
import { supabase } from './supabase';
import { ProjectService } from './projectService';
import { FinancialService } from './financialService';
import { BudgetService } from './budgetService';
import { getVisualManagement, saveVisualManagement } from './db';

export class ApiService {

    static async getAppData(projectId?: string): Promise<AppData> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.log("No active session, returning empty data.");
                return this.getEmptyAppData();
            }

            if (!projectId) {
                const projects = await ProjectService.getProjects();
                if (projects.length === 0) {
                    return { ...this.getEmptyAppData(), isLoaded: true };
                }
                projectId = projects[0].id;
            }

            console.log(`Loading data for project ID: ${projectId}`);

            const [projects, budgetTree, financialEntries, rdoData, visualMgmt] = await Promise.all([
                ProjectService.getProjects(),
                BudgetService.getBudgetTree(projectId),
                FinancialService.getEntries(projectId),
                BudgetService.getRDOItems(projectId),
                ApiService.getVisualManagementData(projectId) // Fetches from Supabase now
            ]);



            const activeProject = projects.find(p => p.id === projectId);


            // Transform BudgetTree to flat list if needed by AppData.budget, 
            // BUT AppData.budget usually expects a flat list too? 
            // Review types.ts later. The app seems to use budget (flat) and budgetTree (tree).
            // BudgetService returns tree. We might need to flatten it for 'budget' prop or update AppData type.
            // For now, let's assume 'budget' prop is flat lines.

            const budgetFlat: any[] = []; // TODO: Flatten logic if strictly required by legacy views
            // Actually, the new views use budgetTree. Legacy views use budget. 
            // We can flatten budgetTree easily.
            const flatten = (nodes: any[]) => {
                nodes.forEach(n => {
                    budgetFlat.push({
                        ...n,
                        desc: n.description,
                        total: n.totalValue,
                        children: undefined
                    });
                    if (n.children) flatten(n.children);
                });
            };
            flatten(budgetTree);

            return {
                rhPremises: [],
                contractorData: { contracts: [] },
                supplyChainData: { orders: [] },
                budget: budgetFlat,
                masterPlanSheets: [],
                rdoData: rdoData,
                isLoaded: true,
                purchaseRequests: [],
                budgetGroups: [], // Maybe extract form budgetTree
                projectionData: [],
                rdoSheets: [],
                budgetSheets: [],
                financialEntries: financialEntries,
                visualManagement: visualMgmt,
                budgetTree: budgetTree,

                activeProjectId: projectId,
                activeProject: activeProject,
                consolidatedTree: BudgetService.getConsolidatedTree(budgetTree)
            };

        } catch (error) {
            console.error("Failed to fetch app data from Supabase", error);
            return this.getEmptyAppData();
        }
    }

    static getEmptyAppData(): AppData {
        return {
            rhPremises: [],
            contractorData: { contracts: [] },
            supplyChainData: { orders: [] },
            budget: [],
            masterPlanSheets: [],
            rdoData: [],
            isLoaded: false,
            projectionData: [],
            rdoSheets: [],
            budgetSheets: [],
            financialEntries: []
        };
    }

    // --- Visual Management (Supabase + Local) ---

    static async getVisualManagementData(projectId: string): Promise<any> {
        try {
            // Try Supabase first
            const { data, error } = await supabase
                .from('project_visual_management')
                .select('data')
                .eq('project_id', projectId)
                .single();

            if (data?.data) {
                // Update local cache
                await saveVisualManagement(data.data);
                return data.data;
            } else {
                // Fallback to local
                return await getVisualManagement();
            }
        } catch (error) {
            console.error("Error fetching VM data:", error);
            return await getVisualManagement();
        }
    }

    static async saveAppData(data: AppData): Promise<void> {
        if (data.visualManagement && data.activeProjectId) {
            console.log("Saving Visual Management data to Supabase...");

            // 1. Save Local
            await saveVisualManagement(data.visualManagement);

            // 2. Save Remote (Supabase)
            const { error } = await supabase
                .from('project_visual_management')
                .upsert({
                    project_id: data.activeProjectId,
                    data: data.visualManagement,
                    updated_at: new Date()
                }, { onConflict: 'project_id' });

            if (error) console.error("Supabase Save Error:", error);
            else console.log("Supabase Save Success");

        } else {
            console.warn("Save skipped: Missing VM data or Project ID");
        }
    }

    // --- DISBURSEMENT FORECAST (Previsão de Desembolso) ---

    static async getDisbursementForecast(projectId: string): Promise<any> {
        try {
            const { data, error } = await supabase
                .from('project_disbursement_forecast')
                .select('*')
                .eq('project_id', projectId)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
            return data || null;
        } catch (error) {
            console.error("Error fetching disbursement forecast:", error);
            return null;
        }
    }

    static async saveDisbursementForecast(projectId: string, data: {
        forecastData?: any;
        startingMonth?: string;
        budgetOverrides?: any;
        descriptionOverrides?: any;
        projectionLength?: number;
        initialRealized?: any;
    }): Promise<void> {
        const { error } = await supabase
            .from('project_disbursement_forecast')
            .upsert({
                project_id: projectId,
                forecast_data: data.forecastData || {},
                starting_month: data.startingMonth,
                budget_overrides: data.budgetOverrides || {},
                description_overrides: data.descriptionOverrides || {},
                projection_length: data.projectionLength || 12,
                initial_realized: data.initialRealized || {},
                updated_at: new Date()
            }, { onConflict: 'project_id' });

        if (error) console.error("Supabase Disbursement Forecast Save Error:", error);
    }

    // --- CASH FLOW DATA (Fluxo de Caixa Analítico) ---

    static async getCashFlowData(projectId: string): Promise<any> {
        try {
            const { data, error } = await supabase
                .from('project_cash_flow_data')
                .select('*')
                .eq('project_id', projectId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data || null;
        } catch (error) {
            console.error("Error fetching cash flow data:", error);
            return null;
        }
    }

    static async saveCashFlowData(projectId: string, commitments: any, closedMonth: string): Promise<void> {
        const { error } = await supabase
            .from('project_cash_flow_data')
            .upsert({
                project_id: projectId,
                commitments: commitments || {},
                closed_month: closedMonth,
                updated_at: new Date()
            }, { onConflict: 'project_id' });

        if (error) console.error("Supabase Cash Flow Save Error:", error);
    }

    // --- STRATEGY & BI (Estratégia) ---

    static async getStrategySnapshots(projectId: string): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('project_strategy_snapshots')
                .select('*')
                .eq('project_id', projectId)
                .order('date', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error fetching strategy snapshots:", error);
            return [];
        }
    }

    static async saveStrategySnapshot(projectId: string, snapshot: { description: string; data: any }): Promise<void> {
        const { error } = await supabase
            .from('project_strategy_snapshots')
            .insert({
                project_id: projectId,
                description: snapshot.description,
                data: snapshot.data
            });

        if (error) console.error("Supabase Strategy Snapshot Save Error:", error);
        else console.log("Strategy snapshot saved successfully");
    }

    static async getStrategyColors(projectId: string): Promise<any> {
        try {
            const { data, error } = await supabase
                .from('project_strategy_colors')
                .select('colors')
                .eq('project_id', projectId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data?.colors || { standard: '#10b981', realized: '#3b82f6', projected: '#f59e0b' };
        } catch (error) {
            console.error("Error fetching strategy colors:", error);
            return { standard: '#10b981', realized: '#3b82f6', projected: '#f59e0b' };
        }
    }

    static async saveStrategyColors(projectId: string, colors: any): Promise<void> {
        const { error } = await supabase
            .from('project_strategy_colors')
            .upsert({
                project_id: projectId,
                colors: colors,
                updated_at: new Date()
            }, { onConflict: 'project_id' });

        if (error) console.error("Supabase Strategy Colors Save Error:", error);
    }

    // --- AI ANALYSES (IA Generativa) ---

    static async getAIAnalyses(projectId: string): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('project_ai_analyses')
                .select('*')
                .eq('project_id', projectId)
                .order('date', { ascending: false })
                .limit(50); // Last 50 analyses

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error fetching AI analyses:", error);
            return [];
        }
    }

    static async saveAnalysis(projectId: string, analysis: { query: string; response: any }): Promise<void> {
        const { error } = await supabase
            .from('project_ai_analyses')
            .insert({
                project_id: projectId,
                query: analysis.query,
                response: analysis.response
            });

        if (error) console.error("Supabase AI Analysis Save Error:", error);
        else console.log("AI analysis saved successfully");
    }

    // Legacy wrappers - safe to keep as no-ops or implementation pending
    static async saveRhPremises(data: RHPremise[]): Promise<void> { }
    static async saveContracts(data: ContractBox[]): Promise<void> { }
    static async updateContract(contract: ContractBox): Promise<void> { }
    static async addContract(contract: ContractBox): Promise<void> { }
    static async updateOrder(order: SupplyChainBox): Promise<void> { }

    // ... other methods if needed
}
