import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, X, FlaskConical } from 'lucide-react';
import toast from 'react-hot-toast';
import { formulationsAPI } from '../../api';

const schema = z.object({
  nom: z.string().min(3, 'Nom requis'),
  typeBeton: z.enum(['C5', 'C15', 'C20', 'C25', 'C30', 'C35', 'C40'], { required_error: 'Type béton requis' }),
  description: z.string().optional(),
  ciment: z.coerce.number().positive('Requis'),
  sable: z.coerce.number().positive('Requis'),
  gravier515: z.coerce.number().positive('Requis'),
  gravier1525: z.coerce.number().positive('Requis'),
  eau: z.coerce.number().positive('Requis'),
  hydrofuge:    z.coerce.number().min(0).default(0),
  retardateur:  z.coerce.number().min(0).default(0),
  accelerateur: z.coerce.number().min(0).default(0),
  powerflow:    z.coerce.number().min(0).default(0),
  prixCiment: z.coerce.number().positive('Requis'),
  prixSable: z.coerce.number().positive('Requis'),
  prixGravier515: z.coerce.number().positive('Requis'),
  prixGravier1525: z.coerce.number().positive('Requis'),
  prixHydrofuge:    z.coerce.number().min(0).default(2750),
  prixPowerflow:    z.coerce.number().min(0).default(1750),
  prixRetardateur:  z.coerce.number().min(0).default(0),
  prixAccelerateur: z.coerce.number().min(0).default(0),
  densiteSable: z.coerce.number().positive().default(1.5),
  // Helper sable (non stocké)
  sablePoids:   z.coerce.number().min(0).optional(),
  motif: z.string().optional(),
});

const Field = ({ label, unit, name, register, error, ...props }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label} {unit && <span className="text-gray-400">({unit})</span>}</label>
    <input {...register(name)} className="amp-input text-sm" {...props} />
    {error && <p className="text-red-500 text-[10px] mt-0.5">{error.message}</p>}
  </div>
);

const FormulationForm = ({ formulation, onSuccess, onCancel }) => {
  const isEdit = !!formulation;

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: formulation ? {
      ...formulation,
      // Afficher en kg/m³ (valeur stockée en t/m³ × 1000)
      ciment:     +(formulation.ciment     * 1000).toFixed(1),
      gravier515: +(formulation.gravier515 * 1000).toFixed(1),
      gravier1525:+(formulation.gravier1525* 1000).toFixed(1),
      // Sable : stocké en m³/m³, affiché en m³/m³
      sable:      +(formulation.sable).toFixed(4),
      // sablePoids : déduit du stockage pour affichage helper
      sablePoids: +(formulation.sable * (formulation.densiteSable ?? 1.5) * 1000).toFixed(1),
      // Eau, powerflow, hydrofuge : L/m³ sans conversion
      eau:       formulation.eau,
      hydrofuge:    formulation.hydrofuge,
      retardateur:  formulation.retardateur  || 0,
      accelerateur: formulation.accelerateur || 0,
      powerflow:    formulation.powerflow,
      includePersonnel:    formulation.includePersonnel !== false,
      includeRestauration: formulation.includeRestauration !== false,
      fraisPeage:   formulation.fraisPeage   ?? 0,
      autresFrais:  formulation.autresFrais  ?? 0,
      autresFraisLabel: formulation.autresFraisLabel ?? '',
      densiteSable: formulation.densiteSable ?? 1.5,
      motif: '',
    } : {
      prixCiment: 105500, prixSable: 16000, prixGravier515: 11500, prixGravier1525: 11500,
      prixHydrofuge: 2750, prixPowerflow: 1750, prixRetardateur: 0, prixAccelerateur: 0,
      retardateur: 0, accelerateur: 0,
      includePersonnel: true, includeRestauration: true,
      fraisPeage: 0, autresFrais: 0, densiteSable: 1.5, sablePoids: '',
    },
  });

  // Calcul automatique du volume de sable depuis poids (kg/m³) + densité
  const sablePoids   = watch('sablePoids');
  const densiteSable = watch('densiteSable');
  useEffect(() => {
    if (sablePoids && densiteSable && densiteSable > 0) {
      // sable (m³/m³) = poids_kg / (densité × 1000)
      const sableM3 = sablePoids / (densiteSable * 1000);
      setValue('sable', +sableM3.toFixed(4), { shouldValidate: false });
    }
  }, [sablePoids, densiteSable, setValue]);

  const onSubmit = async (raw) => {
    const { sablePoids: _sp, motif, ...rest } = raw;
    const data = {
      ...rest,
      motif,
      // Convertir kg/m³ → t/m³ pour ciment et gravier
      ciment:     raw.ciment     / 1000,
      gravier515: raw.gravier515 / 1000,
      gravier1525:raw.gravier1525/ 1000,
      // Sable déjà en m³/m³ (calculé par le helper)
      sable:      raw.sable,
      // Eau, powerflow, hydrofuge en L/m³ — pas de conversion
      eau:       raw.eau,
      hydrofuge:    raw.hydrofuge,
      retardateur:  raw.retardateur,
      accelerateur: raw.accelerateur,
      powerflow:    raw.powerflow,
    };
    try {
      if (isEdit) {
        await formulationsAPI.modifier(formulation.id, data);
        toast.success(`Formulation mise à jour (v${formulation.version + 1})`);
      } else {
        await formulationsAPI.creer(data);
        toast.success('Formulation créée avec succès');
      }
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Identification */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical size={16} className="text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Identification</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom" name="nom" register={register} error={errors.nom} />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type béton</label>
            <select {...register('typeBeton')} className="amp-input text-sm">
              <option value="">— Choisir —</option>
              {['C5', 'C15', 'C20', 'C25', 'C30', 'C35', 'C40'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {errors.typeBeton && <p className="text-red-500 text-[10px] mt-0.5">{errors.typeBeton.message}</p>}
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea {...register('description')} rows={2} className="amp-input text-sm resize-none" />
          </div>
        </div>
      </div>

      {/* Dosages par m³ */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Dosages par m³ de béton</h3>
        <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mb-3">
          Saisissez les quantités <strong>par 1 m³ de béton</strong>. Le système calcule automatiquement pour n'importe quel volume commandé.
        </p>

        {/* Ciment & Graviers en kg/m³ */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          <Field label="Ciment" unit="kg/m³" name="ciment" register={register} error={errors.ciment} type="number" step="1" />
          <Field label="Gravier 5/15" unit="kg/m³" name="gravier515" register={register} error={errors.gravier515} type="number" step="1" />
          <Field label="Gravier 15/25" unit="kg/m³" name="gravier1525" register={register} error={errors.gravier1525} type="number" step="1" />
        </div>

        {/* Sable : poids → volume auto */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
          <p className="text-xs font-semibold text-amber-700 mb-2">Sable — calculer le volume depuis le poids</p>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Poids sable" unit="kg/m³" name="sablePoids" register={register} type="number" step="1" />
            <Field label="Densité sable" unit="t/m³" name="densiteSable" register={register} type="number" step="0.01" />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Volume sable <span className="text-gray-400">(m³/m³ — auto)</span></label>
              <input {...register('sable')} type="number" step="0.0001" className="amp-input text-sm font-medium text-blue-700" />
            </div>
          </div>
        </div>

        {/* Liquides en L/m³ */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Eau" unit="L/m³" name="eau" register={register} error={errors.eau} type="number" step="1" />
          <Field label="Hydrofuge" unit="L/m³" name="hydrofuge" register={register} error={errors.hydrofuge} type="number" step="0.1" />
          <Field label="Powerflow 6425" unit="L/m³" name="powerflow" register={register} error={errors.powerflow} type="number" step="0.1" />
          <Field label="Retardateur de prise" unit="L/m³" name="retardateur" register={register} type="number" step="0.1" />
          <Field label="Accélérateur de prise" unit="L/m³" name="accelerateur" register={register} type="number" step="0.1" />
        </div>
      </div>

      {/* Prix unitaires */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Prix unitaires (FCFA HTVA)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Prix ciment" unit="FCFA/t" name="prixCiment" register={register} error={errors.prixCiment} type="number" />
          <Field label="Prix sable" unit="FCFA/m³" name="prixSable" register={register} error={errors.prixSable} type="number" />
          <Field label="Prix gravier 5/15" unit="FCFA/t" name="prixGravier515" register={register} error={errors.prixGravier515} type="number" />
          <Field label="Prix gravier 15/25" unit="FCFA/t" name="prixGravier1525" register={register} error={errors.prixGravier1525} type="number" />
          <Field label="Prix hydrofuge" unit="FCFA/L" name="prixHydrofuge" register={register} error={errors.prixHydrofuge} type="number" />
          <Field label="Prix Powerflow" unit="FCFA/L" name="prixPowerflow" register={register} error={errors.prixPowerflow} type="number" />
          <Field label="Prix retardateur" unit="FCFA/L" name="prixRetardateur" register={register} type="number" />
          <Field label="Prix accélérateur" unit="FCFA/L" name="prixAccelerateur" register={register} type="number" />
        </div>
      </div>

      {isEdit && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Motif de modification *</label>
          <input {...register('motif')} className="amp-input text-sm" />
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-60">
          <Save size={16} />
          {isSubmitting ? 'Enregistrement...' : isEdit ? `Mettre à jour (v${(formulation?.version || 0) + 1})` : 'Créer la formulation'}
        </button>
        <button type="button" onClick={onCancel} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-lg font-medium text-sm transition-colors">
          <X size={16} /> Annuler
        </button>
      </div>
    </form>
  );
};

export default FormulationForm;
