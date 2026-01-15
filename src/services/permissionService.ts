/**
 * Permission Service
 * Centraliza o controle de permissões por role (perfil de usuário)
 */

export type Permission =
    | 'VIEW_ALL'
    | 'EDIT_BUDGET'
    | 'EDIT_FINANCIAL'
    | 'EDIT_VISUAL_MGMT'
    | 'APPROVE_PURCHASES'
    | 'EDIT_WAREHOUSE'
    | 'CREATE_PURCHASE_REQUESTS'
    | 'ADMIN_PANEL';

interface RolePermissions {
    [key: string]: Permission[];
}

export class PermissionService {
    /**
     * Mapeamento de roles para suas permissões
     */
    private static rolePermissions: RolePermissions = {
        'ADM': [
            'VIEW_ALL',
            'EDIT_BUDGET',
            'EDIT_FINANCIAL',
            'EDIT_VISUAL_MGMT',
            'APPROVE_PURCHASES',
            'EDIT_WAREHOUSE',
            'CREATE_PURCHASE_REQUESTS',
            'ADMIN_PANEL'
        ],
        'GERENTE': [
            'VIEW_ALL',
            'EDIT_BUDGET',
            'EDIT_FINANCIAL',
            'EDIT_VISUAL_MGMT',
            'APPROVE_PURCHASES',
            'EDIT_WAREHOUSE',
            'CREATE_PURCHASE_REQUESTS'
        ],
        'ENGENHEIRO': [
            'VIEW_ALL',
            'EDIT_BUDGET',
            'EDIT_FINANCIAL',
            'EDIT_VISUAL_MGMT',
            'EDIT_WAREHOUSE',
            'CREATE_PURCHASE_REQUESTS'
            // NÃO TEM: APPROVE_PURCHASES
        ],
        'ALMOXARIFE': [
            'VIEW_ALL',
            'EDIT_WAREHOUSE'
        ],
        'VIEWER': [
            'VIEW_ALL'
        ]
    };

    /**
     * Verifica se um role tem uma permissão específica
     */
    static hasPermission(userRole: string, permission: Permission): boolean {
        const roleKey = (userRole || 'VIEWER').toUpperCase();
        const permissions = this.rolePermissions[roleKey] || [];
        return permissions.includes(permission);
    }

    /**
     * Verifica se pode editar o almoxarifado
     */
    static canEditWarehouse(userRole: string): boolean {
        return this.hasPermission(userRole, 'EDIT_WAREHOUSE');
    }

    /**
     * Verifica se pode aprovar compras (apenas GERENTE e ADM)
     */
    static canApprovePurchases(userRole: string): boolean {
        return this.hasPermission(userRole, 'APPROVE_PURCHASES');
    }

    /**
     * Verifica se pode criar solicitações de compra
     */
    static canCreatePurchaseRequests(userRole: string): boolean {
        return this.hasPermission(userRole, 'CREATE_PURCHASE_REQUESTS');
    }

    /**
     * Verifica se pode editar orçamento
     */
    static canEditBudget(userRole: string): boolean {
        return this.hasPermission(userRole, 'EDIT_BUDGET');
    }

    /**
     * Verifica se pode editar dados financeiros
     */
    static canEditFinancial(userRole: string): boolean {
        return this.hasPermission(userRole, 'EDIT_FINANCIAL');
    }

    /**
     * Verifica se pode editar gestão visual
     */
    static canEditVisualMgmt(userRole: string): boolean {
        return this.hasPermission(userRole, 'EDIT_VISUAL_MGMT');
    }

    /**
     * Verifica se é administrador (acesso ao painel admin)
     */
    static isAdmin(userRole: string): boolean {
        return this.hasPermission(userRole, 'ADMIN_PANEL');
    }

    /**
     * Retorna nome legível do role
     */
    static getRoleDisplayName(role: string): string {
        const displayNames: { [key: string]: string } = {
            'ADM': 'Administrador',
            'GERENTE': 'Gerente',
            'ENGENHEIRO': 'Engenheiro',
            'ALMOXARIFE': 'Almoxarife',
            'VIEWER': 'Visualizador'
        };
        return displayNames[role] || role;
    }

    /**
     * Retorna cor do badge para o role
     */
    static getRoleBadgeColor(role: string): string {
        const colors: { [key: string]: string } = {
            'ADM': 'bg-purple-100 text-purple-700',
            'GERENTE': 'bg-indigo-100 text-indigo-700',
            'ENGENHEIRO': 'bg-blue-100 text-blue-700',
            'ALMOXARIFE': 'bg-orange-100 text-orange-700',
            'VIEWER': 'bg-slate-100 text-slate-600'
        };
        return colors[role] || 'bg-slate-100 text-slate-600';
    }
}
