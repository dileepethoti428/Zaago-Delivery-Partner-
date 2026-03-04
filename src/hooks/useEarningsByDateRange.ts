import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EarningRecord, PeriodEarnings } from '@/services/earnings';

export interface DateRangeEarningsData {
  summary: PeriodEarnings;
  records: EarningRecord[];
}

export function useEarningsByDateRange() {
  const [data, setData] = useState<DateRangeEarningsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchByDateRange = async (fromDate: Date, toDate: Date) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('get-earnings-by-daterange', {
        method: 'POST',
        body: {
          from_date: fromDate.toISOString().split('T')[0],
          to_date: toDate.toISOString().split('T')[0],
        },
      });

      if (fnError) throw fnError;
      if (!result?.success) throw new Error(result?.error || 'Failed to fetch');

      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch earnings');
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setData(null);
    setError(null);
  };

  return { data, isLoading, error, fetchByDateRange, reset };
}
