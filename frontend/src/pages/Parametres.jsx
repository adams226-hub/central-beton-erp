import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Settings, Save, Info, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { parametresAPI } from '../api';
import { PageLoader } from '../components/common/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const SectionTitle = ({ icon: Icon, title, color = 'text-orange-600', bg = 'bg-orange-50' }) => (
  <div className={cn('flex items-center gap-3 px-4 py-3 rounded-xl mb-4', bg)}>
    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center bg-white/70', color)}>
      <Icon size={16} />
    </div>
    <h3 className={cn('font-semibold text-sm', color)}>{title}</h3>
  </div>
);

const FieldRow = ({ label, unit, name, register, readOnly, step = '1', min = '0' }) => (
  <div className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      {unit && <p className="text-xs text-gray-400 mt-0.5">{unit}</p>}
    </div>
    <div className="w-44 flex-shrink-0">
      {readOnly ? (
        <input
          type="number"
          {...register(name)}
          readOnly
          className="w-full px-3 py-2 text-right text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
        />
      ) : (
        <input
          type="number"
          step={step}
          min={min}
          {...register(name)}
          className="w-full px-3 py-2 text-right text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
        />
      )}
    </div>
  </div>
);

const Parametres = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = user?.role === 'PDG' || user?.role === 'CHEF_COMPTABLE';

  const { data, isLoading } = useQuery({
    queryKey: ['parametres-erp'],
    queryFn: () => parametresAPI.get(),
    select: (r) => r.data.data,
  });

  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      loyerMensuel: 500000, fraisGenerauxMensuels: 150000,
      impotsTauxPct: 5, volumeRefMensuel: 200,
      prixGasoil: 1205, prixTransportCiment: 2350,
      margeCiment: 1.05, margeGravier: 1.10, margeSable: 1.10,
      chargePersonnelM3: 245, fraisRestaurationPlat: 1500, nbRepasRef: 12,
      fraisChauffeurKm: 500,
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        loyerMensuel: data.loyerMensuel,
        fraisGenerauxMensuels: data.fraisGenerauxMensuels,
        impotsTauxPct: Math.round(data.impotsTaux * 100 * 100) / 100,
        volumeRefMensuel: data.volumeRefMensuel,
        prixGasoil: data.prixGasoil,
        prixTransportCiment: data.prixTransportCiment ?? 2350,
        margeCiment: data.margeCiment ?? 1.05,
        margeGravier: data.margeGravier ?? 1.10,
        margeSable: data.margeSable ?? 1.10,
        chargePersonnelM3: data.chargePersonnelM3,
        fraisRestaurationPlat: data.fraisRestaurationPlat,
        nbRepasRef: data.nbRepasRef,
        fraisChauffeurKm: data.fraisChauffeurKm,
      });
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (formData) => {
      const payload = { ...formData };
      payload.impotsTaux = parseFloat(payload.impotsTauxPct) / 100;
      delete payload.impotsTauxPct;
      // S'assurer que les marges sont bien des nombres
      payload.margeCiment  = parseFloat(payload.margeCiment);
      payload.margeGravier = parseFloat(payload.margeGravier);
      payload.margeSable   = parseFloat(payload.margeSable);
      return parametresAPI.update(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parametres-erp'] });
      toast.success('Paramètres enregistrés avec succès');
    },
    onError: () => {
      toast.error('Erreur lors de la sauvegarde');
    },
  });

  if (isLoading) return <PageLoader />;

  const watched = watch();
  const loyer = parseFloat(watched.loyerMensuel) || 0;
  const fraisGen = parseFloat(watched.fraisGenerauxMensuels) || 0;
  const volRef = parseFloat(watched.volumeRefMensuel) || 200;
  const loyerM3 = volRef > 0 ? Math.round(loyer / volRef) : 0;
  const fraisGenM3 = volRef > 0 ? Math.round(fraisGen / volRef) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 max-w-3xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Settings size={24} className="text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Paramètres ERP</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Configuration des constantes financières — appliquées à tous les calculs automatiques
            </p>
          </div>
        </div>
        {!canEdit && (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg font-medium flex-shrink-0">
            Lecture seule
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">

        {/* Charges d'exploitation */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <SectionTitle icon={DollarSign} title="Charges d'exploitation (mensuelles)" />
          <FieldRow
            label="Loyer / Location centrale"
            unit="FCFA/mois"
            name="loyerMensuel"
            register={register}
            readOnly={!canEdit}
          />
          <FieldRow
            label="Frais généraux — eau, élec, bureau"
            unit="FCFA/mois"
            name="fraisGenerauxMensuels"
            register={register}
            readOnly={!canEdit}
          />
          <FieldRow
            label="Taux d'impôts et taxes"
            unit="% du montant commande (ex: 5 = 5%)"
            name="impotsTauxPct"
            register={register}
            readOnly={!canEdit}
            step="0.01"
            min="0"
          />
        </div>

        {/* Gasoil & Transport */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <SectionTitle icon={DollarSign} title="Gasoil & Transport" color="text-blue-600" bg="bg-blue-50" />
          <FieldRow label="Prix gasoil" unit="FCFA/litre" name="prixGasoil" register={register} readOnly={!canEdit} step="1" />
          <FieldRow label="Prix transport ciment" unit="FCFA/tonne" name="prixTransportCiment" register={register} readOnly={!canEdit} step="1" />
          <FieldRow label="Frais chauffeur" unit="FCFA/km" name="fraisChauffeurKm" register={register} readOnly={!canEdit} step="1" />
        </div>

        {/* Marges de pertes */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <SectionTitle icon={Info} title="Marges de pertes matières" color="text-amber-600" bg="bg-amber-50" />
          <FieldRow label="Marge ciment" unit="Ex: 1.05 = 5% de perte" name="margeCiment" register={register} readOnly={!canEdit} step="0.01" />
          <FieldRow label="Marge gravier (5/15 et 15/25)" unit="Ex: 1.10 = 10% de perte" name="margeGravier" register={register} readOnly={!canEdit} step="0.01" />
          <FieldRow label="Marge sable" unit="Ex: 1.10 = 10% de perte" name="margeSable" register={register} readOnly={!canEdit} step="0.01" />
        </div>

        {/* Personnel & Production */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <SectionTitle icon={Settings} title="Personnel & Production" color="text-green-600" bg="bg-green-50" />
          <FieldRow label="Charge personnel" unit="FCFA/m³" name="chargePersonnelM3" register={register} readOnly={!canEdit} step="1" />
          <FieldRow label="Frais restauration / plat" unit="FCFA" name="fraisRestaurationPlat" register={register} readOnly={!canEdit} step="1" />
          <FieldRow label="Nombre de repas / cycle 200 m³" unit="plats" name="nbRepasRef" register={register} readOnly={!canEdit} step="1" />
          <FieldRow label="Volume de référence" unit="m³ (cycle standard)" name="volumeRefMensuel" register={register} readOnly={!canEdit} step="1" />
        </div>

        {/* Impact info card */}
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} className="text-orange-600" />
            <h4 className="text-sm font-semibold text-orange-800">Impact sur chaque commande</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-3">
              <p className="text-xs text-gray-500">Loyer appliqué / commande</p>
              <p className="text-lg font-bold text-orange-700 mt-0.5">
                {loyer.toLocaleString('fr-FR')} <span className="text-sm font-normal">FCFA</span>
              </p>
            </div>
            <div className="bg-white rounded-xl p-3">
              <p className="text-xs text-gray-500">Frais généraux / commande</p>
              <p className="text-lg font-bold text-orange-700 mt-0.5">
                {fraisGen.toLocaleString('fr-FR')} <span className="text-sm font-normal">FCFA</span>
              </p>
            </div>
          </div>
          <p className="text-xs text-orange-600 mt-3">
            Total charges fixes / commande : <strong>{(loyer + fraisGen).toLocaleString('fr-FR')} FCFA</strong>
          </p>
        </div>

        {/* Save button */}
        {canEdit && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={mutation.isPending}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all',
                'bg-orange-600 text-white hover:bg-orange-700 shadow-sm hover:shadow-md',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <Save size={16} />
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer les paramètres'}
            </button>
          </div>
        )}
      </form>
    </motion.div>
  );
};

export default Parametres;
