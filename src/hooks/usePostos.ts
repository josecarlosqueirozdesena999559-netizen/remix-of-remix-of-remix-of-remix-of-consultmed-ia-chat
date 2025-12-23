import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Posto {
  id: string;
  nome: string;
  localidade: string;
  horario_funcionamento: string;
  contato: string | null;
  status: string;
}

export function usePostos() {
  const [postos, setPostos] = useState<Posto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPostos() {
      try {
        const { data, error } = await supabase
          .from('postos')
          .select('*')
          .eq('status', 'aberto');
        
        if (error) throw error;
        setPostos(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar postos');
      } finally {
        setLoading(false);
      }
    }

    fetchPostos();
  }, []);

  const searchPostos = (query: string): Posto[] => {
    if (!query.trim()) return postos;
    
    const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    return postos.filter(posto => {
      const normalizedNome = posto.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normalizedLocalidade = posto.localidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      return normalizedNome.includes(normalizedQuery) || 
             normalizedLocalidade.includes(normalizedQuery);
    });
  };

  return { postos, loading, error, searchPostos };
}
