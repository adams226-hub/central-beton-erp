import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FileText, Download, TrendingUp, Package, Wrench, BarChart3, Calendar, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { rapportsAPI } from '../api';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatMontant, formatDate } from '../utils/formatters';
import { cn } from '../lib/utils';

const today = new Date().toISOString().split('T')[0];
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

const Section = ({ icon: Icon, title, color = 'text-blue-600', children }) => (
  <div className="amp-card overflow-hidden">
    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
      <h2 className="font-bold text-gray-800 flex items-center gap-2">
        <Icon size={18} className={color} /> {title}
      </h2>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const StatRow = ({ label, value, sub, highlight }) => (
  <div className={cn('flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0', highlight && 'bg-green-50 -mx-5 px-5 rounded')}>
    <span className="text-sm text-gray-600">{label}</span>
    <div className="text-right">
      <span className={cn('text-sm font-bold', highlight ? 'text-green-700' : 'text-gray-800')}>{value}</span>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  </div>
);

const ExportButton = ({ label, onClick, variant = 'pdf' }) => (
  <button
    onClick={onClick}
    className={cn(
      'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
      variant === 'pdf'
        ? 'bg-red-50 hover:bg-red-100 text-red-700'
        : 'bg-green-50 hover:bg-green-100 text-green-700'
    )}
  >
    <Download size={12} /> {label}
  </button>
);

const TableauDeBordPDG = ({ dateDebut, dateFin }) => {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['rapport-pdg', dateDebut, dateFin],
    queryFn: () => rapportsAPI.tableauDeBordPDG({ dateDebut, dateFin }),
    select: (r) => r.data.data,
  });

  if (isLoading) return <div className="py-6 text-center text-gray-400 text-sm">Chargement...</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Résumé financier */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'CA période', value: formatMontant(data.chiffreAffaires), color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Bénéfice net', value: formatMontant(data.beneficeNet), color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Taux de marge', value: `${(data.tauxMarge || 0).toFixed(1)}%`, color: data.tauxMarge > 15 ? 'text-green-700' : 'text-amber-700', bg: 'bg-gray-50' },
          { label: 'Commandes', value: data.nombreCommandes || 0, color: 'text-gray-800', bg: 'bg-gray-50' },
          { label: 'Volume béton', value: `${(data.volumeTotal || 0).toLocaleString('fr-FR')} m³`, color: 'text-gray-800', bg: 'bg-gray-50' },
          { label: 'Encaissé', value: formatMontant(data.montantEncaisse), color: 'text-green-700', bg: 'bg-green-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('rounded-xl p-3', bg)}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className={cn('text-lg font-bold mt-0.5', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Top commandes */}
      {data.topCommandes?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Top commandes par CA</p>
          <div className="space-y-1">
            {data.topCommandes.slice(0, 5).map((c, i) => (
              <div key={c.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                  <div>
                    <span className="font-medium text-gray-700">{c.nomClient}</span>
                    <span className="text-gray-400 text-xs ml-2">{c.reference}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800">{formatMontant(c.montantCommande)}</p>
                  {c.beneficeNetReel != null && (
                    <p className="text-xs text-green-600">Bén. {formatMontant(c.beneficeNetReel)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const RapportBenefices = ({ dateDebut, dateFin }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['rapport-benefices', dateDebut, dateFin],
    queryFn: () => rapportsAPI.beneficesParCommande({ dateDebut, dateFin }),
    select: (r) => r.data.data,
  });

  const handleExport = async (format) => {
    const toastId = toast.loading(`Génération ${format === 'excel' ? 'Excel' : 'PDF'} en cours...`);
    try {
      const mimeType = format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      const res = await rapportsAPI.exportBenefices({ dateDebut, dateFin, format });
      const url = URL.createObjectURL(new Blob([res.data], { type: mimeType }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `AMP-BETON_benefices_${dateDebut || 'debut'}_${dateFin || 'fin'}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${format === 'excel' ? 'Excel' : 'PDF'} téléchargé avec succès`, { id: toastId });
    } catch (err) {
      const msg = err.response?.data?.message || `Erreur lors de l'export ${format}`;
      toast.error(msg, { id: toastId });
    }
  };

  if (isLoading) return <div className="py-6 text-center text-gray-400 text-sm">Chargement...</div>;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <ExportButton label="Export PDF" onClick={() => handleExport('pdf')} variant="pdf" />
        <ExportButton label="Export Excel" onClick={() => handleExport('excel')} variant="excel" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Référence', 'Client', 'Volume', 'CA', 'Coût matières', 'Coût total', 'Bénéfice net', 'Marge %'].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data?.commandes?.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Aucune commande sur la période</td></tr>
            )}
            {data?.commandes?.map((c) => {
              const marge = c.tauxMargeReel ?? c.margePrevisionnelle ?? 0;
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs text-blue-700">{c.reference}</td>
                  <td className="px-3 py-2 font-medium text-gray-700">{c.nomClient}</td>
                  <td className="px-3 py-2 text-gray-600">{c.volumeCommande} m³</td>
                  <td className="px-3 py-2 font-bold text-gray-800">{formatMontant(c.montantCommande)}</td>
                  <td className="px-3 py-2 text-gray-600">{formatMontant(c.coutMatieresPrevisionnel)}</td>
                  <td className="px-3 py-2 text-gray-600">{formatMontant(c.depensesReelles ?? c.coutTotalPrevisionnel)}</td>
                  <td className={cn('px-3 py-2 font-bold', (c.beneficeNetReel ?? c.beneficeNet) >= 0 ? 'text-green-700' : 'text-red-700')}>
                    {formatMontant(c.beneficeNetReel ?? c.beneficeNet ?? 0)}
                  </td>
                  <td className={cn('px-3 py-2 font-medium', marge >= 15 ? 'text-green-700' : marge >= 8 ? 'text-amber-700' : 'text-red-600')}>
                    {marge.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
          {data?.totaux && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-xs text-gray-600">TOTAL ({data.totaux.nbCommandes} commandes)</td>
                <td className="px-3 py-2 text-gray-800">{formatMontant(data.totaux.caTotal)}</td>
                <td className="px-3 py-2 text-gray-600">{formatMontant(data.totaux.coutMatieres)}</td>
                <td className="px-3 py-2 text-gray-600">{formatMontant(data.totaux.coutTotal)}</td>
                <td className="px-3 py-2 text-green-700">{formatMontant(data.totaux.beneficeNet)}</td>
                <td className="px-3 py-2 text-gray-700">{(data.totaux.tauxMarge || 0).toFixed(1)}%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

const RapportStocks = ({ dateDebut, dateFin }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['rapport-stocks', dateDebut, dateFin],
    queryFn: () => rapportsAPI.rapportStock({ dateDebut, dateFin }),
    select: (r) => r.data.data,
  });

  if (isLoading) return <div className="py-6 text-center text-gray-400 text-sm">Chargement...</div>;

  return (
    <div className="space-y-2">
      {data?.map((s) => (
        <div key={s.id} className="bg-gray-50 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold text-gray-800 text-sm">{s.designation}</p>
            <p className="text-xs text-gray-400">{s.fournisseur}</p>
          </div>
          <div className="flex gap-6 text-center text-xs">
            <div><p className="text-gray-400">Stock actuel</p><p className="font-bold text-gray-800">{s.quantite?.toLocaleString('fr-FR')} {s.unite}</p></div>
            <div><p className="text-gray-400">Consommé période</p><p className="font-bold text-red-600">{(s.consommePeriode || 0).toLocaleString('fr-FR')} {s.unite}</p></div>
            <div><p className="text-gray-400">Acheté période</p><p className="font-bold text-green-600">{(s.achetePeriode || 0).toLocaleString('fr-FR')} {s.unite}</p></div>
            <div><p className="text-gray-400">Valeur stock</p><p className="font-bold text-blue-700">{formatMontant(s.valeurStock)}</p></div>
          </div>
        </div>
      ))}
    </div>
  );
};

const RapportProduction = ({ dateDebut, dateFin }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['rapport-production', dateDebut, dateFin],
    queryFn: () => rapportsAPI.rapportProduction({ dateDebut, dateFin }),
    select: (r) => r.data.data,
  });

  if (isLoading) return <div className="py-6 text-center text-gray-400 text-sm">Chargement...</div>;

  return (
    <div className="space-y-3">
      {data?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
          {[
            { label: 'Productions', value: data.stats.total || 0 },
            { label: 'Volume produit', value: `${(data.stats.volumeTotal || 0).toLocaleString('fr-FR')} m³` },
            { label: 'Gasoil consommé', value: `${(data.stats.gasoilTotal || 0).toLocaleString('fr-FR')} L` },
            { label: 'Coût carburant', value: formatMontant(data.stats.coutCarburant) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">{label}</p>
              <p className="font-bold text-gray-800 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Réf. production', 'Commande', 'Volume prévu', 'Volume réel', 'Statut', 'Date', 'Opérateur'].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data?.productions?.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Aucune production sur la période</td></tr>
            )}
            {data?.productions?.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs text-blue-700">{p.reference}</td>
                <td className="px-3 py-2 text-gray-600 text-xs">{p.commande?.reference}</td>
                <td className="px-3 py-2">{p.volumePlanifie} m³</td>
                <td className="px-3 py-2 font-medium">{p.volumeReel ?? '—'} {p.volumeReel ? 'm³' : ''}</td>
                <td className="px-3 py-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{p.statut}</span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-400">{formatDate(p.createdAt)}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{p.operateur?.prenom} {p.operateur?.nom}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Rapports = () => {
  const [dateDebut, setDateDebut] = useState(monthStart);
  const [dateFin, setDateFin] = useState(today);
  const [activeTab, setActiveTab] = useState('pdg');

  const tabs = [
    { id: 'pdg', label: 'Vue PDG', icon: BarChart3 },
    { id: 'benefices', label: 'Bénéfices', icon: TrendingUp },
    { id: 'production', label: 'Production', icon: FileText },
    { id: 'stocks', label: 'Stocks', icon: Package },
  ];

  return (
    <div className="space-y-5">
      {/* Filtres période */}
      <div className="amp-card p-4 flex items-center gap-4 flex-wrap">
        <Calendar size={16} className="text-gray-500 flex-shrink-0" />
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Du</label>
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="amp-input text-sm w-auto" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Au</label>
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="amp-input text-sm w-auto" />
          </div>
        </div>
        <div className="flex gap-2 ml-auto">
          {[
            { label: 'Ce mois', action: () => { setDateDebut(monthStart); setDateFin(today); } },
            { label: '7 jours', action: () => { const d = new Date(); d.setDate(d.getDate() - 7); setDateDebut(d.toISOString().split('T')[0]); setDateFin(today); } },
          ].map(({ label, action }) => (
            <button key={label} onClick={action} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium">
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Onglets */}
      <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
              activeTab === id ? 'bg-blue-700 text-white' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <Icon size={15} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Contenu */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {activeTab === 'pdg' && (
          <Section icon={BarChart3} title={`Vue d'ensemble PDG — ${formatDate(dateDebut)} au ${formatDate(dateFin)}`}>
            <TableauDeBordPDG dateDebut={dateDebut} dateFin={dateFin} />
          </Section>
        )}
        {activeTab === 'benefices' && (
          <Section icon={TrendingUp} title="Bénéfices par commande" color="text-green-600">
            <RapportBenefices dateDebut={dateDebut} dateFin={dateFin} />
          </Section>
        )}
        {activeTab === 'production' && (
          <Section icon={FileText} title="Rapport de production" color="text-blue-600">
            <RapportProduction dateDebut={dateDebut} dateFin={dateFin} />
          </Section>
        )}
        {activeTab === 'stocks' && (
          <Section icon={Package} title="Rapport stocks & consommations" color="text-amber-600">
            <RapportStocks dateDebut={dateDebut} dateFin={dateFin} />
          </Section>
        )}
      </motion.div>
    </div>
  );
};

export default Rapports;
