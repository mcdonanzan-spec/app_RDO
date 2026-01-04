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
    RDOItem,
    BudgetGroup
} from '../../types';

export async function generateMockData() {
    console.log("Starting mock data generation for 2026...");

    const currentYear = new Date().getFullYear(); // 2026

    // 1. Suppliers
    const suppliers: Supplier[] = Array.from({ length: 15 }).map(() => ({
        id: faker.string.uuid(),
        razaoSocial: faker.company.name(),
        cnpj: faker.string.numeric(14)
    }));

    // 2. Budget Data (Flat & Tree)
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

    // Popula BudgetGroups explicitamente
    const budgetGroups: BudgetGroup[] = budgetLines.map(line => ({
        id: line.id!,
        code: line.code,
        description: line.desc,
        totalBudget: line.total,
        type: line.type.toUpperCase() as any,
        parentCode: line.code.includes('.') ? line.code.substring(0, line.code.lastIndexOf('.')) : undefined,
        breakdown: { st: line.type === 'st' ? line.total : 0, mt: line.type === 'mt' ? line.total : 0, eq: 0 },
        monthlyProjection: {}
    }));

    // 3. Financial Entries (NFs) em 2026
    const financialEntries: FinancialEntry[] = Array.from({ length: 120 }).map(() => {
        const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
        const leafItems = budgetLines.filter(b => !b.isGroup);
        const selectedBudget = faker.helpers.arrayElement(leafItems);

        const maxAmount = selectedBudget.total * 0.12;
        const totalValue = parseFloat(faker.finance.amount({ min: 500, max: Math.max(5000, maxAmount), dec: 2 }));

        // Distribui de Outubro/2025 até Dezembro/2026
        const date = faker.date.between({
            from: new Date(2025, 9, 1), // Out 2025
            to: new Date(2026, 11, 31)  // Dez 2026
        });
        const issueDate = date.toISOString().split('T')[0];

        const instCount = faker.number.int({ min: 1, max: 2 });
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
            status: faker.helpers.arrayElement(['APPROVED', 'PAID', 'APPROVED']),
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
        totalValue: 1200000,
        initialValue: 1000000,
        additives: 200000,
        measuredTotal: 450000,
        balance: 750000,
        budgetGroup: '01.02.01',
        measurements: []
    }));

    // 5. Supply Chain Orders
    const orders: SupplyChainBox[] = suppliers.slice(5, 10).map(sup => ({
        id: faker.string.uuid(),
        supplier: sup.razaoSocial,
        description: `Pedido de Compra - ${faker.commerce.productName()}`,
        status: faker.helpers.arrayElement(['total', 'partial', 'programmed']),
        totalValue: 45000,
        budgetGroup: '01.02.02',
        invoices: []
    }));

    // 6. RDO Data
    const rdoSummary: Record<string, number> = {};
    financialEntries.forEach(fe => {
        fe.allocations.forEach(al => {
            const b = budgetLines.find(x => x.code === al.budgetGroupCode);
            const key = b ? b.desc : 'GERAL';
            rdoSummary[key] = (rdoSummary[key] || 0) + al.value;
        });
    });

    const rdoData: RDOItem[] = Object.entries(rdoSummary).map(([group, value]) => ({
        id: faker.string.uuid(),
        service: `PRODUÇÃO ${group}`,
        group: group,
        accumulatedValue: value * 1.05, // Slightly more than financial for delta
        monthlyValue: value * 0.1,
        date: new Date().toISOString(),
        status: 'concluido',
        isConstructionCost: true
    }));

    // 7. Purchase Requests vinculados a códigos reais
    const validCodes = budgetLines.filter(b => !b.isGroup).map(b => b.code);
    const purchaseRequests = Array.from({ length: 30 }).map((_, i) => ({
        id: faker.string.uuid(),
        requestId: `RPC-2026-${String(i + 1).padStart(3, '0')}`,
        description: `SOLICITAÇÃO DE ${faker.commerce.productName()}`,
        date: faker.date.between({ from: new Date(2026, 0, 1), to: new Date() }).toISOString().split('T')[0],
        requester: faker.person.fullName(),
        priority: faker.helpers.arrayElement(['Normal', 'Urgente'] as const),
        status: faker.helpers.arrayElement(['Aguardando Almoxarifado', 'Em Análise Engenharia', 'Aguardando Gerente', 'Aprovado'] as const),
        budgetGroupCode: faker.helpers.arrayElement(validCodes),
        items: [
            {
                id: faker.string.uuid(),
                description: faker.commerce.productMaterial(),
                quantityRequested: faker.number.int({ min: 5, max: 200 }),
                unit: faker.helpers.arrayElement(['UN', 'M3', 'KG', 'M', 'SC']),
                observation: faker.lorem.sentence()
            }
        ],
        history: [{ date: new Date().toISOString(), user: 'Sistema', action: 'Geração de Mock' }]
    }));

    // 8. Disbursement Forecast Mock (Incluindo final de 2025)
    const disbursementForecast: Record<string, Record<string, number>> = {};
    validCodes.forEach(code => {
        disbursementForecast[code] = {};
        // 2025 (Late)
        for (let m = 10; m <= 12; m++) {
            const monthStr = `2025-${String(m).padStart(2, '0')}`;
            disbursementForecast[code][monthStr] = faker.number.int({ min: 1000, max: 50000 });
        }
        // 2026 (Full)
        for (let m = 1; m <= 12; m++) {
            const monthStr = `2026-${String(m).padStart(2, '0')}`;
            disbursementForecast[code][monthStr] = faker.number.int({ min: 1000, max: 50000 });
        }
    });

    // Update start month to include the 2025 history
    const startMonth = '2025-10';

    // 9. Visual Management
    const visualConfig = { towers: 4, floors: 12, aptsPerFloor: 8 };
    const visualServices = [
        { id: 's1', name: 'Alvenaria', color: '#ef4444', order: 1 },
        { id: 's2', name: 'Reboco', color: '#f97316', order: 2 },
        { id: 's3', name: 'Instalações', color: '#3b82f6', order: 3 },
        { id: 's4', name: 'Acabamento', color: '#22c55e', order: 4 }
    ];
    const visualStatus: any = {};
    for (let t = 1; t <= visualConfig.towers; t++) {
        for (let f = 0; f <= visualConfig.floors; f++) {
            for (let a = 1; a <= visualConfig.aptsPerFloor; a++) {
                const unitId = `T${t}-F${f}-A${a}`;
                visualStatus[unitId] = {};
                visualServices.forEach(srv => {
                    const rnd = Math.random();
                    visualStatus[unitId][srv.id] = rnd < 0.4 ? 'completed' : rnd < 0.7 ? 'started' : 'pending';
                });
            }
        }
    }

    // Transaction to Clear & Fill
    try {
        await db.transaction('rw',
            [
                db.financialEntries, db.budget, db.contracts, db.orders, db.rhPremises,
                db.meta, db.rdoData, db.masterPlanSheets, db.purchaseRequests,
                db.budgetGroups, db.visualManagement, db.financialDocuments
            ],
            async () => {
                await Promise.all([
                    db.financialEntries.clear(),
                    db.budget.clear(),
                    db.contracts.clear(),
                    db.orders.clear(),
                    db.rhPremises.clear(),
                    db.rdoData.clear(),
                    db.masterPlanSheets.clear(),
                    db.purchaseRequests.clear(),
                    db.budgetGroups.clear(),
                    db.visualManagement.clear(),
                    db.financialDocuments.clear()
                ]);

                await Promise.all([
                    db.budget.bulkAdd(budgetLines),
                    db.contracts.bulkAdd(contracts),
                    db.orders.bulkAdd(orders),
                    db.rhPremises.bulkAdd([
                        { id: 1, role: 'ENGENHEIRO RESIDENTE', baseSalary: 15000, chargesPct: 80, foodCost: 1000, transportCost: 500, housingCost: 0, quantity: 1 },
                        { id: 2, role: 'MESTRE GERAL', baseSalary: 9000, chargesPct: 80, foodCost: 1000, transportCost: 500, housingCost: 0, quantity: 2 }
                    ]),
                    db.rdoData.bulkAdd(rdoData),
                    db.purchaseRequests.bulkAdd(purchaseRequests),
                    db.budgetGroups.bulkAdd(budgetGroups),
                    db.financialEntries.bulkAdd(financialEntries),
                    db.visualManagement.put({ id: 'main', data: { config: visualConfig, services: visualServices, status: visualStatus, towerNames: ['T1', 'T2', 'T3', 'T4'] } }),
                    db.meta.put({ key: 'disbursementForecast', value: disbursementForecast }),
                    db.meta.put({ key: 'disbursementForecastStartMonth', value: startMonth })
                ]);

                await setLoaded(true);
            });

        console.log("Mock data 2026 injected successfully!");
        alert("Dados de teste 2026 gerados com sucesso!");
        window.location.reload();

    } catch (e) {
        console.error(e);
        alert("Erro fatal: " + e);
    }
}
