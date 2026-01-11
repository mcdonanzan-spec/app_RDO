import { supabase } from './supabase';
import { BudgetNode } from '../../types';

interface DBBudgetItem {
    id: string;
    code: string;
    description: string;
    level: number;
    type: 'GROUP' | 'ITEM';
    item_type?: string;
    parent_id?: string;
    budget_initial: number;
    budget_current: number;
    cost_center?: string;
}

const isUUID = (str: string) => {
    if (!str) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
};

export const BudgetService = {
    sanitizeTree(nodes: BudgetNode[], parentCostCenter?: string): BudgetNode[] {
        return nodes.map(node => {
            const sanitizedNode = { ...node };

            // 1. Ensure UUID
            if (!isUUID(sanitizedNode.id)) {
                console.log(`Fixing non-UUID ID: ${sanitizedNode.id}`);
                sanitizedNode.id = crypto.randomUUID();
            }

            // 2. Propage Cost Center if missing
            if (!sanitizedNode.costCenter || sanitizedNode.costCenter === 'ALL') {
                sanitizedNode.costCenter = node.costCenter || parentCostCenter;
            }

            // 3. Recurse for children
            if (sanitizedNode.children && sanitizedNode.children.length > 0) {
                sanitizedNode.children = this.sanitizeTree(sanitizedNode.children, sanitizedNode.costCenter);
                // Update parentId of children to match current node's (possibly new) ID
                sanitizedNode.children = sanitizedNode.children.map(child => ({ ...child, parentId: sanitizedNode.id }));
            }

            return sanitizedNode;
        });
    },

    async getBudgetTree(projectId: string): Promise<BudgetNode[]> {
        const { data, error } = await supabase
            .from('budget_items')
            .select('*')
            .eq('project_id', projectId)
            .order('code');

        if (error) throw error;

        // Reconstruct Tree
        const nodes = data as DBBudgetItem[];
        const nodeMap = new Map<string, BudgetNode>();
        const rootNodes: BudgetNode[] = [];

        // 1. Create nodes
        nodes.forEach(n => {
            nodeMap.set(n.id, {
                id: n.id,
                code: n.code,
                description: n.description,
                level: n.level,
                type: n.type,
                itemType: n.item_type as any,
                totalValue: Number(n.budget_initial) || 0,
                budgetInitial: Number(n.budget_initial) || 0,
                budgetCurrent: Number(n.budget_current) || 0,
                realizedRDO: 0,
                realizedFinancial: 0,
                committed: 0,
                children: [],
                parentId: n.parent_id,
                costCenter: n.cost_center
            });
        });

        // 2. Build Hierarchy
        nodes.forEach(n => {
            const node = nodeMap.get(n.id)!;
            if (n.parent_id && nodeMap.has(n.parent_id)) {
                const parent = nodeMap.get(n.parent_id)!;
                parent.children.push(node);
            } else {
                rootNodes.push(node);
            }
        });

        // 3. Recalculate Totals (re-sum parents from children)
        const recalculateInternal = (treeNodes: BudgetNode[]): { nodes: BudgetNode[], total: number } => {
            let sum = 0;
            const updated = treeNodes.map(node => {
                if (node.children && node.children.length > 0) {
                    const { nodes: children, total } = recalculateInternal(node.children);
                    return { ...node, children, totalValue: total, budgetInitial: total, budgetCurrent: total };
                }
                const val = node.totalValue || 0;
                return { ...node, totalValue: val, budgetInitial: val, budgetCurrent: val };
            });
            sum = updated.reduce((acc, n) => acc + n.totalValue, 0);
            return { nodes: updated, total: sum };
        };

        return this.sortTreeRecursively(recalculateInternal(rootNodes).nodes);
    },

    async getRDOItems(projectId: string): Promise<import('../../types').RDOItem[]> {
        const { data, error } = await supabase
            .from('rdo_items')
            .select('*')
            .eq('project_id', projectId);

        if (error) throw error;

        return data.map((d: any) => ({
            id: d.id,
            date: d.date,
            status: 'concluido',
            accumulatedValue: Number(d.accumulated_value),
            monthlyValue: 0,
            group: 'N/A',
            service: d.description,
            code: d.code,
            description: d.description
        }));
    },

    async saveBudgetTree(nodes: BudgetNode[], projectId: string): Promise<void> {
        // Flatten tree for storage
        const flatItems: any[] = [];

        const processNode = (node: BudgetNode, parentId?: string) => {
            flatItems.push({
                id: node.id,
                project_id: projectId,
                code: node.code,
                description: node.description,
                level: node.level,
                type: node.type,
                item_type: node.itemType,
                parent_id: parentId,
                budget_initial: node.budgetInitial,
                budget_current: node.budgetCurrent,
                cost_center: node.costCenter
            });

            if (node.children) {
                node.children.forEach(child => processNode(child, node.id));
            }
        };

        nodes.forEach(n => processNode(n));

        // Use upsert
        const { error } = await supabase.from('budget_items').upsert(flatItems);
        if (error) {
            console.error("Supabase Save Error:", error);
            throw new Error(`Erro Supabase: ${error.message} (${error.code}) - Tabela: budget_items`);
        }
    },

    compareCodes(aCode: string, bCode: string): number {
        const aParts = aCode.toUpperCase().split('.');
        const bParts = bCode.toUpperCase().split('.');
        const minLen = Math.min(aParts.length, bParts.length);

        for (let i = 0; i < minLen; i++) {
            const partA = aParts[i].trim();
            const partB = bParts[i].trim();

            if (partA !== partB) {
                // Custom order for resource suffixes: MT > ST > EQ
                const resourceOrder: Record<string, number> = { 'MT': 1, 'ST': 2, 'EQ': 3 };
                const orderA = resourceOrder[partA] || 99;
                const orderB = resourceOrder[partB] || 99;

                if (orderA !== orderB) return orderA - orderB;

                // Native numeric comparison for normal parts
                return partA.localeCompare(partB, undefined, { numeric: true });
            }
        }
        return aParts.length - bParts.length;
    },

    getNormalizedItemType(type: string | undefined, code: string): 'MT' | 'ST' | 'EQ' | undefined {
        const c = code.toUpperCase();
        if (c.endsWith('.MT')) return 'MT';
        if (c.endsWith('.ST')) return 'ST';
        if (c.endsWith('.EQ')) return 'EQ';

        const t = (type || '').trim().toUpperCase();
        if (t === 'MT' || t === 'MATERIAL') return 'MT';
        if (t === 'ST' || t === 'SERVIÇO' || t === 'SERVICO' || t === 'SERVIÇOS' || t === 'SERVICOS') return 'ST';
        if (t === 'EQ' || t === 'EQUIPAMENTO' || t === 'EQUIPAMENTOS') return 'EQ';

        return undefined;
    },

    sortTreeRecursively(nodes: BudgetNode[]): BudgetNode[] {
        if (!nodes) return [];
        // Sort current level
        const sorted = [...nodes].sort((a, b) => this.compareCodes(a.code, b.code));
        // Sort children
        sorted.forEach(node => {
            if (node.children && node.children.length > 0) {
                node.children = this.sortTreeRecursively(node.children);
            }
        });
        return sorted;
    },

    getConsolidatedTree(nodes: BudgetNode[]): BudgetNode[] {
        if (!nodes || nodes.length === 0) return [];

        // 1. Flatten all nodes to aggregate by code
        const aggregatedMap = new Map<string, BudgetNode>();

        const flattenAndCollect = (treeNodes: BudgetNode[]) => {
            treeNodes.forEach(node => {
                const key = node.code;
                if (aggregatedMap.has(key)) {
                    const existing = aggregatedMap.get(key)!;
                    existing.totalValue = parseFloat((existing.totalValue + node.totalValue).toFixed(2));
                    existing.budgetInitial = parseFloat((existing.budgetInitial + node.budgetInitial).toFixed(2));
                    existing.budgetCurrent = parseFloat((existing.budgetCurrent + node.budgetCurrent).toFixed(2));
                } else {
                    // Create a copy without children to aggregate
                    aggregatedMap.set(key, { ...node, children: [], costCenter: 'CONSOLIDADO', id: `consolidated-${node.code}` });
                }
                if (node.children) flattenAndCollect(node.children);
            });
        };

        flattenAndCollect(nodes);

        // 2. Rebuild tree from aggregated nodes
        const sortedItems = Array.from(aggregatedMap.values()).sort((a, b) => this.compareCodes(a.code, b.code));

        const rootNodes: BudgetNode[] = [];
        const tempMap = new Map<string, BudgetNode>();
        sortedItems.forEach(n => tempMap.set(n.code, n));

        sortedItems.forEach(node => {
            const lastDotIndex = node.code.lastIndexOf('.');
            if (lastDotIndex !== -1) {
                const parentCode = node.code.substring(0, lastDotIndex);
                const parent = tempMap.get(parentCode);
                if (parent) {
                    parent.children.push(node);
                    parent.type = 'GROUP';
                } else {
                    rootNodes.push(node);
                }
            } else {
                rootNodes.push(node);
            }
        });

        return rootNodes;
    }
};
