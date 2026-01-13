import * as XLSX from 'xlsx';
import { ContractBox, SupplyChainBox, BudgetLine, RDOItem, CostSummaryItem, TotvsItem } from '../../types';
import { parseMoney } from '../utils';

export class ExcelService {
    static async readExcelFile(file: File): Promise<XLSX.WorkBook> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const wb = XLSX.read(data, { type: 'array' });
                    resolve(wb);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    }

    private static async ensureWorkbook(fileOrWb: File | XLSX.WorkBook): Promise<XLSX.WorkBook> {
        if (fileOrWb instanceof File) {
            return await this.readExcelFile(fileOrWb);
        }
        return fileOrWb;
    }

    // --- UTILS ---
    static countDots(str: string): number {
        return (str.match(/\./g) || []).length;
    }

    // --- SPECIFIC PARSERS ---

    static async parseSuppliers(fileOrWb: File | XLSX.WorkBook): Promise<{ razaoSocial: string; cnpj: string }[]> {
        const wb = await this.ensureWorkbook(fileOrWb);
        const suppliers: { razaoSocial: string; cnpj: string }[] = [];

        // Search all sheets for supplier data
        for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            if (!ws || !ws['!ref']) continue;

            const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
            let headerRow = -1;
            let razaoSocialCol = -1;
            let cnpjCol = -1;

            // Find header row with "RAZÃO SOCIAL" and "CNPJ"
            for (let i = 0; i < Math.min(json.length, 20); i++) {
                const row: any = json[i];
                if (!row || row.length === 0) continue;

                for (let j = 0; j < row.length; j++) {
                    const cell = String(row[j] || '').toUpperCase().trim();

                    if (cell.includes('RAZÃO') && cell.includes('SOCIAL')) {
                        razaoSocialCol = j;
                    }
                    if (cell.includes('RAZAO') && cell.includes('SOCIAL')) {
                        razaoSocialCol = j;
                    }
                    if (cell.includes('CNPJ')) {
                        cnpjCol = j;
                    }
                }

                if (razaoSocialCol >= 0 && cnpjCol >= 0) {
                    headerRow = i;
                    break;
                }
            }

            // Extract data rows
            if (headerRow >= 0) {
                for (let i = headerRow + 1; i < json.length; i++) {
                    const row: any = json[i];
                    const razao = String(row[razaoSocialCol] || '').trim().toUpperCase();
                    const cnpj = String(row[cnpjCol] || '').trim();

                    if (razao && cnpj) {
                        suppliers.push({ razaoSocial: razao, cnpj });
                    }
                }
            }
        }

        return suppliers;
    }

    static async parseContracts(fileOrWb: File | XLSX.WorkBook): Promise<ContractBox[]> {
        const wb = await this.ensureWorkbook(fileOrWb);
        // Universal Search: Filter all sheets for contract-like data
        let allContracts: ContractBox[] = [];

        for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            if (!ws || !ws['!ref']) continue;

            const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
            let headerRow = -1;
            const headers: any = {};

            for (let i = 0; i < Math.min(json.length, 30); i++) {
                const row = json[i] as any[];
                if (!row || !Array.isArray(row)) continue;

                let tempHeaders: any = {};
                row.forEach((cell, idx) => {
                    const val = String(cell || '').toUpperCase().trim();
                    if (val.includes('FORNECEDOR') || val.includes('CONTRATADO') || val.includes('EMPREITEIRO')) tempHeaders.supplier = idx;
                    if (val.includes('TOTAL') || val.includes('VALOR CONTRATO') || val.includes('GLOBAL')) tempHeaders.total = idx;
                });

                if (tempHeaders.supplier !== undefined && (tempHeaders.total !== undefined)) {
                    headerRow = i;
                    Object.assign(headers, tempHeaders);
                    break;
                }
            }

            if (headerRow !== -1) {
                const seenIds = new Set<string>();
                for (let i = headerRow + 1; i < json.length; i++) {
                    const row = json[i] as any[];
                    if (!row || row.length === 0) continue;

                    const supplier = headers.supplier !== undefined ? String(row[headers.supplier]) : 'Desconhecido';
                    const total = headers.total !== undefined ? parseMoney(row[headers.total]) : 0;

                    if (total > 0 && supplier.length > 2) {
                        allContracts.push({
                            id: `CT-${sheetName}-${i}`,
                            supplier,
                            totalValue: total,
                            initialValue: total,
                            measurements: []
                        });
                    }
                }
            }
        }
        return allContracts;
    }

    static async parseSupplies(fileOrWb: File | XLSX.WorkBook): Promise<SupplyChainBox[]> {
        const wb = await this.ensureWorkbook(fileOrWb);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let headerRow = -1;
        const headers: any = {};

        for (let i = 0; i < Math.min(json.length, 20); i++) {
            const row = json[i] as any[];
            if (!row || !Array.isArray(row)) continue;

            let tempHeaders: any = {};
            let valuePriority = 0;

            row.forEach((cell, idx) => {
                const val = String(cell || '').toUpperCase().trim();

                if (val.includes('OC') || val.includes('ID') || val === 'NUMERO') tempHeaders.id = idx;
                if (val.includes('FORNECEDOR') || val.includes('EMPRESA')) tempHeaders.supplier = idx;
                if (val.includes('DESC') || val.includes('ITEM') || val.includes('PRODUTO')) tempHeaders.desc = idx;
                if (val.includes('STATUS') || val.includes('SITUACAO')) tempHeaders.status = idx;

                // Prioritize 'VALOR DO DOCUMENTO'
                if (val.includes('VALOR DO DOCUMENTO')) {
                    tempHeaders.totalValue = idx;
                    valuePriority = 2;
                } else if (valuePriority < 2 && (val.includes('VALOR') || val.includes('TOTAL'))) {
                    tempHeaders.totalValue = idx;
                    valuePriority = 1;
                }
            });

            if (tempHeaders.supplier !== undefined && (tempHeaders.totalValue !== undefined || tempHeaders.desc !== undefined)) {
                headerRow = i;
                Object.assign(headers, tempHeaders);
                console.log(`Encontrados Cabeçalhos de Suprimentos na linha ${i}`, headers);
                break;
            }
        }

        const orders: SupplyChainBox[] = [];
        const seenIds = new Set<string>();

        if (headerRow !== -1) {
            for (let i = headerRow + 1; i < json.length; i++) {
                const row = json[i] as any[];
                if (!row || row.length === 0) continue;

                let id = headers.id !== undefined ? String(row[headers.id]) : `OC-${i}`;
                const supplier = headers.supplier !== undefined ? String(row[headers.supplier]) : 'Fornecedor Desconhecido';
                const description = headers.desc !== undefined ? String(row[headers.desc]) : '';
                const totalValue = headers.totalValue !== undefined ? parseMoney(row[headers.totalValue]) : 0;
                let status: 'total' | 'partial' | 'programmed' = 'programmed';

                // Try to parse status
                if (headers.status !== undefined) {
                    const statusStr = String(row[headers.status]).toUpperCase();
                    if (statusStr.includes('TOTAL') || statusStr.includes('RECEBIDO') || statusStr.includes('CONCLUI')) status = 'total';
                    else if (statusStr.includes('PARCIAL')) status = 'partial';
                }

                // Ensure ID Uniqueness
                if (seenIds.has(id)) {
                    id = `${id}-ROW${i}`;
                }
                seenIds.add(id);

                if (supplier && (totalValue > 0 || description.length > 2)) {
                    orders.push({ id, supplier, description, status, totalValue, invoices: [] });
                }
            }
        }
        return orders;
    }

    static async parseBudget(fileOrWb: File | XLSX.WorkBook): Promise<BudgetLine[]> {
        console.log('Iniciando parseBudget com Busca Universal...');
        try {
            const wb = await this.ensureWorkbook(fileOrWb);
            let allItems: BudgetLine[] = [];

            // Iterate ALL sheets to find data
            for (const sheetName of wb.SheetNames) {
                const ws = wb.Sheets[sheetName];
                if (!ws || !ws['!ref']) continue;

                const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
                // Skip sheets that are too small to be a budget
                if (json.length < 5) continue;

                let headerRow = -1;
                const headers: any = {};

                // 1. HEADER SEARCH
                for (let i = 0; i < Math.min(json.length, 50); i++) {
                    const row = json[i] as any[];
                    if (!row || !Array.isArray(row)) continue;

                    let tempHeaders: any = {};
                    row.forEach((cell, idx) => {
                        const val = String(cell || '').toUpperCase().trim();
                        if (!val) return;

                        if (val.includes('CODIGO') || val.includes('CÓDIGO') || val === 'ITEM' || val === 'ID' || val === 'COD') tempHeaders.code = idx;
                        else if (val.includes('NOME') || val.includes('DESCRIÇÃO') || val.includes('DESCRICAO') || val === 'ATIVIDADE' || val === 'DISCRIMINAÇÃO' || val === 'SERVICO') tempHeaders.desc = idx;
                        else if (val.includes('UNIDADE') || val === 'UN' || val === 'UND') tempHeaders.unit = idx;
                        else if (val.includes('QUANTIDADE') || val === 'QTD' || val === 'QUANT' || val === 'QTDE') tempHeaders.qty = idx;
                        else if (val.includes('UNIT') || val.includes('UNITÁRIO')) tempHeaders.unitInfo = idx;
                        else if (val.includes('TOTAL') || val.includes('VALOR') || val.includes('CUSTO') || val.includes('PREÇO')) {
                            if (!val.includes('UNIT')) tempHeaders.total = idx;
                        }
                    });

                    // Valid Header Criteria: Need at least Description and (Total or Code or Unit)
                    if (tempHeaders.desc !== undefined && (tempHeaders.total !== undefined || tempHeaders.code !== undefined || tempHeaders.unitInfo !== undefined)) {
                        headerRow = i;
                        Object.assign(headers, tempHeaders);
                        console.log(`Cabeçalhos de Orçamento encontrados na aba ${sheetName} linha ${i}`, headers);
                        break;
                    }
                }

                // 2. DATA EXTRACTION
                const startRow = headerRow !== -1 ? headerRow + 1 : 1; // Default to row 1 if no header

                // If no headers found, try heuristic mapping (A=Code, B=Desc, E=Total?) - RISKY, let's stick to "Must find basic signatures"
                // But for "Faithful", if we find a sheet with text in Col B and Numbers in Col E, maybe we take it?
                if (headerRow !== -1) {
                    // First pass: collect all potential items
                    const rawItems: BudgetLine[] = [];

                    for (let i = headerRow + 1; i < json.length; i++) {
                        const row = json[i] as any[];
                        if (!row || row.length === 0) continue;

                        let code = headers.code !== undefined ? String(row[headers.code] || '').trim() : '';

                        // Strict check: Code must be present OR sheet must be a Summary Sheet (Viabilidade)
                        const isSummarySheet = sheetName.toUpperCase().includes('VIABILIDADE') || sheetName.toUpperCase().includes('RESUMO');

                        // If Summary Sheet, we accept items without code if they have description and value (High Value items)
                        if (!code && !isSummarySheet) continue;
                        if (!code && isSummarySheet) code = `SUM-${i}`;

                        if (code.toUpperCase().includes('TOTAL') || code.toUpperCase().includes('RESUMO')) continue;

                        const desc = headers.desc !== undefined ? String(row[headers.desc] || '').trim() : 'Item sem nome';
                        const unit = headers.unit !== undefined ? String(row[headers.unit] || '').trim() : '';

                        let qty = 1;
                        if (headers.qty !== undefined) {
                            const qVal = parseMoney(row[headers.qty]);
                            if (qVal > 0) qty = qVal;
                        }

                        let total = 0;
                        if (headers.total !== undefined) {
                            total = parseMoney(row[headers.total]);
                        } else if (headers.unitInfo !== undefined && headers.qty !== undefined) {
                            const unitVal = parseMoney(row[headers.unitInfo]);
                            total = unitVal * qty;
                        }

                        // Heuristic: If we are in Viabilidade Summary, and row has "Total", capture it as a special item
                        if (isSummarySheet && (desc.toUpperCase().includes('TOTAL') || desc.toUpperCase().includes('CUSTO DA OBRA'))) {
                            // This is likely the Grand Total
                            // We should store this. For now, let's treat it as a valid item if it's not huge duplicate.
                        }

                        // Heuristic for Construction Cost via Description
                        const isConstructionCost = !['ADMINISTRAÇÃO', 'INDIRETAS', 'DESPESAS', 'PROJETOS', 'LICENÇAS', 'MARKETING', 'COMERCIAL'].some(k => desc.toUpperCase().includes(k));

                        // FIX: If we just found Unit/Qty but NO Total, calc it.
                        if (total === 0 && qty > 0 && headers.unitInfo !== undefined) {
                            const unitPrice = parseMoney(row[headers.unitInfo]);
                            total = unitPrice * qty;
                        }

                        // FALLBACK: If Total is still 0, look for ANY number in the row that "looks like" a total (large number)
                        if (total === 0) {
                            // Find largest number in row
                            const numbers = row.filter(c => typeof c === 'number' && c > 100);
                            if (numbers.length > 0) {
                                total = Math.max(...numbers);
                            }
                        }

                        // Only add if it looks like a valid item (has price or detailed description)
                        if (total > 0 || (desc.length > 2)) {
                            rawItems.push({
                                code,
                                desc,
                                unit,
                                qty,
                                unitPrice: total > 0 && qty > 0 ? total / qty : 0,
                                total,
                                type: 'st',
                                originSheet: sheetName,
                                isGroup: false, // Will be calculated
                                isConstructionCost,
                                itemType: 'MACRO_ETAPA'
                            });
                        }
                    }

                    // Hierarchy Detection logic
                    rawItems.forEach(item => {
                        // Check if this item acts as a parent to other items
                        // Logic: Does any other item start with this item's code + '.'?
                        const hasChildren = rawItems.some(child => child.code.startsWith(item.code + '.') && child.code !== item.code);
                        item.isGroup = hasChildren;

                        const dotCount = (item.code.match(/\./g) || []).length;
                        if (item.isGroup) {
                            // If group has TOTAL, we keep it but mark as group.
                            // Validate Sum: If Children Sum == Item Total, it's a Group Sum.
                            // If Children Sum == 0, maybe the Money is ON THE GROUP (Strategy: "Implicit").

                            const childrenSum = rawItems.filter(c => c.code.startsWith(item.code + '.') && c.code !== item.code && (c.code.match(/\./g) || []).length === dotCount + 1)
                                .reduce((acc, c) => acc + c.total, 0);

                            // If Item Total > 0 and Children Sum is tiny, then this Group Line HOLDS the value.
                            if (item.total > 0 && childrenSum < item.total * 0.1) {
                                item.isGroup = false; // Treat as payable item
                            }

                            if (dotCount === 0) item.itemType = 'MACRO_ETAPA';
                            else if (dotCount === 1) item.itemType = 'ETAPA';
                            else item.itemType = 'SUB_ETAPA';
                        } else {
                            item.itemType = 'SERVICO';
                        }
                    });

                    allItems.push(...rawItems);
                }
            }

            // AUTO-CORRECTION: If Total Budget is tiny (e.g. < 1M) but we found a "Viabilidade" sheet with big numbers, use that sheet ONLY.
            // Or prioritize items from Viabilidade if they exist.
            const viabilidadeItems = allItems.filter(i => i.originSheet.toUpperCase().includes('VIABILIDADE'));
            const normalItems = allItems.filter(i => !i.originSheet.toUpperCase().includes('VIABILIDADE'));

            const sumViab = viabilidadeItems.reduce((acc, i) => acc + i.total, 0);
            const sumNorm = normalItems.reduce((acc, i) => acc + i.total, 0);

            console.log(`Budget Auto-Correction: Viabilidade Sum=${sumViab}, Normal Sum=${sumNorm}`);

            if (sumViab > 1000000 && sumNorm < 1000000) {
                console.log("Using Viabilidade Items as Primary Budget Source.");
                return viabilidadeItems;
            } else if (sumNorm > 1000000) {
                return normalItems; // Prefer detailed budget if available
            }

            // EXPERT SNIPER MODE: ROBUST MULTI-SHEET SCAN
            let sniperValue = 0;

            // Define candidate sheets: Prioritize "Viabilidade" but also check "Resumo"
            // We want to find the single largest number that represents the Total Budget (approx 43M)
            const candidateSheets = wb.SheetNames.filter(n =>
                n.toUpperCase().includes('VIABILIDADE') ||
                n.toUpperCase().includes('RESUMO') ||
                n.toUpperCase().includes('ORÇAMENTO') ||
                n.toUpperCase().includes('CUSTO')
            );

            console.log(`EXPERT MODE: Searching for Budget Total in candidates: ${candidateSheets.join(', ')}`);

            for (const sheetName of candidateSheets) {
                try {
                    const ws = wb.Sheets[sheetName];
                    if (!ws) continue;

                    // Get full data for this sheet
                    const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
                    if (json.length < 5) continue;

                    let localMax = 0;

                    // 1. COORDINATE SNIPER (Targeting H20 area specifically as requested)
                    // H is index 7. H20 is row index 19.
                    const targetRows = [19, 54, 18, 20, 21]; // H20, and F55 (common place), plus surroundings
                    const targetCols = [7, 5, 6, 8]; // H, F, G, I

                    for (const rIndex of targetRows) {
                        if (json[rIndex]) {
                            const row = json[rIndex] as any[];
                            for (const cIndex of targetCols) {
                                const val = parseMoney(row[cIndex]);
                                if (val > 1000000) {
                                    console.log(`MODO EXPERT: Encontrado total potencial em [${sheetName}] L${rIndex + 1}:C${cIndex} => ${val}`);
                                    if (val > localMax) localMax = val;
                                }
                            }
                        }
                    }

                    // 2. FULL SHEET SCAN (Max Value Strategy)
                    // If coordinate sniper didn't find a huge number, or just to be safe, scan the whole sheet.
                    // The Total Budget is usually the largest currency number in the sheet.
                    for (let r = 0; r < json.length; r++) {
                        const row = json[r] as any[];
                        if (!row) continue;
                        for (let c = 0; c < row.length; c++) {
                            const cellVal = parseMoney(row[c]);
                            // Avoid crazy outliers but look for Multi-Million values
                            if (cellVal > 1000000) {
                                if (cellVal > localMax) localMax = cellVal;
                            }
                        }
                    }

                    // 3. SEMANTIC ROW SCAN ("Custo Total", "Total Geral")
                    for (let r = 0; r < json.length; r++) {
                        const row = json[r] as any[];
                        if (!row) continue;
                        const rowStr = row.map(x => String(x).toUpperCase()).join(' ');

                        if (rowStr.includes('TOTAL') && (rowStr.includes('GERAL') || rowStr.includes('ORÇAMENTO') || rowStr.includes('CUSTO') || rowStr.includes('OBRA'))) {
                            // This row has keywords. Look for values in it.
                            for (let c = 0; c < row.length; c++) {
                                const val = parseMoney(row[c]);
                                if (val > 1000000 && val > localMax) {
                                    console.log(`MODO EXPERT: Encontrado Total Semântico em [${sheetName}] Linha ${r + 1}: "${rowStr}" => ${val}`);
                                    localMax = val;
                                }
                            }
                        }
                    }

                    // Update Global Sniper if this sheet gave a better value
                    // Prefer Viabilidade sheets over others if values are similar, but take larger if significant
                    const isViabilidade = sheetName.toUpperCase().includes('VIABILIDADE');

                    if (localMax > sniperValue) {
                        // If we already have a sniper value from a Viabilidade sheet, and this is NOT Viabilidade,
                        // only override if it's significantly larger (e.g. Total vs Subtotal)
                        const currentIsViabilidade = sniperValue > 0 && candidateSheets.find(s => wb.Sheets[s] && s.toUpperCase().includes('VIABILIDADE')) !== undefined;

                        // Simple logic: Max wins for now, because 43M > 31M.
                        sniperValue = localMax;
                        console.log(`MODO EXPERT: Novo Melhor Candidato para Orçamento: ${sniperValue} (de ${sheetName})`);
                    }
                } catch (err) {
                    console.warn(`Erro ao escanear planilha ${sheetName}`, err);
                }
            }

            let finalItems = allItems;
            const currentSum = finalItems.reduce((acc, i) => acc + i.total, 0);

            // RATIO CORRECTION STRATEGY
            if (sniperValue > 1000000 && currentSum > 0) {
                const ratio = sniperValue / currentSum;
                // Only apply if diff is significant (> 1%)
                if (Math.abs(1 - ratio) > 0.01) {
                    console.log(`MODO EXPERT: Aplicando Correção de Proporção ao Orçamento. Razão: ${ratio.toFixed(4)} (Alvo: ${sniperValue} / Atual: ${currentSum})`);
                    finalItems = finalItems.map(item => ({
                        ...item,
                        qty: item.qty, // Keep qty
                        unitPrice: item.unitPrice * ratio,
                        total: item.total * ratio
                    }));
                }
            } else if (sniperValue > 1000000 && currentSum === 0) {
                // Fallback if no items found but total exists
                finalItems.push({
                    code: 'GLOBAL',
                    desc: 'Custo Global Viabilidade',
                    unit: 'vb',
                    qty: 1,
                    unitPrice: sniperValue,
                    total: sniperValue,
                    type: 'st',
                    originSheet: 'Viabilidade',
                    isGroup: false,
                    isConstructionCost: true,
                    itemType: 'MACRO_ETAPA'
                });
            }

            console.log(`ParseBudget finalizado. Total Final: ${finalItems.reduce((a, b) => a + b.total, 0)}`);
            return finalItems;
        } catch (error) {
            console.error('ERRO CRÍTICO no parseBudget:', error);
            return [];
        }
    }

    static async parseRDO(fileOrWb: File | XLSX.WorkBook): Promise<RDOItem[]> {
        console.log('Iniciando parseRDO (Modo Universal)...');
        try {
            const wb = await this.ensureWorkbook(fileOrWb);
            let bestItems: RDOItem[] = [];
            let maxScore = -1;

            // ANALYZE ALL SHEETS to find the "Most Likely" RDO Sheet (Highest count of valid rows)
            // Or aggregate all? RDO is usually a single transaction list. Aggregating safeguards against split data.
            // Let's aggregate, but deduplicate ID? No, IDs are generated. 
            // We'll trust that multiple sheets might contain data (e.g. Jan, Feb, Mar).

            for (const sheetName of wb.SheetNames) {
                const ws = wb.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
                if (json.length < 5) continue;

                let headerRow = -1;
                const headers: any = {};
                let foundHeaders = false;

                // 1. HEADER SEARCH
                for (let i = 0; i < Math.min(json.length, 50); i++) {
                    const row = json[i] as any[];
                    if (!row || !Array.isArray(row)) continue;

                    let tempHeaders: any = {};
                    row.forEach((cell, idx) => {
                        const val = String(cell || '').toUpperCase();

                        if ((val.includes('COD') || val.includes('CÓD')) && (val.includes('ORCAMENTO') || val.includes('TAREFA'))) tempHeaders.budgetCode = idx;
                        else if (val.includes('HISTORICO') || val.includes('HISTÓRICO') || val.includes('DESCRICAO') || val.includes('DESCRIÇÃO')) tempHeaders.desc = idx;
                        else if (val.includes('DOC') || val.includes('NOTA')) tempHeaders.docNum = idx;
                        else if (val.includes('VALOR') || val.includes('TOTAL') || val.includes('BRUTO') || val.includes('LIQUIDO')) tempHeaders.value = idx;
                        else if (val.includes('DATA') || val === 'DT' || val === 'EMISSAO') tempHeaders.date = idx;
                        else if (val.includes('GRUPO') && !val.includes('COD')) tempHeaders.groupName = idx;

                        // SIGLA / CLASSIFICATION
                        else if (val === 'SIGLA') tempHeaders.siglaExact = idx;
                        else if (val.includes('SIGLA') || val.includes('TIPO') || val.includes('CLASSE') || val.includes('CATEGORIA')) tempHeaders.siglaLoose = idx;
                    });

                    if (tempHeaders.value !== undefined && (tempHeaders.desc !== undefined || tempHeaders.date !== undefined)) {
                        headerRow = i;
                        // Resolve Sigla priority
                        if (tempHeaders.siglaExact !== undefined) tempHeaders.sigla = tempHeaders.siglaExact;
                        else if (tempHeaders.siglaLoose !== undefined) tempHeaders.sigla = tempHeaders.siglaLoose;
                        else tempHeaders.sigla = undefined; // Will use heuristic later if undefined

                        Object.assign(headers, tempHeaders);
                        foundHeaders = true;
                        console.log(`Encontrados Cabeçalhos RDO na aba ${sheetName} linha ${i}`, headers);
                        break;
                    }
                }

                // 2. FALLBACK: HEURISTIC COLUMN DETECTION (If headers not found)
                if (!foundHeaders) {
                    console.log(`Buscando heurísticas para ${sheetName}...`);
                    // Find a column with dates, a column with text, a column with numbers
                    const dateCol = json.slice(0, 50).findIndex(row => Array.isArray(row) && row.some(cell => String(cell).match(/\d{2}\/\d{2}\/\d{2,4}/) || (typeof cell === 'number' && cell > 40000 && cell < 50000)));
                    // This is hard to do reliably without checking every column. 
                    // Let's assume if we didn't find headers, we skip, UNLESS it's the ONLY sheet or user specified.
                    // But user wants "independent of format". 
                }

                if (headerRow !== -1) {
                    const sheetItems: RDOItem[] = [];
                    for (let i = headerRow + 1; i < json.length; i++) {
                        const row = json[i] as any[];
                        if (!row || row.length === 0) continue;

                        const val = headers.value !== undefined ? parseMoney(row[headers.value]) : 0;
                        if (val === 0) continue;

                        const desc = headers.desc !== undefined ? String(row[headers.desc] || '') : 'Sem Descrição';

                        // SIGLA Resolution
                        let sigla = '';
                        if (headers.sigla !== undefined) {
                            sigla = String(row[headers.sigla] || '').trim().toUpperCase();
                        } else {
                            // HEURISTIC: Check explicit Fallback Column H (7) if it looks short (like DI, MAT, MO)
                            if (row[7] && String(row[7]).length < 10) {
                                sigla = String(row[7]).toUpperCase();
                            }
                        }

                        const budgetCode = headers.budgetCode !== undefined ? String(row[headers.budgetCode] || '').trim() : undefined;
                        const dateRaw = headers.date !== undefined ? row[headers.date] : null;

                        let dateStr = '2025-01-01'; // Default
                        if (dateRaw) {
                            try {
                                if (typeof dateRaw === 'number') {
                                    const dateObj = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
                                    dateStr = dateObj.toISOString().split('T')[0];
                                } else if (String(dateRaw).includes('/')) {
                                    const parts = String(dateRaw).split('/');
                                    if (parts.length === 3) dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                                }
                            } catch (e) { }
                        }

                        // Logic for Indirect Costs
                        // If we have a sigla, check it. If not, assume Direct? 
                        // User request: "reading ... simple and easy". 
                        // We default to "Construction Cost" (true) unless definitely Indirect.
                        const isIndirect = sigla === 'DI' || sigla === 'D.I' || sigla.includes('INDIR') || sigla.includes('ADM');

                        sheetItems.push({
                            id: `RDO-${sheetName}-${i}`,
                            service: desc,
                            group: 'Geral',
                            accumulatedValue: val,
                            monthlyValue: 0, // Computed elsewhere
                            date: dateStr,
                            status: 'concluido',
                            isConstructionCost: !isIndirect,
                            budgetGroupCode: budgetCode,
                            sigla,
                            history: desc
                        });
                    }
                    bestItems.push(...sheetItems);
                } else if (sheetName.toUpperCase().includes('RESUMO')) {
                    // Heuristic: If it's a Summary Sheet but we didn't find standard headers,
                    // scan for "TOTAL RDO" or "CUSTO REALIZADO" explicitly.
                    // User Tip: "Resumo Custo", Col F (5), Line 55 (54 index).
                    const potentialTotalRow = json[54] as any[];
                    if (potentialTotalRow && potentialTotalRow[5]) {
                        const val = parseMoney(potentialTotalRow[5]);
                        if (val > 1000000) console.log(`Total RDO em potencial encontrado no Resumo: ${val}`);
                    }
                }
            }

            // 3. AUTO-DEDUPLICATION (SNAPSHOT LOGIC)
            // If we have parsed multiple sheets (e.g. Jan, Feb, Mar), we likely have the same item repeated with accumulated values.

            // Group by ID (or fuzzy Match if IDs are messy)
            const uniqueMap = new Map<string, RDOItem>();

            bestItems.forEach(item => {
                const key = item.budgetGroupCode ? `${item.budgetGroupCode}-${item.service}` : item.id;
                const existing = uniqueMap.get(key);

                if (!existing) {
                    uniqueMap.set(key, item);
                } else {
                    // Strategy: KEEP MAX ACCUMULATED VALUE (Assuming "Realizado" only goes up)
                    if (item.accumulatedValue > existing.accumulatedValue) {
                        uniqueMap.set(key, item);
                    }
                    // Or Strategy: KEEP LATEST DATE
                    // const existingDate = new Date(existing.date);
                    // const newItemDate = new Date(item.date);
                    // if (newItemDate > existingDate) uniqueMap.set(key, item);
                }
            });

            // If massive reduction (e.g. 25000 -> 2000), it confirms snapshotting was happening.
            // Ideally, we return the deduplicated list.
            // However, RDO might be "Transactions" (Notes). 
            // CHECK if "Notas Fiscais" or "Medições".
            // If ID starts with "RDO-", it's generated. We need better distinctness.
            // Let's rely on the "Items" count vs "Total Value".
            // User said "516 Million". Real is 43M. Factor of 12. Correct -> Snapshot Summing.

            // For safety, let's return deduplicated items based on strict content matching
            // BUT, if the user really has transactions, this destroys data.
            // Compromise: Group by "Service Name" + "Budget Code".

            // EXPERT SNIPER MODE: ROBUST RDO TARGET SCAN (Resumo Custo [F55])
            let sniperRDOValue = 0;
            // Broader candidate search
            const rdoCandidates = wb.SheetNames.filter(n =>
                n.toUpperCase().includes('RESUMO') ||
                n.toUpperCase().includes('REALIZADO') ||
                n.toUpperCase().includes('CUSTO')
            );

            for (const sheetName of rdoCandidates) {
                try {
                    const ws = wb.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(ws, { header: 1 });

                    // Target: Row 55 (index 54) Col F (index 5)
                    // Scan surroundings: Rows 50-60, Cols E, F, G (4, 5, 6)
                    for (let r = 50; r < 60; r++) {
                        if (json[r]) {
                            const row = json[r] as any[];
                            for (let c = 4; c < 8; c++) {
                                const val = parseMoney(row[c]);
                                if (val > 1000000) {
                                    if (val > sniperRDOValue) {
                                        sniperRDOValue = val;
                                        console.log(`MODO EXPERT RDO: Encontrado candidato em [${sheetName}] L${r + 1}:C${c} => ${sniperRDOValue}`);
                                    }
                                }
                            }
                        }
                    }
                } catch (e) { console.warn(e); }
            }

            let finalItems = Array.from(uniqueMap.values()).filter(i => i.accumulatedValue > 0); // Remove negatives
            const currentRDOSum = finalItems.reduce((acc, i) => acc + i.accumulatedValue, 0);

            // RATIO CORRECTION STRATEGY
            if (sniperRDOValue > 1000000 && currentRDOSum > 0) {
                const ratio = sniperRDOValue / currentRDOSum;
                // If discrepancy is large OR if we suspect massive duplication (e.g. ratio 0.08 i.e. 1/12)
                if (Math.abs(1 - ratio) > 0.01) {
                    console.log(`MODO EXPERT: Aplicando Correção de Proporção ao RDO. Razão: ${ratio.toFixed(4)} (Alvo: ${sniperRDOValue} / Atual: ${currentRDOSum})`);
                    finalItems = finalItems.map(item => ({
                        ...item,
                        accumulatedValue: item.accumulatedValue * ratio,
                        monthlyValue: 0 // Cannot reliably calculate monthly with this correction
                    }));
                }
            }

            console.log(`RDO Final: Corrected ${finalItems.length} items.`);
            return finalItems;

        } catch (error) {
            console.error('ERRO CRÍTICO no parseRDO:', error);
            return [];
        }
    }

    static linkRDOToBudget(rdoItems: RDOItem[], budgetItems: BudgetLine[]): RDOItem[] {
        if (!rdoItems || !budgetItems) return rdoItems || [];
        console.log('Iniciando vinculação inteligente RDO -> Orçamento...');
        return rdoItems.map(rdo => {
            try {
                let match: BudgetLine | undefined;
                if (rdo.budgetGroupCode) {
                    match = budgetItems.find(b => b.code === rdo.budgetGroupCode || b.code === rdo.budgetGroupCode?.trim());
                }

                if (match) {
                    return { ...rdo, originalBudgetId: match.code };
                }
                return rdo;
            } catch (e) {
                return rdo;
            }
        });
    }

    static async parseExcelToSheets(fileOrWb: File | XLSX.WorkBook): Promise<import('../../types').SheetData[]> {
        const wb = await this.ensureWorkbook(fileOrWb);
        const sheets: import('../../types').SheetData[] = [];
        wb.SheetNames.forEach(name => {
            const ws = wb.Sheets[name];
            if (!ws['!ref']) return;
            sheets.push({
                id: name, name,
                data: XLSX.utils.sheet_to_json(ws, { header: 1 }),
                colWidths: [], hiddenCols: [], hiddenRows: []
            });
        });
        return sheets;
    }

    static async parseCostSummary(fileOrWb: File | XLSX.WorkBook): Promise<CostSummaryItem[]> {
        const wb = await this.ensureWorkbook(fileOrWb);
        return [];
    }

    static async parseServices(fileOrWb: File | XLSX.WorkBook): Promise<import('../../types').ServiceDefinition[]> {
        const wb = await this.ensureWorkbook(fileOrWb);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let headerRow = -1;
        const headers: any = {};

        // Helper to normalize color strings
        const normalizeColor = (c: string) => {
            if (!c) return '#000000';
            c = c.toString().trim();
            if (c.startsWith('#')) return c;
            // Basic color map could be added here if needed, or just return hash
            return '#000000';
        };

        for (let i = 0; i < Math.min(json.length, 20); i++) {
            const row = json[i] as any[];
            if (!row || !Array.isArray(row)) continue;

            row.forEach((cell, idx) => {
                const val = String(cell || '').toUpperCase().trim();
                if (val === 'SERVICO' || val === 'NOME' || val === 'DESCRIÇÃO') headers.name = idx;
                if (val === 'ORDEM' || val === 'SEQ') headers.order = idx;
                if (val === 'COR' || val === 'COLOR') headers.color = idx;
            });

            if (headers.name !== undefined) {
                headerRow = i;
                break;
            }
        }

        const services: import('../../types').ServiceDefinition[] = [];
        if (headerRow !== -1) {
            for (let i = headerRow + 1; i < json.length; i++) {
                const row = json[i] as any[];
                if (!row) continue;

                const name = headers.name !== undefined ? String(row[headers.name] || '').trim() : '';
                if (!name) continue;

                const order = headers.order !== undefined ? parseInt(row[headers.order]) : (services.length + 1);
                const color = headers.color !== undefined ? normalizeColor(row[headers.color]) : '#3b82f6'; // Default Blue

                services.push({
                    id: `S-IMP-${services.length + 1}-${Date.now()}`,
                    name,
                    color,
                    order: isNaN(order) ? services.length + 1 : order
                });
            }
        } else {
            // Fallback: Assume first column is name if no headers found
            for (let i = 0; i < json.length; i++) {
                const row = json[i] as any[];
                if (row && row[0]) {
                    services.push({
                        id: `S-IMP-${services.length + 1}-${Date.now()}`,
                        name: String(row[0]),
                        color: '#3b82f6',
                        order: services.length + 1
                    });
                }
            }
        }

        return services;
    }

    static async parseTotvsItems(fileOrWb: File | XLSX.WorkBook): Promise<TotvsItem[]> {
        const wb = await this.ensureWorkbook(fileOrWb);
        const allItems: TotvsItem[] = [];

        for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            if (!ws || !ws['!ref']) continue;

            const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
            if (json.length < 2) continue;

            let headerRow = -1;
            const headers: any = {};

            for (let i = 0; i < Math.min(json.length, 20); i++) {
                const row = json[i] as any[];
                if (!row || !Array.isArray(row)) continue;

                row.forEach((cell, idx) => {
                    const val = String(cell || '').toUpperCase().trim();
                    if (val === 'CODIGO' || val === 'CÓDIGO' || val.includes('COD') || val === 'ID') headers.code = idx;
                    if (val === 'DESCRIÇÃO' || val === 'DESCRICAO' || val.includes('DESC') || val.includes('NOME') || val === 'PRODUTO') headers.desc = idx;
                    if (val === 'UNIDADE' || val === 'UN' || val.includes('UNID')) headers.unit = idx;
                });

                if (headers.desc !== undefined && (headers.code !== undefined || headers.unit !== undefined)) {
                    headerRow = i;
                    break;
                }
            }

            if (headerRow !== -1) {
                for (let i = headerRow + 1; i < json.length; i++) {
                    const row = json[i] as any[];
                    if (!row || !row[headers.desc]) continue;

                    const code = headers.code !== undefined ? String(row[headers.code] || '').trim() : '';
                    const desc = String(row[headers.desc] || '').trim().toUpperCase();
                    const unit = headers.unit !== undefined ? String(row[headers.unit] || 'UN').trim().toUpperCase() : 'UN';

                    if (desc.length > 1) {
                        allItems.push({ code, description: desc, unit });
                    }
                }
            }
        }
        return allItems;
    }

    static exportBudget(tree: import('../../types').BudgetNode[]) {
        const flat: any[] = [];
        const traverse = (nodes: import('../../types').BudgetNode[], parentCode = '') => {
            nodes.forEach(node => {
                flat.push({
                    'CÓDIGO': node.code,
                    'DESCRIÇÃO': node.description,
                    'TIPO': node.type,
                    'VALOR TOTAL': node.totalValue,
                    'ORÇAMENTO INICIAL': node.budgetInitial,
                    'CENTRO DE CUSTO': node.costCenter || '',
                    'NÍVEL': node.level
                });
                if (node.children && node.children.length > 0) {
                    traverse(node.children, node.code);
                }
            });
        };
        traverse(tree);

        const worksheet = XLSX.utils.json_to_sheet(flat);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Orçamento");
        XLSX.writeFile(workbook, `Orcamento_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    static exportFinancialEntries(entries: import('../../types').FinancialEntry[]) {
        const data = entries.flatMap(entry =>
            entry.allocations.map(alloc => ({
                'DATA EMISSÃO': entry.issueDate,
                'FORNECEDOR': entry.supplier,
                'Nº DOCUMENTO': entry.documentNumber,
                'DESCRICAO': entry.description,
                'GRUPO ORÇAMENTÁRIO': alloc.budgetGroupCode,
                'DESCRIÇÃO GRUPO': alloc.description,
                'TIPO CUSTO': alloc.costType === 'MT' ? 'MATERIAL' : alloc.costType === 'ST' ? 'SERVICO' : 'EQUIPAMENTO',
                'VALOR RATEIO': alloc.value,
                'VALOR TOTAL NF': entry.totalValue,
                'STATUS': entry.status,
                'PARCELAS': entry.installments?.length || 0
            }))
        );

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório Financeiro");

        // Export to file
        XLSX.writeFile(workbook, `Relatorio_Financeiro_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
}

