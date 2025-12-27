import { AppData, ContractBox, RHPremise, SupplyChainBox } from '../../types';
import { db, checkIsLoaded, setLoaded } from './db';

// Debug API Key
console.log("API Key Status:", import.meta.env.VITE_API_KEY ? "Presente" : "Ausente");

export class ApiService {

    // Switch to LocalDB (Dexie) implementation
    static async getAppData(): Promise<AppData> {
        try {
            const [rhPremises, contracts, orders, budget, masterPlanSheets, rdoData, isLoaded, purchaseRequests, budgetGroups] = await Promise.all([
                db.rhPremises.toArray(),
                db.contracts.toArray(),
                db.orders.toArray(),
                db.budget.toArray(),
                db.masterPlanSheets.toArray(),
                db.rdoData.toArray(),
                checkIsLoaded(),
                db.purchaseRequests.toArray(),
                db.budgetGroups.toArray()
            ]);

            return {
                rhPremises,
                contractorData: { contracts },
                supplyChainData: { orders },
                budget,
                masterPlanSheets,
                rdoData,
                isLoaded,
                purchaseRequests,
                budgetGroups,
                projectionData: [],
                rdoSheets: [],
                budgetSheets: []
            };
        } catch (error) {
            console.error("Failed to fetch app data from LocalDB", error);
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
                budgetSheets: []
            };
        }
    }

    static async saveAppData(data: AppData): Promise<void> {
        // Parallel saving is safe in IndexedDB and much faster
        console.time("saveAppData");

        await db.transaction('rw', [db.rhPremises, db.contracts, db.orders, db.budget, db.masterPlanSheets, db.rdoData, db.meta, db.purchaseRequests, db.budgetGroups], async () => {
            // Clear existing data to ensure full sync (or implement smart diffing if needed)
            // For bulk loads, clear+add is often fastest in IDB unless items are very large

            // We use bulkPut for upsert behavior logic if we had keys, but full replacement is safer for "files loaded" state
            // Let's clear and bulkAdd for the main lists to ensure consistency with the "Sheet" nature of the input

            await Promise.all([
                db.rhPremises.clear().then(() => db.rhPremises.bulkAdd(data.rhPremises)),
                db.contracts.clear().then(() => db.contracts.bulkAdd(data.contractorData.contracts)),
                db.orders.clear().then(() => db.orders.bulkAdd(data.supplyChainData.orders)),
                db.budget.clear().then(() => db.budget.bulkAdd(data.budget)),
                db.masterPlanSheets.clear().then(() => db.masterPlanSheets.bulkAdd(data.masterPlanSheets)),
                data.purchaseRequests ? db.purchaseRequests.clear().then(() => db.purchaseRequests.bulkAdd(data.purchaseRequests!)) : Promise.resolve(),
                data.budgetGroups ? db.budgetGroups.clear().then(() => db.budgetGroups.bulkAdd(data.budgetGroups!)) : Promise.resolve()
            ]);

            // Specialized handling for RDO to prevent UI freezing on massive datasets?
            // IndexedDB is fast enough for 10k items.
            if (data.rdoData && data.rdoData.length > 0) {
                console.log(`Saving ${data.rdoData.length} RDO items to LocalDB...`);
                await db.rdoData.clear();
                await db.rdoData.bulkAdd(data.rdoData);
            }

            // Set loaded flag
            await setLoaded(true);
        });

        console.timeEnd("saveAppData");
        console.log("Data saved successfully to LocalDB");
    }

    static async saveRhPremises(data: RHPremise[]): Promise<void> {
        await db.transaction('rw', db.rhPremises, async () => {
            await db.rhPremises.clear();
            await db.rhPremises.bulkAdd(data);
        });
    }

    static async saveContracts(data: ContractBox[]): Promise<void> {
        await db.transaction('rw', db.contracts, async () => {
            await db.contracts.clear();
            await db.contracts.bulkAdd(data);
        });
    }

    static async updateContract(contract: ContractBox): Promise<void> {
        await db.contracts.put(contract);
    }

    static async addContract(contract: ContractBox): Promise<void> {
        await db.contracts.put(contract);
    }

    static async updateOrder(order: SupplyChainBox): Promise<void> {
        await db.orders.put(order);
    }
}
