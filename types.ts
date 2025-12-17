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
        labels: string[];
        values: number[] | { label: string, data: number[] }[]; // Suporte a múltiplas séries
    };
}

// --- Visual Management Types ---
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
    };
}
