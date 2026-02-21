import { useState, useEffect, useRef } from "react";

export function useQuery<T>(
  queryKey: number,
  queryFn: () => Promise<T>
): { data: T | undefined; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(queryFn);
  fnRef.current = queryFn;

  useEffect(() => {
    setLoading(true);
    setError(null);
    fnRef.current()
      .then(setData)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Request failed")
      )
      .finally(() => setLoading(false));
  }, [queryKey]);

  return { data, loading, error };
}
