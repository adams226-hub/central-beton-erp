import React from 'react';
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
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: formulation ? {
      ...formulation,
      motif: '',
    } : {
      prixCiment: 105500, prixSable: 16000, prixGravier515: 11500, prixGravier1525: 11500,
      prixHydrofuge: 2750, prixPowerflow: 1750,
    },
  });

  const onSubmit = async (data) => {
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

      {/* Dosages / m³ */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Dosages par m³</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Ciment" unit="kg/m³" name="ciment" register={register} error={errors.ciment} type="number" step="0.1" />
          <Field label="Sable" unit="m³/m³" name="sable" register={register} error={errors.sable} type="number" step="0.01" />
          <Field label="Gravier 5/15" unit="t/m³" name="gravier515" register={register} error={errors.gravier515} type="number" step="0.001" />
          <Field label="Gravier 15/25" unit="t/m³" name="gravier1525" register={register} error={errors.gravier1525} type="number" step="0.001" />
          <Field label="Eau" unit="L/m³" name="eau" register={register} error={errors.eau} type="number" />
          <Field label="Hydrofuge" unit="L/m³" name="hydrofuge" register={register} error={errors.hydrofuge} type="number" step="0.1" />
          <Field label="Powerflow 6425" unit="L/m³" name="powerflow" register={register} error={errors.powerflow} type="number" step="0.1" />
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
