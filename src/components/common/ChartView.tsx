import { useEffect, useRef } from 'react';
import type { ECharts } from 'echarts';
import type { DataTable, ChartConfig, Theme } from '@/types';
import { buildOption } from '@/lib/chart/buildOption';

interface ChartViewProps {
  table: DataTable;
  chart: ChartConfig;
  theme: Theme;
}

/**
 * Thin, self-contained ECharts host. It owns one chart instance for its
 * lifetime, re-applies the option whenever inputs change, and resizes with its
 * container. All chart *logic* lives in `buildOption`; this component is purely
 * the rendering boundary, which keeps the React/ECharts seam small and stable.
 *
 * ECharts (~1 MB) is imported dynamically so it only loads once a chart is
 * actually shown, rather than weighing down the initial page load.
 */
export default function ChartView({ table, chart, theme }: ChartViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ECharts | null>(null);
  // Holds the latest inputs so the async init can apply them once ready.
  const latest = useRef({ table, chart, theme });
  latest.current = { table, chart, theme };

  useEffect(() => {
    let observer: ResizeObserver | undefined;
    let disposed = false;

    void import('echarts').then((echarts) => {
      if (disposed || !hostRef.current) return;
      const instance = echarts.init(hostRef.current);
      instanceRef.current = instance;

      const { table: t, chart: c, theme: th } = latest.current;
      instance.setOption(buildOption(t, c, th), { notMerge: true });

      observer = new ResizeObserver(() => instance.resize());
      observer.observe(hostRef.current);
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    // `notMerge` clears stale series when columns are removed from an axis.
    instanceRef.current?.setOption(buildOption(table, chart, theme), { notMerge: true });
  }, [table, chart, theme]);

  return <div className="chart-host" ref={hostRef} />;
}
