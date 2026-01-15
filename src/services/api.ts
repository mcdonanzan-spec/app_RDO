import { AppData, ContractBox, RHPremise, SupplyChainBox } from '../../types';
import { supabase } from './supabase';
import { ProjectService } from './projectService';
import { FinancialService } from './financialService';
import { BudgetService } from './budgetService';
import { SupplierService } from './supplierService';
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
                budgetTree,
                suppliers,
                purchaseRequests,
                itemCatalog,
                budgetVersions
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
                BudgetService.getBudgetTree(projectId),
                SupplierService.getSuppliers(projectId),
                ApiService.getPurchaseRequests(projectId),
                ApiService.getItemCatalog(projectId),
                ApiService.getBudgetVersions(projectId)
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
                suppliers: suppliers,

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
                purchaseRequests: purchaseRequests || [],
                budgetGroups: [],
                projectionData: [],
                consolidatedTree: [], // can compute if needed
                totvsItems: itemCatalog || [],
                budgetVersions: budgetVersions || []
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
            suppliers: [],
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
                return data.data;
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error fetching VM data:", error);
            return null;
        }
    }

    static async saveVisualManagementData(projectId: string, data: any): Promise<void> {
        try {
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

    // --- PURCHASE FLOW (Solicitações & Catálogo) ---

    static async getPurchaseRequests(projectId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('project_purchase_requests')
            .select('*')
            .eq('project_id', projectId)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Error fetching purchase requests:', error);
            return [];
        }

        // Deduplicate by request_id (keeping the most recently updated)
        const uniqueMap = new Map();
        (data || []).forEach(row => {
            if (!uniqueMap.has(row.request_id)) {
                uniqueMap.set(row.request_id, {
                    id: row.id,
                    requestId: row.request_id,
                    description: row.description,
                    requester: row.requester,
                    priority: row.priority,
                    status: row.status,
                    date: row.date,
                    items: row.items || [],
                    history: row.history || [],
                    budgetGroupCode: row.budget_group_code,
                    totvsOrderNumber: row.totvs_order_number
                });
            }
        });

        return Array.from(uniqueMap.values());
    }

    static async savePurchaseRequest(projectId: string, request: any): Promise<void> {
        const payload = {
            project_id: projectId,
            request_id: request.requestId,
            description: request.description,
            requester: request.requester,
            priority: request.priority,
            status: request.status,
            date: request.date,
            items: request.items,
            history: request.history,
            budget_group_code: request.budgetGroupCode,
            totvs_order_number: request.totvsOrderNumber,
            updated_at: new Date()
        };

        const { error } = await supabase
            .from('project_purchase_requests')
            .upsert(payload, { onConflict: 'project_id, request_id' });

        if (error) console.error("Error saving Purchase Request:", error);
    }

    static async saveAllPurchaseRequests(projectId: string, requests: any[]): Promise<void> {
        if (!requests || requests.length === 0) return;

        const batch = requests.map(req => ({
            project_id: projectId,
            request_id: req.requestId,
            description: req.description,
            requester: req.requester,
            priority: req.priority,
            status: req.status,
            date: req.date,
            items: req.items,
            history: req.history,
            budget_group_code: req.budgetGroupCode,
            totvs_order_number: req.totvsOrderNumber,
            updated_at: new Date()
        }));

        const { error } = await supabase
            .from('project_purchase_requests')
            .upsert(batch, { onConflict: 'project_id, request_id' });

        if (error) console.error("Error saving All Purchase Requests:", error);
    }

    static async deletePurchaseRequest(projectId: string, requestId: string): Promise<void> {
        const { error } = await supabase
            .from('project_purchase_requests')
            .delete()
            .eq('project_id', projectId)
            .eq('request_id', requestId);

        if (error) throw error;
    }

    static async getItemCatalog(projectId: string): Promise<any[]> {
        let allItems: any[] = [];
        let page = 0;
        const size = 1000;

        while (true) {
            const { data, error } = await supabase
                .from('project_item_catalog')
                .select('code, description, unit')
                .eq('project_id', projectId)
                .range(page * size, (page + 1) * size - 1);

            if (error) {
                console.error('Error fetching catalog:', error);
                break;
            }

            if (!data || data.length === 0) break;

            allItems = allItems.concat(data);

            if (data.length < size) break;
            page++;
        }

        return allItems;
    }

    static async saveItemCatalog(projectId: string, items: any[]): Promise<void> {
        // 1. Delete all for project (simple sync)
        await supabase.from('project_item_catalog').delete().eq('project_id', projectId);

        if (items.length === 0) return;

        // 2. Insert all (chunks of 1000 to be safe)
        const chunk = 1000;
        for (let i = 0; i < items.length; i += chunk) {
            const batch = items.slice(i, i + chunk).map(item => ({
                project_id: projectId,
                code: item.code,
                description: item.description,
                unit: item.unit
            }));

            const { error } = await supabase.from('project_item_catalog').insert(batch);
            if (error) console.error('Error saving catalog batch:', error);
        }
    }

    static async saveAppData(allData: AppData, partial?: Partial<AppData>): Promise<void> {
        if (!allData.activeProjectId) {
            console.error("Save skipped: Missing Project ID");
            return;
        }

        const pid = allData.activeProjectId;
        const target = partial || allData; // If partial is provided, we only save those keys. Otherwise save all.

        console.log(`Saving App Data for Project: ${pid}`);

        const promises: Promise<any>[] = [];

        // 1. Visual Management
        if (target.visualManagement) {
            promises.push(this.saveVisualManagementData(pid, allData.visualManagement));
        }

        // 2. Core Data Lists (JSONB)
        if (target.rhPremises) promises.push(this.saveCoreData(pid, 'project_rh_data', allData.rhPremises));
        if (target.contractorData?.contracts) promises.push(this.saveCoreData(pid, 'project_contracts_data', allData.contractorData.contracts));
        if (target.supplyChainData?.orders) promises.push(this.saveCoreData(pid, 'project_supply_data', allData.supplyChainData.orders));
        if (target.masterPlanSheets) promises.push(this.saveCoreData(pid, 'project_master_plan_data', allData.masterPlanSheets));

        // 3. Complex Core Data (Budget & RDO)
        if (target.budget || target.budgetSheets) {
            promises.push(this.saveCoreBudget(pid, allData.budget, allData.budgetSheets));
        }
        if (target.rdoData || target.rdoSheets) {
            promises.push(this.saveCoreRDO(pid, allData.rdoData, allData.rdoSheets, allData.costSummary));
        }

        // 4. Purchase Flow
        if (target.purchaseRequests) {
            promises.push(this.saveAllPurchaseRequests(pid, allData.purchaseRequests!));
        }

        // 5. Item Catalog
        if (target.totvsItems && target.totvsItems.length > 0) {
            promises.push(this.saveItemCatalog(pid, allData.totvsItems!));
        }

        try {
            await Promise.all(promises);
            console.log("✅ Changes Saved to Supabase Successfully");
        } catch (err) {
            console.error("❌ Partial Error saving Data:", err);
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

    static async deleteAIAnalysis(analysisId: string): Promise<void> {
        const { error } = await supabase
            .from('project_ai_analyses')
            .delete()
            .eq('id', analysisId);

        if (error) throw error;
    }

    // --- BUDGET VERSIONS ---

    static async getBudgetVersions(projectId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('project_budget_versions')
            .select('*')
            .eq('project_id', projectId)
            .order('version', { ascending: true });

        if (error) {
            console.error("Error fetching budget versions:", error);
            return [];
        }

        return data.map((row: any) => ({
            version: row.version,
            createdAt: row.created_at,
            description: row.description,
            tree: row.tree_data,
            totalValue: Number(row.total_value)
        }));
    }

    static async saveBudgetVersion(projectId: string, snapshot: any): Promise<void> {
        const { error } = await supabase
            .from('project_budget_versions')
            .insert({
                project_id: projectId,
                version: snapshot.version,
                created_at: snapshot.createdAt,
                description: snapshot.description,
                tree_data: snapshot.tree,
                total_value: snapshot.totalValue
            });

        if (error) {
            console.error("Supabase Budget Version Save Error:", error);
            throw error;
        } else {
            console.log(`Budget Version ${snapshot.version} saved successfully.`);
        }
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
