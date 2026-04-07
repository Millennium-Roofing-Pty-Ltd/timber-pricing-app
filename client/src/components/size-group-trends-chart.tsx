import { useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import type { TimberSize } from "@shared/schema";

type PriceTrendData = {
  date: string;
  year: number;
  month: number;
  supplierId: string;
  supplierName: string;
  ratePerM: number;
  ratePerM3: number;
};

type SizeGroupTrendsChartProps = {
  dimensions: string;
  sizes: TimberSize[];
};

export function SizeGroupTrendsChart({ dimensions, sizes }: SizeGroupTrendsChartProps) {
  const trendQueries = useQueries({
    queries: sizes.map((size) => ({
      queryKey: ["/api/price-trends", size.id],
      queryFn: async () => {
        const response = await fetch(`/api/price-trends/${size.id}`);
        if (!response.ok) throw new Error("Failed to fetch trend data");
        const data: PriceTrendData[] = await response.json();
        return { size, data };
      },
    })),
  });

  const isLoading = trendQueries.some((query) => query.isLoading);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Combine all trend data from different classifications
  const allTrendData: Array<PriceTrendData & { classification: string }> = [];
  trendQueries.forEach((query) => {
    if (query.data) {
      query.data.data.forEach((item) => {
        allTrendData.push({
          ...item,
          classification: query.data.size.classification,
        });
      });
    }
  });

  if (allTrendData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {dimensions}mm - No Trend Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No price trend data available for this size
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get all unique dates and create classification keys
  const allDates = [...new Set(allTrendData.map((d) => d.date))].sort();
  
  // Create keys for each classification-supplier combination
  const dataKeys = new Map<string, { classification: string; supplierName: string; supplierId: string }>();
  allTrendData.forEach((d) => {
    const key = `${d.classification}-${d.supplierId}`;
    if (!dataKeys.has(key)) {
      dataKeys.set(key, {
        classification: d.classification,
        supplierName: d.supplierName,
        supplierId: d.supplierId,
      });
    }
  });

  // Create a map of key->date->rate for quick lookup
  const dataMap = new Map<string, Map<string, number>>();
  allTrendData.forEach((item) => {
    const key = `${item.classification}-${item.supplierId}`;
    if (!dataMap.has(key)) {
      dataMap.set(key, new Map());
    }
    dataMap.get(key)!.set(item.date, item.ratePerM);
  });

  // Build chart data with all dates and all keys (null for missing data points)
  const chartData = allDates.map((date) => {
    const dataPoint: Record<string, any> = { date };
    dataKeys.forEach((value, key) => {
      const keyData = dataMap.get(key);
      dataPoint[key] = keyData?.get(date) || null;
    });
    return dataPoint;
  });

  const classificationColors = {
    "Shorts": "hsl(210, 100%, 50%)",      // Blue
    "Mediums": "hsl(40, 100%, 50%)",      // Amber
    "Longs": "hsl(150, 60%, 45%)",        // Emerald
  };

  const getLineColor = (classification: string, index: number) => {
    const baseColor = classificationColors[classification as keyof typeof classificationColors] || "hsl(var(--chart-1))";
    return baseColor;
  };

  const sortedKeys = Array.from(dataKeys.keys()).sort((a, b) => {
    const aData = dataKeys.get(a)!;
    const bData = dataKeys.get(b)!;
    
    // First sort by classification
    const classOrder = { "Shorts": 1, "Mediums": 2, "Longs": 3 };
    const classCompare = (classOrder[aData.classification as keyof typeof classOrder] || 0) -
                        (classOrder[bData.classification as keyof typeof classOrder] || 0);
    
    if (classCompare !== 0) return classCompare;
    
    // Then by supplier name
    return aData.supplierName.localeCompare(bData.supplierName);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {dimensions}mm Price Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: "hsl(var(--foreground))" }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: "hsl(var(--foreground))" }}
              label={{ value: 'Rate per Meter (R/m)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
              formatter={(value: number | null, name: string) => {
                if (value === null) return 'No data';
                const keyData = dataKeys.get(name);
                const label = keyData ? `${keyData.classification} - ${keyData.supplierName}` : name;
                return [`R${value.toFixed(2)}/m`, label];
              }}
            />
            <Legend 
              formatter={(value) => {
                const keyData = dataKeys.get(value);
                return keyData ? `${keyData.classification} - ${keyData.supplierName}` : value;
              }}
            />
            {sortedKeys.map((key, index) => {
              const keyData = dataKeys.get(key)!;
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={`${keyData.classification} - ${keyData.supplierName}`}
                  stroke={getLineColor(keyData.classification, index)}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
