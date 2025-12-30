
import { db, setLoaded } from './db';
import { faker } from '@faker-js/faker';
import {
    BudgetNode,
    FinancialEntry,
    Supplier,
    ContractBox,
    SupplyChainBox,
    BudgetLine,
    RHPremise,
    RDOItem
} from '../../types';

export async function generateMockData() {
    console.log("Starting mock data generation...");

    // 1. Suppliers
    const suppliers: Supplier[] = Array.from({ length: 15 }).map(() => ({
        id: faker.string.uuid(),
        razaoSocial: faker.company.name(),
        cnpj: faker.string.numeric(14)
    }));

    // 2. Budget Data (Flat & Tree)
    // We need flat lines for the 'budget' table and tree for 'budgetTree'
    const budgetLines: BudgetLine[] = [
        // Groups
        { id: '1', code: '01', desc: 'CUSTOS DIRETOS', unit: '', qty: 1, unitPrice: 0, total: 12500000, type: 'mt', originSheet: 'Master', isGroup: true },
        { id: '11', code: '01.01', desc: 'INFRAESTRUTURA', unit: '', qty: 1, unitPrice: 0, total: 4500000, type: 'mt', originSheet: 'Master', isGroup: true },
        { id: '111', code: '01.01.01', desc: 'TERRAPLENAGEM', unit: 'VB', qty: 1, unitPrice: 1500000, total: 1500000, type: 'st', originSheet: 'Master', isGroup: false },
        { id: '112', code: '01.01.02', desc: 'FUNDAÇÕES', unit: 'UN', qty: 100, unitPrice: 30000, total: 3000000, type: 'mt', originSheet: 'Master', isGroup: false },

        { id: '12', code: '01.02', desc: 'ESTRUTURA', unit: '', qty: 1, unitPrice: 0, total: 8000000, type: 'mt', originSheet: 'Master', isGroup: true },
        { id: '121', code: '01.02.01', desc: 'CONCRETO', unit: 'M3', qty: 5000, unitPrice: 1000, total: 5000000, type: 'mt', originSheet: 'Master', isGroup: false },
        { id: '122', code: '01.02.02', desc: 'AÇO', unit: 'KG', qty: 300000, unitPrice: 10, total: 3000000, type: 'mt', originSheet: 'Master', isGroup: false },

        { id: '2', code: '02', desc: 'CUSTOS INDIRETOS', unit: '', qty: 1, unitPrice: 0, total: 2500000, type: 'st', originSheet: 'Master', isGroup: true },
        { id: '21', code: '02.01', desc: 'EQUIPE DE OBRA', unit: 'VB', qty: 1, unitPrice: 1500000, total: 1500000, type: 'st', originSheet: 'Master', isGroup: false },
    ];

    // Budget Tree Structure for Financial View
    const budgetTree: BudgetNode[] = [
        {
            id: '1', code: '01', description: 'CUSTOS DIRETOS', level: 1, type: 'GROUP', totalValue: 0, budgetInitial: 12500000, budgetCurrent: 12500000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [
                {
                    id: '11', code: '01.01', description: 'INFRAESTRUTURA', level: 2, type: 'GROUP', totalValue: 0, budgetInitial: 4500000, budgetCurrent: 4500000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [
                        { id: '111', code: '01.01.01', description: 'TERRAPLENAGEM', level: 3, type: 'ITEM', itemType: 'ST', totalValue: 1500000, budgetInitial: 1500000, budgetCurrent: 1500000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [] },
                        { id: '112', code: '01.01.02', description: 'FUNDAÇÕES', level: 3, type: 'ITEM', itemType: 'MT', totalValue: 3000000, budgetInitial: 3000000, budgetCurrent: 3000000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [] }
                    ]
                },
                {
                    id: '12', code: '01.02', description: 'ESTRUTURA', level: 2, type: 'GROUP', totalValue: 0, budgetInitial: 8000000, budgetCurrent: 8000000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [
                        { id: '121', code: '01.02.01', description: 'CONCRETO', level: 3, type: 'ITEM', itemType: 'MT', totalValue: 5000000, budgetInitial: 5000000, budgetCurrent: 5000000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [] },
                        { id: '122', code: '01.02.02', description: 'AÇO', level: 3, type: 'ITEM', itemType: 'MT', totalValue: 3000000, budgetInitial: 3000000, budgetCurrent: 3000000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [] }
                    ]
                }
            ]
        },
        {
            id: '2', code: '02', description: 'CUSTOS INDIRETOS', level: 1, type: 'GROUP', totalValue: 0, budgetInitial: 2500000, budgetCurrent: 2500000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [
                { id: '21', code: '02.01', description: 'EQUIPE DE OBRA', level: 2, type: 'ITEM', itemType: 'ST', totalValue: 1500000, budgetInitial: 1500000, budgetCurrent: 1500000, realizedRDO: 0, realizedFinancial: 0, committed: 0, children: [] }
            ]
        }
    ];

    // 3. Financial Entries (NFs)
    const financialEntries: FinancialEntry[] = Array.from({ length: 45 }).map(() => {
        const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
        const totalValue = parseFloat(faker.finance.amount({ min: 5000, max: 150000, dec: 2 }));
        const issueDate = faker.date.recent({ days: 90 }).toISOString().split('T')[0];

        // Pick an item to allocate to
        const possibleItems = ['01.01.01', '01.01.02', '01.02.01', '01.02.02', '02.01'];
        const wbs = faker.helpers.arrayElement(possibleItems);
        const wbsDesc = budgetLines.find(b => b.code === wbs)?.desc || 'Item';

        return {
            id: faker.string.uuid(),
            documentNumber: faker.string.numeric(6),
            supplier: supplier.razaoSocial,
            description: `NF MATERIAL - ${faker.commerce.productMaterial()}`,
            issueDate: issueDate,
            totalValue: totalValue,
            status: faker.helpers.arrayElement(['APPROVED', 'PAID', 'DRAFT']),
            allocations: [{
                id: faker.string.uuid(),
                budgetGroupCode: wbs,
                costType: 'MT',
                value: totalValue,
                description: wbsDesc
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

    // 4. Contracts
    const contracts: ContractBox[] = suppliers.slice(0, 5).map(sup => ({
        id: faker.string.uuid(),
        supplier: sup.razaoSocial,
        totalValue: 500000,
        initialValue: 500000,
        additives: 0,
        measuredTotal: 120000,
        balance: 380000,
        budgetGroup: '01.02.01',
        measurements: []
    }));

    // 5. Supply Chain Orders
    const orders: SupplyChainBox[] = suppliers.slice(5, 10).map(sup => ({
        id: faker.string.uuid(),
        supplier: sup.razaoSocial,
        description: `Pedido de Compra - ${faker.commerce.productName()}`,
        status: faker.helpers.arrayElement(['total', 'partial', 'programmed']),
        totalValue: 25000,
        budgetGroup: '01.02.02',
        invoices: []
    }));

    // 6. RH Premises
    const rhPremises: RHPremise[] = [
        { id: 1, role: 'Engenheiro Civil', baseSalary: 12000, chargesPct: 80, foodCost: 800, transportCost: 400, housingCost: 0, quantity: 1 },
        { id: 2, role: 'Mestre de Obras', baseSalary: 8000, chargesPct: 80, foodCost: 800, transportCost: 400, housingCost: 0, quantity: 2 },
        { id: 3, role: 'Pedreiro', baseSalary: 3500, chargesPct: 80, foodCost: 800, transportCost: 200, housingCost: 0, quantity: 15 }
    ];

    // 7. Mock RDO Data (Realized) - Aligned with Financial Entries to avoid confusion
    const rdoSummary: Record<string, number> = {};
    financialEntries.forEach(fe => {
        fe.allocations.forEach(al => {
            const groupName = budgetLines.find(b => b.code === al.budgetGroupCode)?.desc || 'Geral';
            rdoSummary[groupName] = (rdoSummary[groupName] || 0) + al.value;
        });
    });

    const rdoData: RDOItem[] = Object.entries(rdoSummary).map(([group, value]) => ({
        id: faker.string.uuid(),
        service: `RESUMO ${group}`,
        group: group,
        accumulatedValue: value, // Now matches the sum of NFs for that group
        monthlyValue: value * 0.2,
        date: new Date().toISOString(),
        status: 'concluido',
        isConstructionCost: true
    }));

    // 8. Purchase Requests (Fluxo de Compras)
    const purchaseStatuses = ['Aguardando Almoxarifado', 'Em Análise Engenharia', 'Aguardando Gerente', 'Aprovado', 'No TOTVS', 'Finalizado'] as const;
    const priorities = ['Normal', 'Urgente'] as const;

    const purchaseRequests = Array.from({ length: 25 }).map((_, i) => ({
        id: faker.string.uuid(),
        requestId: `RPC-${2024000 + i}`,
        description: `Aquisição de ${faker.commerce.productName()}`,
        date: faker.date.recent({ days: 30 }).toISOString().split('T')[0],
        requester: faker.person.fullName(),
        priority: faker.helpers.arrayElement(priorities),
        status: faker.helpers.arrayElement(purchaseStatuses),
        budgetGroupCode: faker.helpers.arrayElement(['01.01.01', '01.01.02', '01.02.01', '02.01']),
        items: [
            {
                id: faker.string.uuid(),
                description: faker.commerce.productMaterial(),
                quantityRequested: faker.number.int({ min: 10, max: 1000 }),
                unit: faker.helpers.arrayElement(['UN', 'M3', 'KG', 'M']),
                observation: faker.lorem.sentence()
            }
        ],
        history: []
    }));

    // 9. Visual Management Data (Gestão à Vista)
    const visualConfig = {
        towers: 4,
        floors: 12,
        aptsPerFloor: 8
    };

    const visualServices = [
        { id: 's1', name: 'Alvenaria', color: '#ef4444', order: 1 },
        { id: 's2', name: 'Reboco', color: '#f97316', order: 2 },
        { id: 's3', name: 'Contrapiso', color: '#eab308', order: 3 },
        { id: 's4', name: 'Cerâmica', color: '#22c55e', order: 4 },
        { id: 's5', name: 'Pintura', color: '#3b82f6', order: 5 }
    ];

    const visualStatus: any = {};
    for (let t = 1; t <= visualConfig.towers; t++) {
        for (let f = 0; f <= visualConfig.floors; f++) { // 0 = Térreo
            for (let a = 1; a <= visualConfig.aptsPerFloor; a++) {
                const unitId = `T${t}-F${f}-A${a}`;
                visualStatus[unitId] = {};
                visualServices.forEach(srv => {
                    // Random status distribution based on service order (waterfall effect)
                    const rnd = Math.random();
                    let status = 'pending';

                    // Simulate progress: Lower services are improved
                    const progressBias = (6 - srv.order) * 0.15; // Earlier services more likely done

                    if (rnd < progressBias) status = 'completed';
                    else if (rnd < progressBias + 0.2) status = 'started';

                    visualStatus[unitId][srv.id] = status;
                });
            }
        }
    }

    const visualManagementData = {
        config: visualConfig,
        services: visualServices,
        status: visualStatus,
        towerNames: ['A', 'B', 'C', 'D']
    };

    // Transaction to Clear & Fill
    try {
        await db.transaction('rw',
            [
                db.financialEntries, db.budget, db.contracts, db.orders, db.rhPremises,
                db.meta, db.rdoData, db.masterPlanSheets, db.purchaseRequests,
                db.budgetGroups, db.visualManagement, db.financialDocuments
            ],
            async () => {

                // Clear ALL tables to ensure no stale data remains
                await db.financialEntries.clear();
                await db.budget.clear();
                await db.contracts.clear();
                await db.orders.clear();
                await db.rhPremises.clear();
                await db.rdoData.clear();
                await db.masterPlanSheets.clear();
                await db.purchaseRequests.clear();
                await db.budgetGroups.clear();
                await db.visualManagement.clear();
                await db.financialDocuments.clear();

                // Bulk Add New Mock Data
                await db.budget.bulkAdd(budgetLines);
                await db.contracts.bulkAdd(contracts);
                await db.orders.bulkAdd(orders);
                await db.rhPremises.bulkAdd(rhPremises);
                await db.rdoData.bulkAdd(rdoData);
                await db.purchaseRequests.bulkAdd(purchaseRequests);
                await db.visualManagement.put({ id: 'main', data: visualManagementData });

                await db.table('financialEntries').bulkAdd(financialEntries).catch(err => console.warn("Table financialEntries might not exist", err));

                // Save Tree to localStorage for simple persistence of the hierarchical view
                localStorage.setItem('budgetTree', JSON.stringify(budgetTree));

                await setLoaded(true);
            });

        console.log("Mock data injected successfully!");
        alert("Dados de teste gerados com sucesso! Recarregue a página.");
        window.location.reload();

    } catch (e) {
        console.error("Error injecting mock data", e);
        alert("Erro ao gerar dados: " + e);
    }
}
