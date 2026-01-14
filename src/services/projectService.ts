import { supabase } from './supabase';

export type ProjectRole = 'ADM' | 'GERENTE' | 'ENGENHEIRO' | 'ALMOXARIFE' | 'VIEWER';

export interface Project {
    id: string;
    name: string;
    location: string;
    status: 'ACTIVE' | 'PLANNING' | 'COMPLETED';
    units: number;
    progress: number;
    settings?: {
        cost_centers: { id: string, name: string }[];
    };
}

export const ProjectService = {
    async getProjects(): Promise<Project[]> {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('name');

        if (error) throw error;
        return data as Project[];
    },

    async createProject(project: Omit<Project, 'id' | 'progress'>): Promise<Project> {
        const { data, error } = await supabase
            .from('projects')
            .insert([project])
            .select()
            .single();

        if (error) throw error;
        return data as Project;
    },

    async updateProject(id: string, updates: Partial<Project>): Promise<void> {
        const { error } = await supabase
            .from('projects')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    async deleteProject(id: string): Promise<void> {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // --- RBAC: Member Management ---

    async getProjectMembers(projectId: string): Promise<any[]> {
        // Fetches members and joins with profiles to get names/emails
        const { data, error } = await supabase
            .from('project_members')
            .select(`
                *,
                profile:profiles ( full_name, email, avatar_url )
            `)
            .eq('project_id', projectId);

        if (error) throw error;
        return data || [];
    },

    async addMember(projectId: string, userId: string, role: string): Promise<void> {
        const { error } = await supabase
            .from('project_members')
            .insert([{ project_id: projectId, user_id: userId, role }]);

        if (error) throw error;
    },

    async removeMember(projectId: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('project_members')
            .delete()
            .match({ project_id: projectId, user_id: userId });

        if (error) throw error;
    },

    async updateMemberRole(projectId: string, userId: string, newRole: string): Promise<void> {
        const { error } = await supabase
            .from('project_members')
            .update({ role: newRole })
            .match({ project_id: projectId, user_id: userId });

        if (error) throw error;
    }
};
