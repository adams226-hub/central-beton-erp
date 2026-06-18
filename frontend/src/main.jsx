import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10,   // données fraîches pendant 10 min → pas de refetch en naviguant
      gcTime:    1000 * 60 * 30,   // données gardées en mémoire 30 min
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,       // ne refetch pas si les données sont encore fraîches
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
