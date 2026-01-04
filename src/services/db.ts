import Dexie, { Table } from 'dexie';
import { RHPremise, ContractBox, SupplyChainBox, BudgetLine, SheetData, RDOItem, FinancialEntry, SavedAnalysis } from '../../types';

export class ConstructionDB extends Dexie {
    rhPremises!: Table<RHPremise, number>;
    contracts!: Table<ContractBox, string>;
    orders!: Table<SupplyChainBox, string>;
    budget!: Table<BudgetLine, string | number>; // Use generated keys if needed
    masterPlanSheets!: Table<SheetData, string>;
    rdoData!: Table<RDOItem, string>;
    meta!: Table<{ key: string, value: any }, string>;
    visualManagement!: Table<{ id: string, data: any }, string>;
    purchaseRequests!: Table<any, string>; // Typing 'any' for now to avoid circular deps if types not updated perfectly or PurchaseRequest
    budgetGroups!: Table<any, string>;
    financialDocuments!: Table<any, string>;
    financialEntries!: Table<FinancialEntry, string>;
    savedAnalyses!: Table<SavedAnalysis, number>;
    strategySnapshots!: Table<any, number>;

    constructor() {
        super('ConstructionDB');
        this.version(1).stores({
            rhPremises: '++id, role',
            contracts: 'id, supplier',
            orders: 'id, supplier',
            budget: '++id, code, desc', // Index code for lookups
            masterPlanSheets: 'id',
            rdoData: 'id, date, status',
            meta: 'key'
        });

        // Upgrade for Visual Management
        this.version(2).stores({
            visualManagement: 'id'
        });

        // Version 3: Supply Chain & Financials
        this.version(3).stores({
            purchaseRequests: 'id, requestId, status, budgetGroupCode',
            budgetGroups: 'id, code, type',
            financialDocuments: 'id, supplier, purchaseRequestId',
            financialEntries: 'id, supplier, status, date'
        });

        // Version 4: Saved Analyses
        this.version(4).stores({
            savedAnalyses: '++id, date'
        });

        // Version 5: Strategy Snapshots
        this.version(5).stores({
            strategySnapshots: '++id, date'
        });
    }
}

export const db = new ConstructionDB();

// Helper to check load state
export const checkIsLoaded = async () => {
    const meta = await db.meta.get('isLoaded');
    return !!meta?.value;
};

export const setLoaded = async (loaded: boolean) => {
    await db.meta.put({ key: 'isLoaded', value: loaded });
};

export const getVisualManagement = async () => {
    const record = await db.visualManagement.get('main');
    return record?.data;
};

export const saveVisualManagement = async (data: any) => {
    await db.visualManagement.put({ id: 'main', data });
};

export const initializeVisualManagementDefaults = async () => {
    const existing = await db.visualManagement.get('main');
    if (!existing) {
        const defaultData = {
            config: { towers: 4, floors: 12, aptsPerFloor: 8 },
            services: [
                { id: 'S1', name: 'Fundação', color: '#94a3b8', order: 1 },
                { id: 'S2', name: 'Alvenaria', color: '#3b82f6', order: 2 },
                { id: 'S3', name: 'Elétrica', color: '#f59e0b', order: 3 },
                { id: 'S4', name: 'Hidráulica', color: '#0ea5e9', order: 4 },
                { id: 'S5', name: 'Pintura', color: '#ec4899', order: 5 },
                { id: 'S6', name: 'Acabamento', color: '#10b981', order: 6 },
            ],
            status: {},
            foundationData: {},
            unitProgress: {},
            towerNames: ['A', 'B', 'C', 'D'],
            legendColors: { pending: '#e2e8f0', started: '#3b82f6', completed: '#10b981' },
            serviceStatus: {}
        };
        await db.visualManagement.put({ id: 'main', data: defaultData });
        console.log('✅ Visual Management initialized with default config: 4 towers, 12 floors, 8 apts/floor');
    }
};

