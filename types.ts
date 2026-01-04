import * as XLSX from 'xlsx';

export interface SheetData {
    id?: string;
    name: string;
    data: any[][];
    merges?: XLSX.Range[];
    colWidths?: number[];
    hiddenCols?: (boolean | number)[];
    hiddenRows?: (boolean | number)[];
    description?: string;
    fileName?: string;
}

export interface BudgetLine {
    id?: string;
    code: string;
    desc: string;
    unit: string;
    qty: number;
    unitPrice: number;
    total: number;
    type: 'st' | 'mt';
    itemType?: 'ETAPA' | 'SUB_ETAPA' | 'SERVICO' | 'MACRO_ETAPA';
    originSheet: string;
    isGroup?: boolean;
    isConstructionCost?: boolean;
    children?: BudgetLine[];
}

export interface BudgetVersion {
    version: number;
    date: string;
    lines: BudgetLine[];
    isCurrent: boolean;
    description?: string;
}

export interface RHPremise {
    id: number;
    role: string;
    baseSalary: number;
    chargesPct: number;
    foodCost: number;
    transportCost: number;
    housingCost: number;
    quantity: number;
}

export interface Measurement {
    id: string;
    date: string;
    value: number;
    description: string;
    fileName: string;
}

export interface Invoice {
    id: string;
    date: string;
    value: number;
    fileName: string;
}

export interface ContractBox {
    id: string;
    supplier: string;
    totalValue: number; // Valor Atualizado (Com Aditivos)
    initialValue?: number; // Valor Original
    additives?: number; // Total de Aditivos
    measuredTotal?: number; // Total Medido
    balance?: number; // Saldo a Medir
    budgetGroup?: string;
    measurements: Measurement[];
}

export interface SupplyChainBox {
    id: string;
    supplier: string;
    description: string;
    status: 'total' | 'partial' | 'programmed';
    totalValue: number;
    budgetGroup?: string;
    invoices: Invoice[];
}

// --- NOVAS INTERFACES PARA REFORMULAÇÃO DO AI LAB ---

export interface RDOItem {
    id: string;
    service: string; // Description/ProductService
    group: string;
    accumulatedValue: number;
    monthlyValue: number;
    date: string; // Data de corte do RDO
    status?: 'concluido' | 'em_andamento' | 'nao_iniciado';
    isConstructionCost?: boolean;
    sigla?: string;
    // New linking fields
    originalBudgetId?: string; // Link to BudgetLine.code or BudgetLine.id
    documentNumber?: string;
    budgetGroupCode?: string; // Coding from Financial Launch
    history?: string;
}

export interface ProjectionItem {
    id?: string;
    date: string;
    projectedValue: number;
    realizedValue: number;
    service?: string;
    rdoSheets?: SheetData[];
    budgetSheets?: SheetData[];
    projectionData?: ProjectionItem[];

    isLoaded?: boolean;
}

export interface CostSummaryItem {
    period: string;
    materials: number;
    services: number;
    equipment: number;
    indirect: number;
    total: number;
}

export interface AIResponse {
    analysis: string;
    kpis: { label: string; value: string; trend?: 'up' | 'down' | 'neutral'; color?: string }[];
    chart?: {
        title: string;
        type: 'bar' | 'pie' | 'line';
        unit?: 'percent' | 'currency';
        labels: string[];
        values: number[]; // For simplicity in this view
    };
}

export interface SavedAnalysis {
    id?: number;
    date: string;
    query: string;
    response: AIResponse;
}

// --- Visual Management Types ---
export interface TotvsItem {
    code: string;
    description: string;
    unit: string;
}

export interface ServiceDefinition {
    id: string;
    name: string;
    color: string; // Hex code
    order: number;
    group?: string;
}

export interface ProductionConfig {
    towers: number;
    floors: number;
    aptsPerFloor: number;
}

export interface ProductionStatus {
    [unitId: string]: { // key format: "T{t}-F{f}-A{a}" e.g., "T1-F5-A2"
        [serviceId: string]: 'pending' | 'started' | 'completed';
    }
}

// --- BUDGET CONTROL EXTENDED TYPES ---

export interface BudgetNode {
    id: string;
    code: string; // "01", "01.01", etc.
    description: string;
    level: number;
    totalValue: number;
    type: 'GROUP' | 'ITEM';
    itemType?: 'ST' | 'MT' | 'EQ'; // Only for items
    parentId?: string;
    children: BudgetNode[];

    // Values
    budgetInitial: number;
    budgetCurrent: number;
    realizedRDO: number; // From RDO
    realizedFinancial: number; // From Paid Invoices
    committed: number; // From Contracts/PO

    lastUpdated?: string;
    costCenter?: string; // 'T1_T2', 'T3_T4', 'INFRA', 'CI'
}

export interface FinancialEntry {
    id: string;
    documentNumber: string; // NF, Invoice Number
    supplier: string;
    description: string;
    issueDate: string;
    totalValue: number;

    // Classification - Multi-allocation support
    allocations: FinancialAllocation[];

    // Payment Schedule
    installments: Installment[];

    // Metadata
    status: 'DRAFT' | 'APPROVED' | 'PAID' | 'PARTIAL';
    attachments?: string[];

    // New Fields
    purchaseOrder?: string; // OC
    idMov?: string;
    nMov?: string;
}

export interface FinancialAllocation {
    id: string;
    budgetGroupCode: string; // Link to BudgetNode e.g. "01.01.03"
    costType: 'ST' | 'MT' | 'EQ' | 'OUTROS';
    value: number;
    description?: string; // Optional detail
}

export interface Installment {
    id: string;
    number: number;
    dueDate: string;
    value: number;
    status: 'PENDING' | 'PAID' | 'LATE';
    paymentDate?: string;
}

export interface PurchaseRequest {
    id: string;
    requestId: string;
    description: string;
    date: string;
    requester: string;
    priority: 'Normal' | 'Urgente';
    status: 'Aguardando Almoxarifado' | 'Em Análise Engenharia' | 'Aguardando Gerente' | 'Aprovado' | 'No TOTVS' | 'Finalizado';
    items: PurchaseRequestItem[];
    history: RequestHistoryItem[];
    budgetGroupCode?: string;
    totvsOrderNumber?: string;
}

export interface PurchaseRequestItem {
    id: string;
    description: string;
    quantityRequested: number;
    quantityStock?: number; // Available in stock
    quantityToBuy?: number; // Final quantity to buy
    unit: string;
    observation?: string;
    totvsCode?: string; // Code from TOTVS if registered
    budgetGroupCode?: string;
}

export interface RequestHistoryItem {
    date: string;
    user: string;
    action: string;
    details?: string;
}

export interface BudgetGroup {
    id: string;
    code: string; // e.g., '01.01.02'
    description: string;
    totalBudget: number;
    type: 'ST' | 'MT' | 'EQ' | 'CI';
    parentCode?: string; // for hierarchy
    breakdown: {
        st: number;
        mt: number;
        eq: number;
    };
    monthlyProjection: { [monthKey: string]: number }; // 'YYYY-MM' -> value
}

// Deprecated or Aliased for backward compat if needed, but FinancialEntry is preferred now
export interface FinancialDocument {
    id: string; // NF Number
    supplier: string;
    issueDate: string;
    totalValue: number;
    installments: {
        number: number;
        dueDate: string;
        value: number;
        isPaid: boolean;
    }[];
    purchaseRequestId?: string;
    budgetGroupCode?: string; // Linked budget group
}

export interface Supplier {
    id: string;
    razaoSocial: string;
    cnpj: string;
}

export interface AppData {
    budget: BudgetLine[];
    masterPlanSheets: SheetData[];
    rhPremises: RHPremise[];
    contractorData: { contracts: ContractBox[] };
    supplyChainData: { orders: SupplyChainBox[] };
    isLoaded: boolean;
    rdoData: RDOItem[];
    projectionData: ProjectionItem[];
    rdoSheets: SheetData[];
    budgetSheets: SheetData[];
    costSummary?: CostSummaryItem[];
    budgetData?: BudgetLine[]; // Optional alias if needed

    // New Production Control Data
    visualManagement?: {
        config: ProductionConfig;
        services: ServiceDefinition[];
        status: ProductionStatus;
        foundationData?: Record<string, { total: number; realized: number }>; // Tower Index -> Data
        unitProgress?: Record<string, Record<string, number>>; // UnitId -> ServiceId -> Percent
        towerNames?: string[]; // Custom names for towers
        legendColors?: { pending: string; started: string; completed: string }; // Customizable legend colors
        serviceStatus?: Record<string, 'pending' | 'executing' | 'completed'>; // ServiceId -> Pipeline Status
    };
    purchaseRequests?: PurchaseRequest[];
    budgetGroups?: BudgetGroup[];
    totvsItems?: TotvsItem[];

    // New Financial Control
    financialEntries?: FinancialEntry[]; // New store for NFs
    financialDocuments?: FinancialDocument[]; // Keep for legacy compat if needed
    budgetTree?: BudgetNode[]; // Full hierarchical tree state if persisted

    budgetVersions?: BudgetSnapshot[];
    suppliers?: Supplier[];
}

export interface BudgetSnapshot {
    version: number;
    createdAt: string;
    description: string;
    tree: BudgetNode[];
    totalValue: number;
}
