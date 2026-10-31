import { useMemo } from 'react';
import { analyzeCapture } from '@/core/analysis/analyze';
import { createCapture } from '@/core/capture';
import type { ElementSnapshot } from '@/core/element-snapshot';
import type { Recording } from '@/core/recording';
import { buildRecipe } from '@/core/recipe/recipe';
import { describeStyles } from '@/core/style-groups';
import { readDefaultStyles } from '../default-styles';
import { AnalysisCard } from './AnalysisCard';
import { RecipeCard } from './RecipeCard';

interface RecordingResultsProps {
  hostname: string;
  snapshot: ElementSnapshot;
  recording: Recording;
}

/** The recipe and the analysis behind it. The analysis is computed once and shared. */
export function RecordingResults({ hostname, snapshot, recording }: RecordingResultsProps) {
  const { analysis, recipe } = useMemo(() => {
    const capture = createCapture({ hostname, extensionVersion: '', snapshot, recording, exportedAt: new Date(0) });
    const result = analyzeCapture(capture);
    const styleRows = describeStyles(snapshot, readDefaultStyles(snapshot)).flatMap((group) => group.rows);
    return { analysis: result, recipe: buildRecipe({ capture, analysis: result, styleRows }) };
  }, [hostname, snapshot, recording]);

  return (
    <>
      <RecipeCard recipe={recipe} />
      <AnalysisCard analysis={analysis} />
    </>
  );
}
