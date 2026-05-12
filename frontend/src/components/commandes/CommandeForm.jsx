import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Calculator, Save, X, Edit3, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { formulationsAPI, commandesAPI } from '../../api';
import { formatMontant } from '../../utils/formatters';

const schema = z.object({
  nomClient: z.string().min(2, 'Nom requis (min 2 caractères)'),
  telephone: z.string().min(8, 'Numéro invalide'),
  adresseChantier: z.string().min(5, 'Adresse requise'),
  volumeBeton: z.coerce.number().positive('Volume doit être positif'),
  typeBeton: z.string().min(1, 'Type béton requis'),
  dateLivraison: z.string().min(1, 'Date requise'),
  montantCommande: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive('Montant doit être positif').optional()
  ),
  observations: z.string().optional(),
});

const CommandeForm = ({ commande, onSuccess, onCancel }) => {
  const isEdit = !!commande;
  const [calculs, setCalculs] = useState(null);
  const [calculsLoading, setCalculsLoading] = useState(false);
  const [overrides, setOverrides] = useState({});  // valeurs manuellement modifiées
  const [showDetails, setShowDetails] = useState(false);
  const [formulationId, setFormulationId] = useState(commande?.formulationId || '');

  const { data: formulationsData } = useQuery({
    queryKey: ['formulations'],
    queryFn: () => formulationsAPI.lister(),
    select: (res) => res.data.data,
  });

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: commande ? {
      nomClient: commande.nomClient,
      telephone: commande.telephone,
      adresseChantier: commande.adresseChantier,
      volumeBeton: commande.volumeBeton,
      typeBeton: commande.typeBeton,
      dateLivraison: commande.dateLivraison?.split('T')[0],
      montantCommande: commande.montantCommande || '',
      observations: commande.observations || '',
    } : {},
  });

  const [volume, typeBeton, montantCommande] = watch(['volumeBeton', 'typeBeton', 'montantCommande']);

  // Auto-sélection de la formulation quand le type béton change
  useEffect(() => {
    if (typeBeton && formulationsData) {
      const found = formulationsData.find((f) => f.typeBeton === typeBeton);
      if (found) {
        setFormulationId(found.id);
        setOverrides({});
      }
    }
  }, [typeBeton, formulationsData]);

  // Calcul automatique dès qu'on a volume + formulation
  useEffect(() => {
    if (!volume || !formulationId) { setCalculs(null); return; }
    const timer = setTimeout(async () => {
      setCalculsLoading(true);
      try {
        const res = await formulationsAPI.calculer({
          volume,
          formulationId,
          montantCommande: montantCommande || 0,
        });
        setCalculs(res.data.data);
        setOverrides({});
      } catch (e) {
        console.error('Calcul error:', e);
      } finally {
        setCalculsLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [volume, formulationId, montantCommande]);

  const valeur = (key) => overrides[key] !== undefined ? overrides[key] : (calculs?.[key] ?? '');
  const setOverride = (key, val) => setOverrides((prev) => ({ ...prev, [key]: val === '' ? undefined : Number(val) }));
  const resetOverrides = () => setOverrides({});

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        formulationId: formulationId || undefined,
        // Envoyer les overrides si l'utilisateur a modifié des calculs
        ...(Object.keys(overrides).length > 0 ? {
          _calculsOverrides: {
            ...calculs,
            ...overrides,
          }
        } : {}),
      };

      if (isEdit) {
        await commandesAPI.modifier(commande.id, payload);
        toast.success('Commande modifiée avec succès');
      } else {
        await commandesAPI.creer(payload);
        toast.success('Commande créée et envoyée pour validation ✓');
      }
      onSuccess?.();
    } catch (err) {
      console.error('Erreur création commande:', err.response?.data || err.message);
      toast.error(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
    }
  };

  const calcFields = calculs ? [
    { key: 'totalCiment', label: 'Ciment total', unit: 'kg', section: 'matieres' },
    { key: 'totalSable', label: 'Sable', unit: 'm³', section: 'matieres' },
    { key: 'totalGravier515', label: 'Gravier 5/15', unit: 't', section: 'matieres' },
    { key: 'totalGravier1525', label: 'Gravier 15/25', unit: 't', section: 'matieres' },
    { key: 'totalGasoil', label: 'Gasoil total', unit: 'L', section: 'matieres' },
    { key: 'coutMateriaux', label: 'Coût matières', unit: 'FCFA', section: 'couts', money: true },
    { key: 'coutGasoil', label: 'Coût gasoil', unit: 'FCFA', section: 'couts', money: true },
    { key: 'coutAmortissement', label: 'Amortissements', unit: 'FCFA', section: 'couts', money: true },
    { key: 'coutPersonnel', label: 'Personnel', unit: 'FCFA', section: 'couts', money: true },
    { key: 'coutTotal', label: 'Coût total production', unit: 'FCFA', section: 'totaux', money: true, highlight: true },
    { key: 'coutUnitaire', label: 'Coût / m³', unit: 'FCFA/m³', section: 'totaux', money: true },
    { key: 'margePrevisionnelle', label: 'Marge prévisionnelle', unit: 'FCFA', section: 'totaux', money: true, green: true },
    { key: 'tauxMarge', label: 'Taux de marge', unit: '%', section: 'totaux' },
  ] : [];

  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* Informations client */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Informations client</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du client *</label>
            <input {...register('nomClient')} placeholder="Ex : NOVA LUX SARL" className="amp-input" />
            {errors.nomClient && <p className="text-red-500 text-xs mt-1">{errors.nomClient.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
            <input {...register('telephone')} placeholder="+226 70 XX XX XX" className="amp-input" />
            {errors.telephone && <p className="text-red-500 text-xs mt-1">{errors.telephone.message}</p>}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse du chantier *</label>
            <input {...register('adresseChantier')} placeholder="Ex : Kanis Soleil, Secteur 30, Ouagadougou" className="amp-input" />
            {errors.adresseChantier && <p className="text-red-500 text-xs mt-1">{errors.adresseChantier.message}</p>}
          </div>
        </div>
      </div>

      {/* Détails commande */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Détails de la commande</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Volume (m³) *</label>
            <input {...register('volumeBeton')} type="number" step="0.5" min="1" placeholder="200" className="amp-input" />
            {errors.volumeBeton && <p className="text-red-500 text-xs mt-1">{errors.volumeBeton.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de béton *</label>
            <select {...register('typeBeton')} className="amp-input">
              <option value="">Sélectionner...</option>
              {formulationsData?.map((f) => (
                <option key={f.id} value={f.typeBeton}>{f.typeBeton} — {f.nom}</option>
              ))}
            </select>
            {errors.typeBeton && <p className="text-red-500 text-xs mt-1">{errors.typeBeton.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de livraison *</label>
            <input {...register('dateLivraison')} type="date" min={new Date().toISOString().split('T')[0]} className="amp-input" />
            {errors.dateLivraison && <p className="text-red-500 text-xs mt-1">{errors.dateLivraison.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Montant vendu (FCFA)</label>
            <input {...register('montantCommande')} type="number" placeholder="Ex : 21 000 000" className="amp-input" />
            {errors.montantCommande && <p className="text-red-500 text-xs mt-1">{errors.montantCommande.message}</p>}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
            <textarea {...register('observations')} rows={2} placeholder="Remarques, conditions particulières..." className="amp-input resize-none" />
          </div>
        </div>
      </div>

      {/* Calculs automatiques */}
      {(calculs || calculsLoading) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-blue-200 rounded-xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-blue-50 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator size={16} className="text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">Calculs automatiques</span>
              {calculsLoading && <span className="text-xs text-blue-400 animate-pulse">Calcul...</span>}
              {hasOverrides && (
                <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Edit3 size={10} /> Modifié manuellement
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasOverrides && (
                <button type="button" onClick={resetOverrides} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <RefreshCw size={12} /> Réinitialiser
                </button>
              )}
              <button type="button" onClick={() => setShowDetails((v) => !v)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showDetails ? 'Masquer détails' : 'Voir détails'}
              </button>
            </div>
          </div>

          {/* KPIs résumé toujours visibles */}
          {calculs && (
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 bg-white">
              {[
                { key: 'coutTotal', label: 'Coût production', highlight: true, money: true },
                { key: 'coutUnitaire', label: 'Coût / m³', money: true },
                { key: 'margePrevisionnelle', label: 'Marge prév.', green: (overrides.margePrevisionnelle ?? calculs.margePrevisionnelle) > 0, money: true },
                { key: 'tauxMarge', label: 'Taux marge', unit: '%' },
              ].map(({ key, label, highlight, green, money, unit }) => {
                const v = valeur(key);
                return (
                  <div key={key} className={`rounded-lg p-2.5 border ${highlight ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                    <input
                      type="number"
                      value={v}
                      onChange={(e) => setOverride(key, e.target.value)}
                      className={`w-full bg-transparent text-sm font-bold border-b border-dashed border-transparent hover:border-blue-300 focus:border-blue-400 focus:outline-none ${green ? 'text-green-600' : highlight ? 'text-blue-700' : 'text-gray-800'}`}
                    />
                    {unit && !money && <p className="text-[9px] text-gray-400 mt-0.5">{unit}</p>}
                    {money && <p className="text-[9px] text-gray-400 mt-0.5">FCFA</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Détails complets (dépliables) */}
          {showDetails && calculs && (
            <div className="border-t border-blue-100 p-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Matières */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Matières premières</p>
                  <div className="space-y-2">
                    {calcFields.filter(f => f.section === 'matieres').map(({ key, label, unit }) => (
                      <div key={key} className="flex items-center gap-2">
                        <label className="text-xs text-gray-600 w-28 flex-shrink-0">{label}</label>
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="number"
                            value={valeur(key)}
                            onChange={(e) => setOverride(key, e.target.value)}
                            className="amp-input py-1 text-xs text-right"
                          />
                          <span className="text-xs text-gray-400 w-8">{unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coûts détaillés */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Coûts détaillés</p>
                  <div className="space-y-2">
                    {calcFields.filter(f => f.section === 'couts').map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2">
                        <label className="text-xs text-gray-600 w-28 flex-shrink-0">{label}</label>
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="number"
                            value={valeur(key)}
                            onChange={(e) => setOverride(key, e.target.value)}
                            className="amp-input py-1 text-xs text-right"
                          />
                          <span className="text-xs text-gray-400 w-8">FCFA</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Récapitulatif */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Récapitulatif</p>
                  <div className="bg-white rounded-lg p-3 space-y-1.5 border border-gray-200">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Coût matières</span>
                      <span className="font-medium">{formatMontant(valeur('coutMateriaux'))}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Coût gasoil</span>
                      <span className="font-medium">{formatMontant(valeur('coutGasoil'))}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Amortissements</span>
                      <span className="font-medium">{formatMontant(valeur('coutAmortissement'))}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Personnel</span>
                      <span className="font-medium">{formatMontant(valeur('coutPersonnel'))}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-1.5 flex justify-between text-sm font-bold">
                      <span>Total production</span>
                      <span className="text-blue-700">{formatMontant(valeur('coutTotal'))}</span>
                    </div>
                    {montantCommande > 0 && (
                      <div className="flex justify-between text-sm font-bold">
                        <span>Marge</span>
                        <span className={(valeur('margePrevisionnelle') > 0) ? 'text-green-600' : 'text-red-500'}>
                          {formatMontant(valeur('margePrevisionnelle'))} ({valeur('tauxMarge')}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Message si pas encore de calcul */}
      {!calculs && !calculsLoading && (
        <p className="text-xs text-gray-400 text-center py-2">
          ↑ Sélectionnez un type de béton et un volume pour voir les calculs automatiques
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-60"
        >
          <Save size={16} />
          {isSubmitting ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer la commande'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-lg font-medium text-sm transition-colors"
        >
          <X size={16} /> Annuler
        </button>
      </div>
    </form>
  );
};

export default CommandeForm;
