import React, { useState, useEffect } from 'react';
import { Users, Building, Shield, Plus, MoreHorizontal, Search, Trash2, Edit2, CheckCircle, XCircle, ChevronRight, Lock, Loader2, UserPlus, X } from 'lucide-react';
import { ProjectService, Project } from '../services/projectService';
import { UserService, Profile } from '../services/userService';

interface AdminViewProps {
    onProjectCreated?: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ onProjectCreated }) => {
    const [activeTab, setActiveTab] = useState<'projects' | 'users' | 'roles'>('projects');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);

    // Form state
    const [newName, setNewName] = useState('');
    const [newLocation, setNewLocation] = useState('');
    const [newUnits, setNewUnits] = useState(0);

    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<Profile[]>([]);

    // Members Modal State
    const [manageMembersProjectId, setManageMembersProjectId] = useState<string | null>(null);
    const [projectMembers, setProjectMembers] = useState<any[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [selectedUserToAdd, setSelectedUserToAdd] = useState<string>("");
    const [selectedRoleToAdd, setSelectedRoleToAdd] = useState<string>("VIEWER");

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'projects') {
                const data = await ProjectService.getProjects();
                setProjects(data);
            } else if (activeTab === 'users') {
                const data = await UserService.getProfiles();
                setUsers(data);
            }
        } catch (error) {
            console.error("Failed to load admin data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await ProjectService.createProject({
                name: newName,
                location: newLocation,
                status: 'PLANNING',
                units: newUnits
            });
            setShowNewProjectModal(false);
            setNewName('');
            setNewLocation('');
            setNewUnits(0);
            await loadData();
            if (onProjectCreated) onProjectCreated();
        } catch (error: any) {
            console.error("Failed to create project", error);
            alert(`Erro ao criar obra: ${error.message || JSON.stringify(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProject = async (id: string) => {
        if (!window.confirm("Deseja realmente excluir esta obra? Todos os dados vinculados serão perdidos.")) return;
        setLoading(true);
        try {
            await ProjectService.deleteProject(id);
            await loadData();
            if (onProjectCreated) onProjectCreated();
        } catch (error) {
            console.error("Failed to delete project", error);
            alert("Erro ao excluir obra.");
        } finally {
            setLoading(false);
        }
    };

    const openMembersModal = async (projectId: string) => {
        setManageMembersProjectId(projectId);
        setLoadingMembers(true);
        // Load all users for the dropdown to add
        if (users.length === 0) {
            const allUsers = await UserService.getProfiles();
            setUsers(allUsers);
        }
        try {
            const members = await ProjectService.getProjectMembers(projectId);
            setProjectMembers(members);
        } catch (error) {
            console.error("Failed to load members", error);
        } finally {
            setLoadingMembers(false);
        }
    };

    const handleAddMember = async () => {
        if (!selectedUserToAdd || !manageMembersProjectId) return;
        try {
            await ProjectService.addMember(manageMembersProjectId, selectedUserToAdd, selectedRoleToAdd);
            // Reload members
            const members = await ProjectService.getProjectMembers(manageMembersProjectId);
            setProjectMembers(members);
            setSelectedUserToAdd("");
        } catch (e) {
            alert("Erro ao adicionar membro ou usuário já existe no projeto.");
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!manageMembersProjectId || !window.confirm("Remover este usuário da equipe?")) return;
        try {
            await ProjectService.removeMember(manageMembersProjectId, userId);
            setProjectMembers(prev => prev.filter(m => m.user_id !== userId));
        } catch (e) {
            console.error(e);
            alert("Erro ao remover membro.");
        }
    };

    const renderProjects = () => (
        <div className="space-y-6">
            {/* New Project Modal */}
            {showNewProjectModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-slate-800 mb-6 uppercase tracking-tight">Nova Obra</h2>
                        <form onSubmit={handleCreateProject} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Empreendimento</label>
                                <input
                                    required
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="Ex: Residencial Jardins"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Localização (Cidade, UF)</label>
                                <input
                                    required
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={newLocation}
                                    onChange={e => setNewLocation(e.target.value)}
                                    placeholder="Ex: São Paulo, SP"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Total de Unidades</label>
                                <input
                                    type="number"
                                    required
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={newUnits}
                                    onChange={e => setNewUnits(parseInt(e.target.value))}
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setShowNewProjectModal(false)}
                                    className="px-4 py-2 text-slate-500 font-bold uppercase text-xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold uppercase text-xs hover:bg-indigo-700 transition-colors shadow-lg flex items-center gap-2"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : 'Criar Obra'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manage Members Modal */}
            {manageMembersProjectId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-0 overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Gestão de Equipe</h2>
                                <p className="text-xs text-slate-500">
                                    Obra: {projects.find(p => p.id === manageMembersProjectId)?.name}
                                </p>
                            </div>
                            <button onClick={() => setManageMembersProjectId(null)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {/* Add Member Form */}
                            <div className="bg-indigo-50 p-4 rounded-lg mb-6 border border-indigo-100">
                                <h4 className="text-xs font-bold text-indigo-800 uppercase mb-3 flex items-center gap-2">
                                    <UserPlus size={14} /> Adicionar Membro
                                </h4>
                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 text-sm border-slate-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={selectedUserToAdd}
                                        onChange={e => setSelectedUserToAdd(e.target.value)}
                                    >
                                        <option value="">Selecione um usuário...</option>
                                        {users.filter(u => !projectMembers.some(pm => pm.user_id === u.id)).map(user => (
                                            <option key={user.id} value={user.id}>
                                                {user.full_name || user.email} ({user.email})
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        className="w-32 text-sm border-slate-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-600"
                                        value={selectedRoleToAdd}
                                        onChange={e => setSelectedRoleToAdd(e.target.value)}
                                    >
                                        <option value="VIEWER">Visualizador</option>
                                        <option value="ALMOXARIFE">Almoxarife</option>
                                        <option value="ENGENHEIRO">Engenheiro</option>
                                        <option value="GERENTE">Gerente</option>
                                        <option value="ADM">ADM</option>
                                    </select>
                                    <button
                                        onClick={handleAddMember}
                                        disabled={!selectedUserToAdd}
                                        className="bg-indigo-600 text-white font-bold px-4 py-1 rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                            </div>

                            {/* Members List */}
                            {loadingMembers ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600" /></div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100">
                                        <tr>
                                            <th className="text-left pb-2 pl-2">Nome</th>
                                            <th className="text-left pb-2">Função</th>
                                            <th className="text-right pb-2 pr-2">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {projectMembers.map(member => (
                                            <tr key={member.id} className="group hover:bg-slate-50">
                                                <td className="py-3 pl-2">
                                                    <div className="font-bold text-slate-700">{member.profile?.full_name || 'Usuário'}</div>
                                                    <div className="text-xs text-slate-400">{member.profile?.email}</div>
                                                </td>
                                                <td className="py-3">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${member.role === 'ADM' ? 'bg-slate-900 text-white' :
                                                            member.role === 'GERENTE' ? 'bg-purple-100 text-purple-700' :
                                                                member.role === 'ENGENHEIRO' ? 'bg-blue-100 text-blue-700' :
                                                                    member.role === 'ALMOXARIFE' ? 'bg-orange-100 text-orange-700' :
                                                                        'bg-slate-100 text-slate-600'
                                                        }`}>
                                                        {member.role}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-right pr-2">
                                                    <button
                                                        onClick={() => handleRemoveMember(member.user_id)}
                                                        className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all"
                                                        title="Remover da equipe"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {projectMembers.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="text-center py-8 text-slate-400 italic">
                                                    Nenhum membro nesta equipe ainda.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar obras..."
                        className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setShowNewProjectModal(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold uppercase flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={16} /> Nova Obra
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-slate-800">
                {projects.map(project => (
                    <div key={project.id} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow relative group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                                <Building size={24} />
                            </div>
                            <button
                                onClick={() => handleDeleteProject(project.id)}
                                className="text-slate-300 hover:text-red-600 transition-colors p-2"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 mb-1">{project.name}</h3>
                        <p className="text-sm text-slate-500 mb-4 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            {project.location}
                        </p>

                        <div className="space-y-3">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500 font-medium uppercase">Status</span>
                                <span className={`px-2 py-0.5 rounded-full font-bold ${project.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                                    project.status === 'PLANNING' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                    {project.status === 'ACTIVE' ? 'Em Andamento' : project.status === 'PLANNING' ? 'Planejamento' : 'Concluído'}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500 font-medium uppercase">Unidades</span>
                                <span className="font-mono text-slate-700 font-bold">{project.units}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${project.progress}%` }}></div>
                            </div>

                            {/* Team Preview Avatars (Placeholder) */}
                            <div className="flex items-center gap-[-8px] mt-2 pt-2 border-t border-slate-50">
                                <span className="text-[10px] font-bold text-slate-400 mr-2 uppercase">Equipe:</span>
                                {/* This would dynamic in a real scenario */}
                                <div className="flex -space-x-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-500">AD</div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                            <button
                                onClick={() => openMembersModal(project.id)}
                                className="text-xs font-bold text-slate-500 flex items-center gap-1 hover:text-indigo-600 transition-colors"
                            >
                                <Users size={14} /> Equipe
                            </button>
                            <button className="text-sm text-indigo-600 font-bold flex items-center gap-1 hover:underline">
                                Detalhes <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const handleUpdateRole = async (userId: string, newRole: 'ADM' | 'GERENTE' | 'ENGENHEIRO' | 'ALMOXARIFE' | 'VIEWER') => {
        try {
            await UserService.updateRole(userId, newRole);
            await loadData();
        } catch (error) {
            console.error("Failed to update role", error);
            alert("Erro ao atualizar perfil.");
        }
    };

    const renderUsers = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center text-slate-800">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar usuários..."
                        className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-4 text-left">Nome / Email</th>
                            <th className="p-4 text-left">Perfil Global</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4">
                                    <div className="font-bold text-slate-800">{user.full_name || 'Usuário sem nome'}</div>
                                    <div className="text-xs text-slate-500">{user.email}</div>
                                </td>
                                <td className="p-4">
                                    <select
                                        value={user.role}
                                        onChange={(e) => handleUpdateRole(user.id, e.target.value as any)}
                                        className="text-xs font-bold px-2 py-1 rounded border bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="VIEWER">VIEWER</option>
                                        <option value="ALMOXARIFE">ALMOXARIFE</option>
                                        <option value="ENGENHEIRO">ENGENHEIRO</option>
                                        <option value="GERENTE">GERENTE</option>
                                        <option value="ADM">ADM</option>
                                    </select>
                                </td>
                                <td className="p-4 text-center">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                                        <CheckCircle size={10} /> Ativo
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded transition-colors" title="Remover">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="bg-slate-900 text-white p-6 shadow-md z-10">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                            <Shield className="text-indigo-400" /> Painel Administrativo
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">Gestão de Obras, Usuários e Permissões de Acesso</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-slate-200 px-6">
                <div className="flex gap-6">
                    <button
                        onClick={() => setActiveTab('projects')}
                        className={`py-4 text-sm font-bold uppercase tracking-wide border-b-2 transition-all ${activeTab === 'projects' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Building size={16} /> Obras & Projetos
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`py-4 text-sm font-bold uppercase tracking-wide border-b-2 transition-all ${activeTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Users size={16} /> Usuários & Equipes
                        </div>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'projects' && renderProjects()}
                {activeTab === 'users' && renderUsers()}
            </div>
        </div>
    );
};
