import { Check } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { OptionDistribution as OptionDistributionEntry } from "@/services/analytics";

// Option distribution for a single MULTIPLE_CHOICE question. The correct option is
// marked from the backend's `isCorrect` flag (never inferred); every other option
// is a distractor, and the distractor with the most picks is flagged so it's clear
// which wrong answer is the strongest lure. Percentages come straight from the
// backend (over totalSubmittedAnswers) — no client-side recomputation.

const CORRECT_COLOR = "var(--chart-3)"; // green
const DISTRACTOR_COLOR = "var(--chart-1)"; // primary

const letterFor = (index: number) => String.fromCharCode(65 + index);

export function OptionDistribution({ options }: { options: OptionDistributionEntry[] }) {
  // Strongest distractor = wrong option with the most picks (only if any picked).
  let topDistractorId: number | null = null;
  let topDistractorCount = 0;
  for (const option of options) {
    if (!option.isCorrect && option.selectedCount > topDistractorCount) {
      topDistractorCount = option.selectedCount;
      topDistractorId = option.optionId;
    }
  }

  const chartData = options.map((option, index) => ({
    letter: letterFor(index),
    selectedPercentage: option.selectedPercentage,
    optionId: option.optionId,
    isCorrect: option.isCorrect,
  }));

  return (
    <div className="space-y-4">
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={chartData} layout="vertical" margin={{ left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} fontSize={11} unit="%" />
            <YAxis type="category" dataKey="letter" width={28} fontSize={11} />
            <Tooltip formatter={(value: number | string) => `${value}%`} />
            <Bar dataKey="selectedPercentage" radius={4}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.optionId}
                  fill={entry.isCorrect ? CORRECT_COLOR : DISTRACTOR_COLOR}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Option</TableHead>
              <TableHead className="text-right">Picks</TableHead>
              <TableHead className="text-right">Share</TableHead>
              <TableHead className="text-right">Marker</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {options.map((option, index) => (
              <TableRow key={option.optionId}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {letterFor(index)}
                </TableCell>
                <TableCell className="font-medium">{option.text}</TableCell>
                <TableCell className="text-right tabular-nums">{option.selectedCount}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {option.selectedPercentage}%
                </TableCell>
                <TableCell className="text-right">
                  {option.isCorrect ? (
                    <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                      <Check className="h-3 w-3" /> Correct
                    </Badge>
                  ) : option.optionId === topDistractorId ? (
                    <Badge variant="secondary">Top distractor</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Distractor</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
