import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Plus, Edit, Power, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersAPI } from '../api';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatDateTime } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const ROLES = [
  { value: 'PDG',                 label: 'PDG' },
  { value: 'SECRETAIRE',         label: 'Gestionnaire Chantier' },
  { value: 'CHEF_DE_SITE',       label: 'Responsable Usine' },
  { value: 'ASSISTANT_COMPTABLE',label: 'Comptable Responsable' },
  { value: 'CHEF_COMPTABLE',     label: 'Chef Comptable' },
  { value: 'COMPTABLE',          label: 'Comptable' },
  { value: 'OPERATEUR',          label: 'Opérateur' },
];

const ROLE_COLORS = {
  PDG:                 'bg-purple-100 text-purple-800',
  SECRETAIRE:          'bg-blue-100 text-blue-800',
  CHEF_DE_SITE:        'bg-orange-100 text-orange-800',
  ASSISTANT_COMPTABLE: 'bg-cyan-100 text-cyan-800',
  CHEF_COMPTABLE:      'bg-green-100 text-green-800',
  COMPTABLE:           'bg-teal-100 text-teal-800',
  OPERATEUR:           'bg-gray-100 text-gray-700',
};

const UserModal = ({ user, onClose, onSuccess }) => {
  const isEdit = !!user;
  const [form, setForm] = useState({
    nom:       user?.nom       || '',
    prenom:    user?.prenom    || '',
    email:     user?.email     || '',
    telephone: user?.telephone || '',
    role:      user?.role      || 'OPERATEUR',
    password:  '',
  });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !form.password) return toast.error('Mot de passe requis');
    setLoading(true);
    try {
      const payload = { ...form };
      if (isEdit && !payload.password) delete payload.password;
      if (isEdit) {
        await usersAPI.modifier(user.id, payload);
        toast.success('Utilisateur mis à jour');
      } else {
        await usersAPI.creer(payload);
        toast.success('Utilisateur créé');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Users size={18} className="text-blue-600" />
          {isEdit ? `Modifier — ${user.prenom} ${user.nom}` : 'Nouvel utilisateur'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prénom *</label>
              <input value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})} className="amp-input text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
              <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} className="amp-input text-sm" required />
            </div>
          </div>
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="amp-input text-sm" required />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
            <input value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} className="amp-input text-sm" />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rôle *</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="amp-input text-sm">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {isEdit ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe *'}
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                className="amp-input text-sm pr-10"
              />
              <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-60">
              {loading ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium text-sm">Annuler</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const Utilisateurs = () => {
  const { hasPermission, user: currentUser } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null); // null | 'create' | user object

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.lister(),
    select: r => r.data.data,
  });

  const toggleActif = async (u) => {
    try {
      await usersAPI.modifier(u.id, { isActive: !u.isActive });
      toast.success(u.isActive ? 'Compte désactivé' : 'Compte activé');
      qc.invalidateQueries({ queryKey: ['users'] });
    } catch { toast.error('Erreur'); }
  };

  const onSuccess = () => {
    setModal(null);
    qc.invalidateQueries({ queryKey: ['users'] });
  };

  if (isLoading) return <PageLoader />;

  const canCreate = hasPermission('user:create');
  const canEdit   = hasPermission('user:update');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck size={22} className="text-blue-600" /> Gestion des utilisateurs
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{users?.length || 0} compte(s) dans le système</p>
        </div>
        {canCreate && (
          <button onClick={() => setModal('create')} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={15} /> Nouvel utilisateur
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="amp-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Nom', 'Email', 'Rôle', 'Téléphone', 'Dernière connexion', 'Statut', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users?.map(u => (
              <tr key={u.id} className={cn('hover:bg-gray-50 transition-colors', !u.isActive && 'opacity-50')}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {u.prenom?.[0]}{u.nom?.[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{u.prenom} {u.nom}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600')}>
                    {ROLES.find(r => r.value === u.role)?.label || u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{u.telephone || '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{u.lastLogin ? formatDateTime(u.lastLogin) : 'Jamais'}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                    {u.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {canEdit && (
                      <button onClick={() => setModal(u)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors" title="Modifier">
                        <Edit size={14} />
                      </button>
                    )}
                    {canEdit && u.id !== currentUser?.id && (
                      <button onClick={() => toggleActif(u)} className={cn('p-1.5 rounded-lg transition-colors', u.isActive ? 'hover:bg-red-50 text-red-500' : 'hover:bg-green-50 text-green-600')} title={u.isActive ? 'Désactiver' : 'Activer'}>
                        <Power size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <UserModal
          user={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
};

export default Utilisateurs;
