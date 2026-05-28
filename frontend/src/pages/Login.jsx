import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Building2, Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setError('');
    try {
      const user = await login(data.email, data.password);
      navigate('/dashboard');
    } catch (err) {
      if (!err.response) {
        setError('Impossible de contacter le serveur. Vérifiez que le backend est démarré.');
      } else {
        setError(err.response.data?.message || 'Email ou mot de passe incorrect');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amp-900 via-amp-800 to-blue-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-amp-800 to-blue-700 px-8 py-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">AMP BÉTON</h1>
            <p className="text-blue-200 text-sm mt-1">ERP Centrale à Béton </p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-1">Connexion</h2>
            <p className="text-gray-500 text-sm mb-6">Accédez à votre espace de gestion</p>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4"
              >
                <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                <p className="text-red-600 text-sm">{error}</p>
              </motion.div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="exemple@ampbeton.bf"
                    className="amp-input pl-9"
                    autoComplete="email"
                  />
                </div>
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    {...register('password')}
                    type={showPwd ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="amp-input pl-9 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-2 shadow-md hover:shadow-lg"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Connexion en cours...
                  </span>
                ) : 'Se connecter'}
              </button>
            </form>

            {/* Comptes de démonstration */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center mb-3">Comptes de démonstration</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { role: 'PDG', email: 'pdg@ampbeton.bf', pwd: 'Admin@2026' },
                  { role: 'Secrétaire', email: 'secretaire@ampbeton.bf', pwd: 'Secret@2026' },
                  { role: 'Chef site', email: 'chefsite@ampbeton.bf', pwd: 'Chef@2026' },
                  { role: 'Comptable', email: 'comptable@ampbeton.bf', pwd: 'Compta@2026' },
                ].map(({ role, email, pwd }) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      setValue('email', email, { shouldValidate: true });
                      setValue('password', pwd, { shouldValidate: true });
                    }}
                    className="text-left bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg p-2 transition-colors"
                  >
                    <p className="font-medium text-gray-700">{role}</p>
                    <p className="text-gray-400 truncate">{email}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-blue-200/60 text-xs mt-6">
          AMP BÉTON ERP v1.0 — © {new Date().getFullYear()} African Mining Partenair
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
