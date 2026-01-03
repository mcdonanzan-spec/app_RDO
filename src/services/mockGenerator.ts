
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
    // 2. Budget Data (Deep Nesting as per Excel)
    const budgetLines: BudgetLine[] = [
        { id: 'b01', code: '01', desc: 'CUSTOS DE CONSTRUÇÃO', unit: '', qty: 0, unitPrice: 0, total: 53670434.74, type: 'mt', originSheet: 'Master', isGroup: true },

        { id: 'b01.01', code: '01.01', desc: 'FUNDAÇÃO', unit: '', qty: 0, unitPrice: 0, total: 2897999.08, type: 'mt', originSheet: 'Master', isGroup: true },
        { id: 'b01.01.01', code: '01.01.01', desc: 'SERVIÇOS PRELIMINARES', unit: '', qty: 0, unitPrice: 0, total: 980221.99, type: 'mt', originSheet: 'Master', isGroup: true },
        { id: 'b01.01.01.MT', code: '01.01.01.MT', desc: 'MATERIAL', unit: 'VB', qty: 1, unitPrice: 129463.08, total: 129463.08, type: 'mt', originSheet: 'Master', isGroup: false },
        { id: 'b01.01.01.ST', code: '01.01.01.ST', desc: 'SERVIÇO DE TERCEIROS', unit: 'VB', qty: 1, unitPrice: 850758.91, total: 850758.91, type: 'st', originSheet: 'Master', isGroup: false },

        { id: 'b01.01.02', code: '01.01.02', desc: 'ESTACAS / TRADO / TUBULÃO', unit: '', qty: 0, unitPrice: 0, total: 911671.62, type: 'mt', originSheet: 'Master', isGroup: true },
        { id: 'b01.01.02.MT', code: '01.01.02.MT', desc: 'MATERIAL', unit: 'VB', qty: 1, unitPrice: 634806.62, total: 634806.62, type: 'mt', originSheet: 'Master', isGroup: false },
        { id: 'b01.01.02.ST', code: '01.01.02.ST', desc: 'SERVIÇO DE TERCEIROS', unit: 'VB', qty: 1, unitPrice: 236491.00, total: 236491.00, type: 'st', originSheet: 'Master', isGroup: false },
        { id: 'b01.01.02.EQ', code: '01.01.02.EQ', desc: 'EQUIPAMENTOS', unit: 'VB', qty: 1, unitPrice: 40374.00, total: 40374.00, type: 'mt', originSheet: 'Master', isGroup: false },

        { id: 'b01.01.03', code: '01.01.03', desc: 'BLOCOS / CINTAMENTOS / LAJE', unit: 'VB', qty: 1, unitPrice: 1006105.47, total: 1006105.47, type: 'st', originSheet: 'Master', isGroup: false },

        { id: 'b01.02', code: '01.02', desc: 'BLOCOS / TORRES', unit: '', qty: 0, unitPrice: 0, total: 32932089.30, type: 'mt', originSheet: 'Master', isGroup: true },
        { id: 'b01.02.01', code: '01.02.01', desc: 'ALVENARIA', unit: '', qty: 0, unitPrice: 0, total: 5108282.34, type: 'mt', originSheet: 'Master', isGroup: true },
        { id: 'b01.02.01.MT', code: '01.02.01.MT', desc: 'MATERIAL', unit: 'VB', qty: 1, unitPrice: 3708685.31, total: 3708685.31, type: 'mt', originSheet: 'Master', isGroup: false },
        { id: 'b01.02.01.ST', code: '01.02.01.ST', desc: 'SERVIÇO DE TERCEIROS', unit: 'VB', qty: 1, unitPrice: 1399597.03, total: 1399597.03, type: 'st', originSheet: 'Master', isGroup: false },

        { id: 'b01.02.02', code: '01.02.02', desc: 'ESTRUTURAS / ESCADAS', unit: 'VB', qty: 1, unitPrice: 3336280.87, total: 3336280.87, type: 'st', originSheet: 'Master', isGroup: false },

        { id: 'b01.02.04', code: '01.02.04', desc: 'INSTALAÇÕES PREDIAIS - ÁGUA / ESGOTO / GÁS / ELÉTRICA / TEL', unit: 'VB', qty: 1, unitPrice: 4188256.74, total: 4188256.74, type: 'mt', originSheet: 'Master', isGroup: false },

        { id: 'b01.02.05', code: '01.02.05', desc: 'OUTROS ITENS DE TORRES', unit: 'VB', qty: 1, unitPrice: 20299269.35, total: 20299269.35, type: 'mt', originSheet: 'Master', isGroup: false },

        { id: 'b01.03', code: '01.03', desc: 'OUTROS CUSTOS DE CONSTRUÇÃO', unit: 'VB', qty: 1, unitPrice: 17840346.36, total: 17840346.36, type: 'mt', originSheet: 'Master', isGroup: false },

        { id: 'b02', code: '02', desc: 'CUSTOS DE INFRA-ESTRUTURA', unit: 'VB', qty: 1, unitPrice: 3500000, total: 3500000, type: 'mt', originSheet: 'Master', isGroup: false },
    ];

    // Budget Tree - simplified but mirroring budgetLines for views that use tree
    const budgetTree: BudgetNode[] = []; // We can build this if needed, but the view now builds it dynamically from budgetLines

    // 3. Financial Entries (NFs)
    const financialEntries: FinancialEntry[] = Array.from({ length: 80 }).map(() => {
        const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];

        // Pick an item to allocate to (only leaf items)
        const leafItems = budgetLines.filter(b => !b.isGroup);
        const selectedBudget = faker.helpers.arrayElement(leafItems);

        // Random amount relative to the budget item
        const maxAmount = selectedBudget.total * 0.15;
        const totalValue = parseFloat(faker.finance.amount({ min: 1000, max: maxAmount, dec: 2 }));

        // Random date range from 6 months ago to 6 months in the future
        const date = faker.date.between({
            from: new Date(2025, 0, 1),
            to: new Date(2025, 11, 31)
        });
        const issueDate = date.toISOString().split('T')[0];

        // Create 1-3 installments
        const instCount = faker.number.int({ min: 1, max: 3 });
        const installments = Array.from({ length: instCount }).map((_, i) => {
            const dueDate = new Date(date);
            dueDate.setMonth(dueDate.getMonth() + i);
            return {
                id: faker.string.uuid(),
                number: i + 1,
                dueDate: dueDate.toISOString().split('T')[0],
                value: totalValue / instCount,
                status: (dueDate < new Date() ? 'PAID' : 'PENDING') as 'PAID' | 'PENDING'
            };
        });

        return {
            id: faker.string.uuid(),
            documentNumber: faker.string.numeric(6),
            supplier: supplier.razaoSocial,
            description: `${selectedBudget.type === 'mt' ? 'NF MATERIAL' : 'NF SERVIÇO'} - ${faker.commerce.productName()}`,
            issueDate: issueDate,
            totalValue: totalValue,
            status: faker.helpers.arrayElement(['APPROVED', 'PAID', 'DRAFT']),
            allocations: [{
                id: faker.string.uuid(),
                budgetGroupCode: selectedBudget.code,
                costType: (selectedBudget.type?.toUpperCase() as any) || 'MT',
                value: totalValue,
                description: selectedBudget.desc
            }],
            installments: installments
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
