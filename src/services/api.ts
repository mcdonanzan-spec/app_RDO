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

            console.log(`Loading CORE data for project ID: ${projectId}`);

            const [
                projects,
                financialEntries,
                visualMgmt,
                rhData,
                contractsData,
                supplyData,
                budgetCore,
                rdoCore,
                masterPlanData,
                budgetTree
            ] = await Promise.all([
                ProjectService.getProjects(),
                FinancialService.getEntries(projectId),
                ApiService.getVisualManagementData(projectId),
                ApiService.getCoreData(projectId, 'project_rh_data'),
                ApiService.getCoreData(projectId, 'project_contracts_data'),
                ApiService.getCoreData(projectId, 'project_supply_data'),
                ApiService.getCoreBudget(projectId),
                ApiService.getCoreRDO(projectId),
                ApiService.getCoreData(projectId, 'project_master_plan_data'),
                BudgetService.getBudgetTree(projectId)
            ]);

            const activeProject = projects.find(p => p.id === projectId);

            // Construct AppData from multiple sources
            return {
                isLoaded: true,
                activeProjectId: projectId,
                activeProject: activeProject,

                // Core Data
                rhPremises: rhData || [],
                contractorData: { contracts: contractsData || [] },
                supplyChainData: { orders: supplyData || [] },
                masterPlanSheets: masterPlanData || [],

                // Financials
                financialEntries: financialEntries,

                // Budget & RDO (From Core Tables)
                budget: budgetCore.data || [],
                budgetSheets: budgetCore.sheets || [],
                budgetTree: budgetTree || [],

                rdoData: rdoCore.data || [],
                rdoSheets: rdoCore.sheets || [],
                costSummary: rdoCore.costSummary || {},

                // Visual Management
                visualManagement: visualMgmt,

                // Legacy / Computed placeholders
                purchaseRequests: [],
                budgetGroups: [],
                projectionData: [],
                consolidatedTree: [] // can compute if needed
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
            budgetTree: [],
            consolidatedTree: [],
            masterPlanSheets: [],
            rdoData: [],
            rdoSheets: [],
            budgetSheets: [],
            financialEntries: [],
            visualManagement: {
                config: { towers: 4, floors: 12, aptsPerFloor: 8 },
                services: [],
                status: {},
                towerNames: [],
                serviceStatus: {}
            },
            isLoaded: false,
            projectionData: []
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

    static async saveVisualManagementData(projectId: string, data: any): Promise<void> {
        try {
            // Local Save (Legacy)
            await saveVisualManagement(data);

            // Supabase Save
            const { error } = await supabase
                .from('project_visual_management')
                .upsert({
                    project_id: projectId,
                    data: data,
                    updated_at: new Date()
                }, { onConflict: 'project_id' });

            if (error) console.error("Error saving Visual Management:", error);
        } catch (err) {
            console.error("Error in saveVisualManagementData:", err);
        }
    }

    static async saveAppData(data: AppData): Promise<void> {
        if (!data.activeProjectId) {
            console.error("Save skipped: Missing Project ID");
            return;
        }

        const pid = data.activeProjectId;
        console.log(`Saving App Data for Project: ${pid}`);

        const promises: Promise<any>[] = [];

        // 1. Visual Management
        if (data.visualManagement) {
            promises.push(this.saveVisualManagementData(pid, data.visualManagement));
        }

        // 2. Core Data Lists (JSONB)
        if (data.rhPremises) promises.push(this.saveCoreData(pid, 'project_rh_data', data.rhPremises));
        if (data.contractorData?.contracts) promises.push(this.saveCoreData(pid, 'project_contracts_data', data.contractorData.contracts));
        if (data.supplyChainData?.orders) promises.push(this.saveCoreData(pid, 'project_supply_data', data.supplyChainData.orders));
        if (data.masterPlanSheets) promises.push(this.saveCoreData(pid, 'project_master_plan_data', data.masterPlanSheets));

        // 3. Complex Core Data (Budget & RDO)
        if (data.budget) {
            promises.push(this.saveCoreBudget(pid, data.budget, data.budgetSheets));
        }
        if (data.rdoData) {
            promises.push(this.saveCoreRDO(pid, data.rdoData, data.rdoSheets, data.costSummary));
        }

        try {
            await Promise.all(promises);
            console.log("✅ All Core Data Saved to Supabase Successfully");
        } catch (err) {
            console.error("❌ Partial Error saving Core Data:", err);
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

    // --- CORE DATA HELPERS ---

    static async getCoreData(projectId: string, table: string): Promise<any> {
        const { data, error } = await supabase
            .from(table)
            .select('data')
            .eq('project_id', projectId)
            .single();
        if (error && error.code !== 'PGRST116') console.warn(`Fetch error for ${table}:`, error);
        return data?.data || null;
    }

    static async saveCoreData(projectId: string, table: string, jsonData: any): Promise<void> {
        const { error } = await supabase
            .from(table)
            .upsert({
                project_id: projectId,
                data: jsonData,
                updated_at: new Date()
            }, { onConflict: 'project_id' });
        if (error) console.error(`Error saving ${table}:`, error);
    }

    static async getCoreBudget(projectId: string): Promise<{ data: any[], sheets: any[] }> {
        const { data } = await supabase
            .from('project_budget_data')
            .select('data, sheets_data')
            .eq('project_id', projectId)
            .single();
        return { data: data?.data || [], sheets: data?.sheets_data || [] };
    }

    static async saveCoreBudget(projectId: string, budget: any[], sheets: any[] = []): Promise<void> {
        const { error } = await supabase
            .from('project_budget_data')
            .upsert({
                project_id: projectId,
                data: budget,
                sheets_data: sheets,
                updated_at: new Date()
            }, { onConflict: 'project_id' });
        if (error) console.error("Error saving Budget Core:", error);
    }

    static async getCoreRDO(projectId: string): Promise<{ data: any[], sheets: any[], costSummary: any }> {
        const { data } = await supabase
            .from('project_rdo_data')
            .select('data, sheets_data, cost_summary')
            .eq('project_id', projectId)
            .single();
        return {
            data: data?.data || [],
            sheets: data?.sheets_data || [],
            costSummary: data?.cost_summary || {}
        };
    }

    static async saveCoreRDO(projectId: string, rdoData: any[], sheets: any[] = [], summary: any = {}): Promise<void> {
        const { error } = await supabase
            .from('project_rdo_data')
            .upsert({
                project_id: projectId,
                data: rdoData,
                sheets_data: sheets,
                cost_summary: summary,
                updated_at: new Date()
            }, { onConflict: 'project_id' });
        if (error) console.error("Error saving RDO Core:", error);
    }

    // Legacy wrappers
    static async saveRhPremises(data: RHPremise[]): Promise<void> { }
    static async saveContracts(data: ContractBox[]): Promise<void> { }
    static async updateContract(contract: ContractBox): Promise<void> { }
    static async addContract(contract: ContractBox): Promise<void> { }
    static async updateOrder(order: SupplyChainBox): Promise<void> { }

    // ... other methods if needed
}
