
import { db, setLoaded } from './src/services/db.ts';
import { faker } from '@faker-js/faker';
import {
    BudgetNode,
    FinancialEntry,
    Supplier,
    BudgetVersion,
    RHPremise,
    ContractBox,
    SupplyChainBox,
    RDOItem,
    BudgetLine
} from './types';

function generateMockData() {
    console.log("Starting mock data generation...");

    // 1. Suppliers
    const suppliers: Supplier[] = Array.from({ length: 15 }).map(() => ({
        id: faker.string.uuid(),
        razaoSocial: faker.company.name(),
        cnpj: faker.string.numeric(14)
    }));

    // 2. Budget Structure (Tree) -> Simplified for visual coherence
    const budgetTree: BudgetNode[] = [
        {
            id: '1', code: '01', description: 'CUSTOS DIRETOS', level: 1, type: 'GROUP', totalValue: 0, budgetInitial: 12500000,
            budgetCurrent: 12500000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [
                {
                    id: '11', code: '01.01', description: 'INFRAESTRUTURA', level: 2, type: 'GROUP', totalValue: 0, budgetInitial: 4500000,
                    budgetCurrent: 4500000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [
                        { id: '111', code: '01.01.01', description: 'TERRAPLENAGEM', level: 3, type: 'ITEM', itemType: 'ST', totalValue: 1500000, budgetInitial: 1500000, budgetCurrent: 1500000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [] },
                        { id: '112', code: '01.01.02', description: 'FUNDAÇÕES', level: 3, type: 'ITEM', itemType: 'MT', totalValue: 3000000, budgetInitial: 3000000, budgetCurrent: 3000000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [] }
                    ]
                },
                {
                    id: '12', code: '01.02', description: 'ESTRUTURA', level: 2, type: 'GROUP', totalValue: 0, budgetInitial: 8000000,
                    budgetCurrent: 8000000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [
                        { id: '121', code: '01.02.01', description: 'CONCRETO', level: 3, type: 'ITEM', itemType: 'MT', totalValue: 5000000, budgetInitial: 5000000, budgetCurrent: 5000000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [] },
                        { id: '122', code: '01.02.02', description: 'AÇO', level: 3, type: 'ITEM', itemType: 'MT', totalValue: 3000000, budgetInitial: 3000000, budgetCurrent: 3000000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [] }
                    ]
                }
            ]
        },
        {
            id: '2', code: '02', description: 'CUSTOS INDIRETOS', level: 1, type: 'GROUP', totalValue: 0, budgetInitial: 2500000,
            budgetCurrent: 2500000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: []
        }
    ];

    // Helper to flatten specifically for 'Allocations' logic
    const budgetItems = [
        { code: '01.01.01', desc: 'TERRAPLENAGEM' },
        { code: '01.01.02', desc: 'FUNDAÇÕES' },
        { code: '01.02.01', description: 'CONCRETO' },
        { code: '01.02.02', description: 'AÇO' }
    ];

    // 3. Financial Entries (NFs)
    const financialEntries: FinancialEntry[] = Array.from({ length: 25 }).map(() => {
        const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
        const totalValue = parseFloat(faker.finance.amount({ min: 1000, max: 50000, dec: 2 }));
        const issueDate = faker.date.recent({ days: 60 }).toISOString().split('T')[0];

        return {
            id: faker.string.uuid(),
            documentNumber: faker.string.numeric(6),
            supplier: supplier.razaoSocial,
            description: faker.commerce.productName(),
            issueDate: issueDate,
            totalValue: totalValue,
            status: faker.helpers.arrayElement(['APPROVED', 'PAID', 'DRAFT']),
            allocations: [{
                id: faker.string.uuid(),
                budgetGroupCode: budgetItems[Math.floor(Math.random() * budgetItems.length)].code,
                costType: 'MT',
                value: totalValue,
                description: 'Alocação Padrão'
            }],
            installments: [
                {
                    id: faker.string.uuid(),
                    number: 1,
                    dueDate: faker.date.future({ years: 0.1, refDate: issueDate }).toISOString().split('T')[0],
                    value: totalValue,
                    status: 'PENDING'
                }
            ]
        };
    });

    // 4. Update Database
    db.transaction('rw', db.financialEntries, db.suppliers, db.budget, async () => {
        await db.financialEntries.clear();
        await db.financialEntries.bulkAdd(financialEntries);

        // Persist tree (optional, may rely on appData structure)
        localStorage.setItem('budgetTree', JSON.stringify(budgetTree));

        await setLoaded(true);
        console.log("Mock data injected!");
    }).catch(e => console.error("Error injecting mock data", e));
}

generateMockData();
