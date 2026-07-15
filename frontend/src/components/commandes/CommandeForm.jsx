import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Calculator, Save, X, Edit3, RefreshCw, ChevronDown, ChevronUp, MapPin, Tag, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { formulationsAPI, commandesAPI } from '../../api';
import { formatMontant } from '../../utils/formatters';

// ─── Bordereau de prix AMP BETON ─────────────────────────────────────────────
const TARIF_BORDEREAU = {
  ZONE1: { C5: 66000, C15: 76000, C20: 91000, C25: 98000, C30: 108000, C35: 119000, C40: 126000 },
  ZONE2: { C5: 75000, C15: 86500, C20: 101000, C25: 106000, C30: 117000, C35: 128000, C40: 134000 },
  ZONE3: { C5: 78000, C15: 91000, C20: 107000, C25: 114000, C30: 124000, C35: 135000, C40: 141000 },
};
const ZONES = [
  { id: 'ZONE1', label: 'Zone 1', desc: '1 – 50 km' },
  { id: 'ZONE2', label: 'Zone 2', desc: '50 – 100 km' },
  { id: 'ZONE3', label: 'Zone 3', desc: '100 – 150 km' },
];
const getZoneAuto = (km) => {
  const d = parseFloat(km) || 0;
  if (d > 0 && d <= 50) return 'ZONE1';
  if (d > 50 && d <= 100) return 'ZONE2';
  if (d > 100 && d <= 150) return 'ZONE3';
  return null;
};
// Distance représentative utilisée quand l'utilisateur choisit une zone
// manuellement sans saisir de km — évite que gasoil/heures toupie-pompe
// restent à 0 faute de distance réelle.
const ZONE_KM_REPRESENTATIF = { ZONE1: 25, ZONE2: 75, ZONE3: 125 };

const schema = z.object({
  nomClient: z.string().min(2, 'Nom requis (min 2 caractères)'),
  telephone: z.string().min(8, 'Numéro invalide'),
  adresseChantier: z.string().min(5, 'Adresse requise'),
  ifu: z.string().optional(),
  rccm: z.string().optional(),
  regimeImposition: z.string().optional(),
  volumeBeton: z.coerce.number().positive('Volume doit être positif'),
  typeBeton: z.string().min(1, 'Type béton requis'),
  dateLivraison: z.string().optional(),
  distanceLivraison: z.coerce.number().min(0).optional(),
  montantCommande: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive('Montant doit être positif').optional()
  ),
  remisePct: z.coerce.number().min(0).max(100).default(0),
  includePersonnel:    z.boolean().default(true),
  includeRestauration: z.boolean().default(true),
  fraisPeage:   z.coerce.number().min(0).default(0),
  autresFrais:  z.coerce.number().min(0).default(0),
  autresFraisLabel: z.string().optional(),
  useRetardateur:  z.boolean().default(false),
  useAccelerateur: z.boolean().default(false),
  useHydrofuge:    z.boolean().default(false),
  observations: z.string().optional(),
});

const CommandeForm = ({ commande, onSuccess, onCancel }) => {
  const isEdit = !!commande;
  const [calculs, setCalculs] = useState(null);
  const [calculsLoading, setCalculsLoading] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [showDetails, setShowDetails] = useState(false);
  const [formulationId, setFormulationId] = useState(commande?.formulationId || '');
  const [zoneManuelle, setZoneManuelle] = useState(null); // null = auto-détectée depuis distance
  const [customPrixM3, setCustomPrixM3] = useState(null); // null = utiliser le bordereau
  const [lignesExtras, setLignesExtras] = useState([]); // lignes supplémentaires de béton

  const addLigneExtra = () => setLignesExtras(prev => [...prev, { id: Date.now(), typeBeton: '', formulationId: '', volumeBeton: '' }]);
  const removeLigneExtra = (idx) => setLignesExtras(prev => prev.filter((_, i) => i !== idx));
  const updateLigneExtra = (idx, field, val) => setLignesExtras(prev => prev.map((lg, i) => i === idx ? { ...lg, [field]: val } : lg));
  const updateLigneExtraType = (idx, typeBeton) => {
    const matches = formulationsData?.filter(f => f.typeBeton === typeBeton) || [];
    const formulationId = matches.length === 1 ? matches[0].id : '';
    setLignesExtras(prev => prev.map((lg, i) => i === idx ? { ...lg, typeBeton, formulationId } : lg));
  };
  const updateLigneExtraFormulation = (idx, formulationId) => {
    setLignesExtras(prev => prev.map((lg, i) => i === idx ? { ...lg, formulationId } : lg));
  };

  const { data: formulationsData } = useQuery({
    queryKey: ['formulations'],
    queryFn: () => formulationsAPI.lister(),
    select: (res) => res.data.data,
  });

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: commande ? {
      nomClient: commande.nomClient,
      telephone: commande.telephone,
      adresseChantier: commande.adresseChantier,
      ifu: commande.ifu || '',
      rccm: commande.rccm || '',
      regimeImposition: commande.regimeImposition || '',
      volumeBeton: commande.volumeBeton,
      typeBeton: commande.typeBeton,
      dateLivraison: commande.dateLivraison?.split('T')[0],
      distanceLivraison: commande.distanceLivraison || '',
      montantCommande: commande.montantCommande || '',
      remisePct: commande.remisePct || 0,
      includePersonnel:    commande.includePersonnel !== false,
      includeRestauration: commande.includeRestauration !== false,
      fraisPeage:   commande.fraisPeage   ?? 0,
      autresFrais:  commande.autresFrais  ?? 0,
      autresFraisLabel: commande.autresFraisLabel ?? '',
      useRetardateur:  commande.useRetardateur  ?? false,
      useAccelerateur: commande.useAccelerateur ?? false,
      useHydrofuge:    commande.useHydrofuge    ?? false,
      observations: commande.observations || '',
    } : {
      includePersonnel: false,
      includeRestauration: false,
      fraisPeage: 0,
      autresFrais: 0,
      useRetardateur: false,
      useAccelerateur: false,
      useHydrofuge: false,
    },
  });

  const [volume, typeBeton, montantCommande, distanceLivraison, includePersonnel, includeRestauration, fraisPeage, autresFrais, useRetardateur, useAccelerateur, useHydrofuge] = watch(['volumeBeton', 'typeBeton', 'montantCommande', 'distanceLivraison', 'includePersonnel', 'includeRestauration', 'fraisPeage', 'autresFrais', 'useRetardateur', 'useAccelerateur', 'useHydrofuge']);

  // Types de béton uniques (menu principal) — une seule entrée même si plusieurs formulations partagent le type
  const typesBetonUniques = React.useMemo(() => {
    if (!formulationsData) return [];
    const vus = new Set();
    return formulationsData.filter((f) => {
      if (vus.has(f.typeBeton)) return false;
      vus.add(f.typeBeton);
      return true;
    });
  }, [formulationsData]);

  // Formulations disponibles pour le type béton sélectionné
  const formulationsMatches = React.useMemo(
    () => (typeBeton && formulationsData ? formulationsData.filter((f) => f.typeBeton === typeBeton) : []),
    [typeBeton, formulationsData]
  );

  const appliquerFormulation = (found) => {
    if (!found) return;
    setFormulationId(found.id);
    setOverrides({});
    setValue('useRetardateur',  (found.retardateur  || 0) > 0, { shouldValidate: false });
    setValue('useAccelerateur', (found.accelerateur || 0) > 0, { shouldValidate: false });
    setValue('useHydrofuge',    (found.hydrofuge    || 0) > 0, { shouldValidate: false });
  };

  // Auto-sélection de la formulation quand le type béton change —
  // seulement si une seule formulation existe pour ce type. S'il y en a
  // plusieurs, l'utilisateur doit choisir explicitement via le sélecteur.
  useEffect(() => {
    if (!typeBeton || !formulationsData) return;
    if (formulationsMatches.length === 1) {
      appliquerFormulation(formulationsMatches[0]);
    } else if (formulationsMatches.length > 1) {
      if (!formulationsMatches.find((f) => f.id === formulationId)) {
        setFormulationId('');
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
          distanceLivraison: distanceLivraison || 0,
          options: { includePersonnel, includeRestauration, fraisPeage: fraisPeage || 0, autresFrais: autresFrais || 0 },
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
  }, [volume, formulationId, montantCommande, distanceLivraison, includePersonnel, includeRestauration, fraisPeage, autresFrais]);

  // ─── Calcul zone + tarif bordereau ──────────────────────────────────────
  const zoneAuto = getZoneAuto(distanceLivraison);
  const zone = zoneManuelle || zoneAuto;
  const prixUnitaireBordereau = zone && typeBeton ? (TARIF_BORDEREAU[zone]?.[typeBeton] ?? null) : null;
  const montantBetonBase = prixUnitaireBordereau && volume ? Math.round(prixUnitaireBordereau * parseFloat(volume)) : null;
  const montantSuggere = montantBetonBase !== null ? montantBetonBase : null;

  // Quand la distance change → réinitialiser la zone manuelle
  useEffect(() => {
    setZoneManuelle(null);
  }, [distanceLivraison]);

  // Quand type béton ou zone change → réinitialiser le prix manuel
  useEffect(() => {
    setCustomPrixM3(null);
  }, [typeBeton, zone]);

  // Prix effectif : manuel si saisi, sinon bordereau
  const prixEffectifM3 = customPrixM3 ?? prixUnitaireBordereau;
  const montantEffectif = prixEffectifM3 && volume
    ? Math.round(prixEffectifM3 * parseFloat(volume))
    : montantSuggere;

  // Synchroniser montantCommande — seulement si l'utilisateur n'a pas saisi manuellement
  useEffect(() => {
    if (customPrixM3 === null) {
      setValue('montantCommande', montantSuggere ?? undefined, { shouldValidate: false });
    }
  }, [montantSuggere, customPrixM3, setValue]);

  const valeur = (key) => overrides[key] !== undefined ? overrides[key] : (calculs?.[key] ?? '');
  const setOverride = (key, val) => setOverrides((prev) => ({ ...prev, [key]: val === '' ? undefined : Number(val) }));
  const resetOverrides = () => setOverrides({});

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        formulationId: formulationId || undefined,
        ...(Object.keys(overrides).length > 0 ? { _calculsOverrides: { ...calculs, ...overrides } } : {}),
      };

      if (lignesExtras.length > 0) {
        const prixM3Principal = customPrixM3 ?? prixUnitaireBordereau;
        const montantPrincipal = parseFloat(data.montantCommande) || 0;
        const lignes = [
          { typeBeton: data.typeBeton, volumeBeton: parseFloat(data.volumeBeton) || 0, prixM3: prixM3Principal, montant: montantPrincipal, formulationId: formulationId || undefined },
          ...lignesExtras.map(lg => {
            const pm3 = zone && lg.typeBeton ? (TARIF_BORDEREAU[zone]?.[lg.typeBeton] ?? null) : null;
            const mt = pm3 && lg.volumeBeton ? Math.round(pm3 * parseFloat(lg.volumeBeton)) : 0;
            return { typeBeton: lg.typeBeton, volumeBeton: parseFloat(lg.volumeBeton) || 0, prixM3: pm3, montant: mt, formulationId: lg.formulationId || undefined };
          }),
        ];
        payload.lignes = lignes;
        payload.montantCommande = lignes.reduce((s, l) => s + l.montant, 0);
        payload.volumeBeton = lignes.reduce((s, l) => s + l.volumeBeton, 0);
        payload.typeBeton = lignes[0].typeBeton;
      }

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
    { key: 'totalCiment', label: 'Ciment total', unit: 't', section: 'matieres' },
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
            <input {...register('nomClient')} className="amp-input" />
            {errors.nomClient && <p className="text-red-500 text-xs mt-1">{errors.nomClient.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
            <input {...register('telephone')} className="amp-input" />
            {errors.telephone && <p className="text-red-500 text-xs mt-1">{errors.telephone.message}</p>}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse du chantier *</label>
            <input {...register('adresseChantier')} className="amp-input" />
            {errors.adresseChantier && <p className="text-red-500 text-xs mt-1">{errors.adresseChantier.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IFU <span className="text-gray-400 font-normal">(optionnel)</span></label>
            <input {...register('ifu')} className="amp-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RCCM <span className="text-gray-400 font-normal">(optionnel)</span></label>
            <input {...register('rccm')} className="amp-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Régime d'imposition <span className="text-gray-400 font-normal">(optionnel)</span></label>
            <input {...register('regimeImposition')} className="amp-input" />
          </div>
        </div>
      </div>

      {/* Détails commande */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Détails de la commande</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Volume (m³) *</label>
            <input {...register('volumeBeton')} type="number" step="0.5" min="1" className="amp-input" />
            {errors.volumeBeton && <p className="text-red-500 text-xs mt-1">{errors.volumeBeton.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de béton *</label>
            <select {...register('typeBeton')} className="amp-input">
              <option value="">Sélectionner...</option>
              {typesBetonUniques.map((f) => (
                <option key={f.typeBeton} value={f.typeBeton}>{f.typeBeton}</option>
              ))}
            </select>
            {errors.typeBeton && <p className="text-red-500 text-xs mt-1">{errors.typeBeton.message}</p>}
          </div>
          {formulationsMatches.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Formulation *</label>
              <select
                value={formulationId}
                onChange={(e) => appliquerFormulation(formulationsMatches.find((f) => f.id === e.target.value))}
                className="amp-input"
              >
                <option value="">Sélectionner...</option>
                {formulationsMatches.map((f) => (
                  <option key={f.id} value={f.id}>{f.nom}</option>
                ))}
              </select>
              {!formulationId && <p className="text-red-500 text-xs mt-1">Choisis la formulation à utiliser</p>}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de livraison</label>
            <input {...register('dateLivraison')} type="date" min={new Date().toISOString().split('T')[0]} className="amp-input" />
            {errors.dateLivraison && <p className="text-red-500 text-xs mt-1">{errors.dateLivraison.message}</p>}
          </div>
          {/* Distance + Zone */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <MapPin size={13} className="text-blue-500" /> Distance de livraison (km)
            </label>
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-[120px]">
                <input {...register('distanceLivraison')} type="number" step="1" min="0" className="amp-input" />
                {errors.distanceLivraison && <p className="text-red-500 text-xs mt-1">{errors.distanceLivraison.message}</p>}
              </div>
              {/* Sélecteur de zone */}
              <div className="flex flex-col gap-1">
                <p className="text-xs text-gray-500">Zone tarifaire</p>
                <div className="flex gap-1">
                  {ZONES.map((z) => {
                    const isActive = zone === z.id;
                    const isAuto = zoneAuto === z.id && !zoneManuelle;
                    return (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => {
                          const isDeselecting = zoneManuelle === z.id;
                          setZoneManuelle(isDeselecting ? null : z.id);
                          if (!isDeselecting && !distanceLivraison) {
                            setValue('distanceLivraison', ZONE_KM_REPRESENTATIF[z.id], { shouldValidate: false });
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          isActive
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                        }`}
                        title={z.desc}
                      >
                        {z.label}
                        {isAuto && <span className="ml-1 opacity-70">↑</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-gray-400">
                  {zone ? `${ZONES.find(z => z.id === zone)?.desc}${!zoneManuelle ? ' (auto)' : ' (manuel)'}` : 'Entrez une distance'}
                </p>
              </div>
            </div>
          </div>

          {/* Prix bordereau — modifiable */}
          {prixUnitaireBordereau && (
            <div className="md:col-span-3">
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3"
              >
                <Tag size={14} className="text-blue-600 flex-shrink-0" />
                <div className="flex flex-wrap gap-4 flex-1 items-end">
                  <div>
                    <p className="text-[10px] text-blue-500 uppercase font-semibold">Zone tarifaire</p>
                    <p className="text-sm font-bold text-blue-800">{ZONES.find(z => z.id === zone)?.label} — {ZONES.find(z => z.id === zone)?.desc}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-blue-500 uppercase font-semibold">
                      Prix / m³ {typeBeton}
                      {customPrixM3 !== null && (
                        <button type="button" onClick={() => { setCustomPrixM3(null); setValue('montantCommande', montantSuggere ?? undefined, { shouldValidate: false }); }} className="ml-2 text-blue-400 hover:text-blue-600 underline font-normal">
                          reset
                        </button>
                      )}
                    </p>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={customPrixM3 ?? prixUnitaireBordereau}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || null;
                        setCustomPrixM3(val);
                        if (val && volume) {
                          setValue('montantCommande', Math.round(val * parseFloat(volume)), { shouldValidate: false });
                        }
                      }}
                      className={`w-36 amp-input text-sm font-bold ${customPrixM3 !== null ? 'border-orange-400 bg-orange-50 text-orange-800' : 'text-blue-800'}`}
                    />
                  </div>
                  {volume > 0 && (
                    <div>
                      <p className="text-[10px] text-blue-500 uppercase font-semibold">Montant de vente ({volume} m³)</p>
                      <p className="text-sm font-bold text-green-700">{formatMontant(montantEffectif)}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}

          {/* Lignes supplémentaires de béton */}
          <div className="md:col-span-3 space-y-2">
            {lignesExtras.map((lg, idx) => {
              const pm3 = zone && lg.typeBeton ? (TARIF_BORDEREAU[zone]?.[lg.typeBeton] ?? null) : null;
              const mt = pm3 && lg.volumeBeton ? Math.round(pm3 * parseFloat(lg.volumeBeton)) : null;
              const lgMatches = lg.typeBeton && formulationsData ? formulationsData.filter(f => f.typeBeton === lg.typeBeton) : [];
              return (
                <div key={lg.id} className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl p-3 flex-wrap">
                  <select
                    value={lg.typeBeton}
                    onChange={(e) => updateLigneExtraType(idx, e.target.value)}
                    className="amp-input flex-1 min-w-[140px]"
                  >
                    <option value="">Type béton...</option>
                    {typesBetonUniques.map((f) => (
                      <option key={f.typeBeton} value={f.typeBeton}>{f.typeBeton}</option>
                    ))}
                  </select>
                  {lgMatches.length > 1 && (
                    <select
                      value={lg.formulationId}
                      onChange={(e) => updateLigneExtraFormulation(idx, e.target.value)}
                      className="amp-input flex-1 min-w-[160px] border-orange-400"
                    >
                      <option value="">Formulation...</option>
                      {lgMatches.map((f) => (
                        <option key={f.id} value={f.id}>{f.nom}</option>
                      ))}
                    </select>
                  )}
                  <div className="flex items-center gap-1">
                    <input
                      type="number" step="0.5" min="1" placeholder="Volume m³"
                      value={lg.volumeBeton}
                      onChange={(e) => updateLigneExtra(idx, 'volumeBeton', e.target.value)}
                      className="amp-input w-28 text-sm"
                    />
                    <span className="text-xs text-gray-400">m³</span>
                  </div>
                  {pm3 && <span className="text-xs text-blue-700 font-medium">{pm3.toLocaleString('fr-FR')} FCFA/m³</span>}
                  {mt && <span className="text-xs text-green-700 font-bold">{mt.toLocaleString('fr-FR')} FCFA</span>}
                  <button type="button" onClick={() => removeLigneExtra(idx)} className="text-red-400 hover:text-red-600 ml-auto">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addLigneExtra}
              className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-medium border border-dashed border-blue-300 rounded-xl px-4 py-2 hover:bg-blue-50 transition-colors w-full justify-center"
            >
              <Plus size={14} /> Ajouter un type de béton
            </button>
            {lignesExtras.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 flex justify-between text-sm font-bold text-green-800">
                <span>Total commande</span>
                <span>
                  {(parseFloat(watch('volumeBeton')) || 0) + lignesExtras.reduce((s, l) => s + (parseFloat(l.volumeBeton) || 0), 0)} m³
                  {' — '}
                  {((parseFloat(watch('montantCommande')) || 0) + lignesExtras.reduce((s, l) => {
                    const pm3 = zone && l.typeBeton ? (TARIF_BORDEREAU[zone]?.[l.typeBeton] ?? 0) : 0;
                    return s + (pm3 && l.volumeBeton ? Math.round(pm3 * parseFloat(l.volumeBeton)) : 0);
                  }, 0)).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            )}
          </div>

          {/* Additifs (coûts de production internes) */}
          {formulationId && (
            <div className="md:col-span-3">
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-orange-700 uppercase mb-2">Additifs (coûts de production — n'affectent pas le prix de vente)</p>
                <div className="flex flex-wrap gap-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...register('useRetardateur')} className="w-4 h-4 rounded accent-orange-600" />
                    <span className="text-sm text-gray-700">Retardateur de prise</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...register('useAccelerateur')} className="w-4 h-4 rounded accent-orange-600" />
                    <span className="text-sm text-gray-700">Accélérateur de prise</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Remise */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remise <span className="text-gray-400 font-normal">(%)</span>
            </label>
            <input
              {...register('remisePct')}
              type="number" min="0" max="100" step="0.5"
              className="amp-input"
            />
            {watch && (() => {
              const mt = parseFloat(watch('montantCommande')) || 0;
              const rp = parseFloat(watch('remisePct')) || 0;
              if (mt > 0 && rp > 0) {
                const deduit = Math.round(mt * rp / 100);
                const net    = mt - deduit;
                return <p className="text-xs text-green-600 mt-1">Déduction : {deduit.toLocaleString('fr-FR')} FCFA → Montant net : <strong>{net.toLocaleString('fr-FR')} FCFA</strong></p>;
              }
              return null;
            })()}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
            <textarea {...register('observations')} rows={2} className="amp-input resize-none" />
          </div>
        </div>
      </div>

      {/* Options de coûts */}
      {formulationId && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Options de coûts</h3>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('includePersonnel')} className="w-4 h-4 rounded accent-blue-600" />
                <span className="text-sm text-gray-700">Frais de <strong>personnel</strong> (245 FCFA/m³)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('includeRestauration')} className="w-4 h-4 rounded accent-blue-600" />
                <span className="text-sm text-gray-700">Frais de <strong>restauration</strong> (12 plats × 1 500 FCFA)</span>
              </label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Frais de péage <span className="text-gray-400">(FCFA/voyage)</span></label>
                <input {...register('fraisPeage')} type="number" step="500" min="0" className="amp-input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Autres frais <span className="text-gray-400">(FCFA fixe)</span></label>
                <input {...register('autresFrais')} type="number" step="500" min="0" className="amp-input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Libellé autres frais</label>
                <input {...register('autresFraisLabel')} className="amp-input text-sm" />
              </div>
            </div>
          </div>
        </div>
      )}

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
                { key: 'margePrevisionnelle', label: 'Marge commerciale', pct: calculs?.tauxMarge, green: (overrides.margePrevisionnelle ?? calculs.margePrevisionnelle) > 0, money: true },
                { key: 'beneficeReel', label: 'Bénéfice réel net', pct: calculs?.tauxBeneficeReel, green: (overrides.beneficeReel ?? calculs.beneficeReel) > 0, money: true, gold: (overrides.beneficeReel ?? calculs.beneficeReel) <= 0 },
              ].map(({ key, label, highlight, green, gold, money, unit, pct }) => {
                const v = valeur(key);
                return (
                  <div key={key} className={`rounded-lg p-2.5 border ${highlight ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                    <input
                      type="number"
                      value={v}
                      onChange={(e) => setOverride(key, e.target.value)}
                      className={`w-full bg-transparent text-sm font-bold border-b border-dashed border-transparent hover:border-blue-300 focus:border-blue-400 focus:outline-none ${green ? 'text-green-600' : gold ? 'text-amber-600' : highlight ? 'text-blue-700' : 'text-gray-800'}`}
                    />
                    <p className="text-[9px] mt-0.5 flex items-center gap-1">
                      <span className="text-gray-400">FCFA</span>
                      {pct != null && <span className={`font-semibold ${green ? 'text-green-500' : gold ? 'text-amber-500' : 'text-gray-500'}`}>— {Number(pct).toFixed(1)}%</span>}
                    </p>
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
                      <span className="text-gray-500">Coût gasoil production</span>
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
                    {valeur('fraisTransport') > 0 && (
                      <div className="flex justify-between text-xs text-amber-700">
                        <span>Transport livraison ({distanceLivraison} km)</span>
                        <span className="font-medium">{formatMontant(valeur('fraisTransport'))}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-1.5 flex justify-between text-sm font-bold">
                      <span>Total production</span>
                      <span className="text-blue-700">{formatMontant(valeur('coutTotal'))}</span>
                    </div>
                    {montantCommande > 0 && (
                      <>
                        <div className="flex justify-between text-sm font-bold">
                          <span>Marge commerciale</span>
                          <span className={(valeur('margePrevisionnelle') > 0) ? 'text-green-600' : 'text-red-500'}>
                            {formatMontant(valeur('margePrevisionnelle'))} ({valeur('tauxMarge')}%)
                          </span>
                        </div>
                        <div className="border-t border-dashed border-gray-200 pt-1.5">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Charges d'exploitation</p>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Loyer central + frais généraux</span>
                            <span>{formatMontant((valeur('fraisLoyer') || 0) + (valeur('fraisAutresCharges') || 0))}</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Impôts & taxes (5% CA)</span>
                            <span>{formatMontant(valeur('fraisImpots'))}</span>
                          </div>
                        </div>
                        <div className="border-t border-gray-200 pt-1.5 flex justify-between text-sm font-bold">
                          <span>Bénéfice réel net</span>
                          <span className={(valeur('beneficeReel') > 0) ? 'text-green-600' : 'text-red-500'}>
                            {formatMontant(valeur('beneficeReel'))} ({valeur('tauxBeneficeReel')}%)
                          </span>
                        </div>
                      </>
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
