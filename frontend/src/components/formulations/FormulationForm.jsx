import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, X, FlaskConical } from 'lucide-react';
import toast from 'react-hot-toast';
import { formulationsAPI } from '../../api';

const schema = z.object({
  nom: z.string().min(3, 'Nom requis'),
  typeBeton: z.string().min(2, 'Type béton requis (ex: C25/30)'),
  description: z.string().optional(),
  ciment: z.coerce.number().positive('Requis'),
  sable: z.coerce.number().positive('Requis'),
  gravier515: z.coerce.number().positive('Requis'),
  gravier1525: z.coerce.number().positive('Requis'),
  eau: z.coerce.number().positive('Requis'),
  hydrofuge: z.coerce.number().min(0).default(0),
  powerflow: z.coerce.number().min(0).default(0),
  prixCiment: z.coerce.number().positive('Requis'),
  prixSable: z.coerce.number().positive('Requis'),
  prixGravier515: z.coerce.number().positive('Requis'),
  prixGravier1525: z.coerce.number().positive('Requis'),
  prixHydrofuge: z.coerce.number().min(0).default(2750),
  prixPowerflow: z.coerce.number().min(0).default(1750),
  // Options
  includePersonnel:    z.boolean().default(true),
  includeRestauration: z.boolean().default(true),
  fraisPeage:   z.coerce.number().min(0).default(0),
  autresFrais:  z.coerce.number().min(0).default(0),
  autresFraisLabel: z.string().optional(),
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
  const REF = 200; // volume de référence en m³

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: formulation ? {
      ...formulation,
      ciment:    +(formulation.ciment    * REF).toFixed(4),
      sable:     +(formulation.sable     * REF).toFixed(4),
      gravier515:+(formulation.gravier515* REF).toFixed(4),
      gravier1525:+(formulation.gravier1525*REF).toFixed(4),
      eau:       +(formulation.eau       * REF).toFixed(2),
      hydrofuge: +(formulation.hydrofuge * REF).toFixed(2),
      powerflow: +(formulation.powerflow * REF).toFixed(2),
      includePersonnel:    formulation.includePersonnel !== false,
      includeRestauration: formulation.includeRestauration !== false,
      fraisPeage:   formulation.fraisPeage   ?? 0,
      autresFrais:  formulation.autresFrais  ?? 0,
      autresFraisLabel: formulation.autresFraisLabel ?? '',
      densiteSable: formulation.densiteSable ?? 1.5,
      sablePoids: '',
      motif: '',
    } : {
      prixCiment: 105500, prixSable: 16000, prixGravier515: 11500, prixGravier1525: 11500,
      prixHydrofuge: 2750, prixPowerflow: 1750,
      includePersonnel: true, includeRestauration: true,
      fraisPeage: 0, autresFrais: 0, densiteSable: 1.5, sablePoids: '',
    },
  });

  // Calcul automatique du volume de sable depuis poids + densité
  const sablePoids  = watch('sablePoids');
  const densiteSable = watch('densiteSable');
  useEffect(() => {
    if (sablePoids && densiteSable && densiteSable > 0) {
      const sableM3Pour200 = (sablePoids * REF) / (1000 * densiteSable);
      setValue('sable', +sableM3Pour200.toFixed(2), { shouldValidate: false });
    }
  }, [sablePoids, densiteSable, setValue]);

  const onSubmit = async (raw) => {
    const { sablePoids: _sp, motif, ...rest } = raw;
    const data = {
      ...rest,
      motif,
      ciment:    raw.ciment    / REF,
      sable:     raw.sable     / REF,
      gravier515:raw.gravier515/ REF,
      gravier1525:raw.gravier1525/REF,
      eau:       raw.eau       / REF,
      hydrofuge: raw.hydrofuge / REF,
      powerflow: raw.powerflow / REF,
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
          <Field label="Nom" name="nom" register={register} error={errors.nom} placeholder="Ex: Béton C25/30 Standard" />
          <Field label="Type béton" name="typeBeton" register={register} error={errors.typeBeton} placeholder="Ex: C25/30" />
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea {...register('description')} rows={2} className="amp-input text-sm resize-none" placeholder="Description optionnelle..." />
          </div>
        </div>
      </div>

      {/* Quantités pour 200 m³ */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Quantités pour 200 m³ de béton</h3>
        <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mb-3">
          Saisissez les quantités nécessaires pour <strong>200 m³</strong>. Le système divise par 200 automatiquement.
        </p>

        {/* Helper sable : poids → volume */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
          <p className="text-xs font-semibold text-amber-700 mb-2">Calculer le sable depuis le poids (optionnel)</p>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Poids sable (kg/m³)" name="sablePoids" register={register} type="number" step="1" placeholder="ex: 702" />
            <Field label="Densité sable (t/m³)" name="densiteSable" register={register} type="number" step="0.01" placeholder="1.5" />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Volume calculé (m³ pour 200 m³)</label>
              <input {...register('sable')} type="number" step="0.01" className="amp-input text-sm bg-white font-medium text-blue-700" placeholder="auto-calculé" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Ciment" unit="t" name="ciment" register={register} error={errors.ciment} type="number" step="0.1" placeholder="ex: 95" />
          <Field label="Gravier 5/15" unit="t" name="gravier515" register={register} error={errors.gravier515} type="number" step="0.1" placeholder="ex: 88" />
          <Field label="Gravier 15/25" unit="t" name="gravier1525" register={register} error={errors.gravier1525} type="number" step="0.1" placeholder="ex: 155" />
          <Field label="Eau" unit="L" name="eau" register={register} error={errors.eau} type="number" step="1" placeholder="ex: 35000" />
          <Field label="Hydrofuge" unit="L" name="hydrofuge" register={register} error={errors.hydrofuge} type="number" step="1" placeholder="ex: 0" />
          <Field label="Powerflow 6425" unit="L" name="powerflow" register={register} error={errors.powerflow} type="number" step="1" placeholder="ex: 800" />
        </div>
      </div>

      {/* Options coûts */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Options de coûts</h3>
        <div className="space-y-2 mb-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" {...register('includePersonnel')} className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-sm text-gray-700">Inclure <strong>frais de personnel</strong> (245 FCFA/m³)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" {...register('includeRestauration')} className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-sm text-gray-700">Inclure <strong>frais de restauration</strong> (12 plats × 1 500 FCFA)</span>
          </label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Frais de péage" unit="FCFA/voyage" name="fraisPeage" register={register} type="number" step="500" placeholder="ex: 15000" />
          <Field label="Autres frais" unit="FCFA fixe" name="autresFrais" register={register} type="number" step="500" placeholder="ex: 50000" />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Libellé autres frais</label>
            <input {...register('autresFraisLabel')} className="amp-input text-sm" placeholder="ex: Gardiennage, Sécurité..." />
          </div>
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
        </div>
      </div>

      {isEdit && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Motif de modification *</label>
          <input {...register('motif')} className="amp-input text-sm" placeholder="Ex: Mise à jour prix ciment juillet 2026" />
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
