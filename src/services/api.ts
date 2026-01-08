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
                getVisualManagement()
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

    static async saveAppData(data: AppData): Promise<void> {
        if (data.visualManagement) {
            console.log("Saving Visual Management data...");
            await saveVisualManagement(data.visualManagement);
        } else {
            console.warn("Legacy saveAppData called without Visual Management data. This is deprecated in Supabase mode.");
        }
    }

    // Legacy wrappers - safe to keep as no-ops or implementation pending
    static async saveRhPremises(data: RHPremise[]): Promise<void> { }
    static async saveContracts(data: ContractBox[]): Promise<void> { }
    static async updateContract(contract: ContractBox): Promise<void> { }
    static async addContract(contract: ContractBox): Promise<void> { }
    static async updateOrder(order: SupplyChainBox): Promise<void> { }

    // ... other methods if needed
}
