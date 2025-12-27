import Dexie, { Table } from 'dexie';
import { RHPremise, ContractBox, SupplyChainBox, BudgetLine, SheetData, RDOItem } from '../../types';

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
            financialDocuments: 'id, supplier, purchaseRequestId'
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
