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
    children?: DBBudgetItem[];
}

export const BudgetService = {
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
                totalValue: 0, // Calculated later or on demand
                budgetInitial: Number(n.budget_initial),
                budgetCurrent: Number(n.budget_current),
                realizedRDO: 0,
                realizedFinancial: 0,
                committed: 0,
                children: [] // Will be populated
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

        return rootNodes;
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
            status: 'concluido', // Default
            accumulatedValue: Number(d.accumulated_value),
            monthlyValue: 0, // Not stored primarily
            group: 'N/A', // Derived from budget code usually
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
                id: node.id, // Ensure UUID or generate
                project_id: projectId,
                code: node.code,
                description: node.description,
                level: node.level,
                type: node.type,
                item_type: node.itemType,
                parent_id: parentId,
                budget_initial: node.budgetInitial,
                budget_current: node.budgetCurrent
            });

            node.children.forEach(child => processNode(child, node.id));
        };

        nodes.forEach(n => processNode(n));

        // Use upsert
        const { error } = await supabase.from('budget_items').upsert(flatItems);
        if (error) throw error;
    }
};
