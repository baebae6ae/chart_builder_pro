import { formatCompact, formatNumber } from '@/lib/util/format';

/**
 * Natural-language narration for insights. Pure string building kept out of the
 * rule functions so captions can grow richer without cluttering insights.ts.
 */

export interface TrendFacts {
  measureName: string;
  /** Time-ordered category labels. */
  labels: string[];
  /** Aggregated values aligned to `labels`. */
  values: number[];
}

/** A descriptive sentence about a time trend: magnitude, shape, and peak. */
export function describeTrend({ measureName, labels, values }: TrendFacts): string {
  if (values.length < 2) return `${measureName} 추세`;
  const first = values[0];
  const last = values[values.length - 1];
  const deltaPct = first !== 0 ? (Math.abs(last - first) / Math.abs(first)) * 100 : last > 0 ? 100 : 0;
  const dir = last >= first ? '증가' : '감소';

  let up = 0;
  let down = 0;
  for (let i = 1; i < values.length; i += 1) {
    const d = values[i] - values[i - 1];
    if (d > 0) up += 1;
    else if (d < 0) down += 1;
  }
  let shape: string;
  if (down === 0 && up > 0) shape = '꾸준히 상승하는';
  else if (up === 0 && down > 0) shape = '꾸준히 하락하는';
  else if (last > first) shape = '등락 속에 전반적으로 상승하는';
  else if (last < first) shape = '등락 속에 전반적으로 하락하는';
  else shape = '큰 추세 없이 등락하는';

  let peak = 0;
  for (let i = 1; i < values.length; i += 1) if (values[i] > values[peak]) peak = i;

  return (
    `${measureName}은(는) ${labels[0]} ${formatCompact(first)}에서 ` +
    `${labels[labels.length - 1]} ${formatCompact(last)}로 ${formatNumber(deltaPct)}% ${dir} — ` +
    `${shape} 흐름이며 ${labels[peak]}에 ${formatCompact(values[peak])}로 최고치입니다.`
  );
}

/** A descriptive sentence about a correlation, with a plain-language relation. */
export function describeCorrelation(aName: string, bName: string, r: number, n: number): string {
  const abs = Math.abs(r);
  const strength = abs >= 0.7 ? '강한' : abs >= 0.5 ? '뚜렷한' : '약한';
  const sign = r >= 0 ? '양' : '음';
  const relation =
    r >= 0
      ? `${aName}이(가) 클수록 ${bName}도 함께 커지는`
      : `${aName}이(가) 클수록 ${bName}은(는) 작아지는`;
  const caveat = abs < 0.5 ? ' 다만 관계가 약해 참고용입니다.' : '';
  return `${relation} ${strength} ${sign}의 상관이 보입니다 (r=${formatNumber(r)}, 표본 ${n}개).${caveat}`;
}
