import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { GEORGIA_REGIONS, type GeorgiaRegion } from '../data/georgiaRegions';

type Row = { region_id: string; region_label: string; region_sort: number; district: string; sort_order: number };

// ბოლო ცნობილი სია — სტატიკური fallback-იდან იწყება, backend-ის (0115, ადმინ-პანელიდან მართული)
// წარმატებულ წაკითხვაზე იცვლება. ქსელის ჩავარდნაზე არაფერი ირღვევა.
let cache: GeorgiaRegion[] = GEORGIA_REGIONS;

export const regionService = {
  getCached: () => cache,
  async listRegions(): Promise<GeorgiaRegion[]> {
    const { data, error } = await supabase
      .from('region_districts')
      .select('region_id, region_label, region_sort, district, sort_order')
      .eq('is_active', true)
      .order('region_sort')
      .order('sort_order');
    if (error || !data || data.length === 0) return cache;
    const byRegion = new Map<string, GeorgiaRegion>();
    for (const r of data as Row[]) {
      const region = byRegion.get(r.region_id) ?? { id: r.region_id, label: r.region_label, districts: [] };
      region.districts.push(r.district);
      byRegion.set(r.region_id, region);
    }
    cache = [...byRegion.values()];
    return cache;
  },
};

export function useRegions(): GeorgiaRegion[] {
  const [regions, setRegions] = useState(regionService.getCached());
  useEffect(() => {
    regionService.listRegions().then(setRegions);
  }, []);
  return regions;
}
