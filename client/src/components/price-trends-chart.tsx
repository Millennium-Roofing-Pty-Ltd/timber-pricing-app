import { useQuery } from "@tanstack/react-query";
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

type PriceTrendData = {
  date: string;
  year: number;
  month: number;
  supplierId: string;
  supplierName: string;
  ratePerM: number;
  ratePerM3: number;
};

type PriceTrendsChartProps = {
  timberSizeId: string;
  timberSizeName: string;
};

export function PriceTrendsChart({ timberSizeId, timberSizeName }: PriceTrendsChartProps) {
  const { data: trendData, isLoading } = useQuery<PriceTrendData[]>({
    queryKey: ["/api/price-trends", timberSizeId],
  });

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

  if (!trendData || trendData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Price Trends - {timberSizeName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No price trend data available
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get all unique dates and suppliers (use ID as key to avoid name collisions)
  const allDates = [...new Set(trendData.map((d) => d.date))].sort();
  const supplierMap = new Map<string, string>();
  trendData.forEach((d) => {
    if (!supplierMap.has(d.supplierId)) {
      supplierMap.set(d.supplierId, d.supplierName);
    }
  });
  const supplierIds = Array.from(supplierMap.keys()).sort((a, b) => 
    supplierMap.get(a)!.localeCompare(supplierMap.get(b)!)
  );
  
  // Create a map of supplierId->date->rate for quick lookup
  const dataMap = new Map<string, Map<string, number>>();
  trendData.forEach((item) => {
    if (!dataMap.has(item.supplierId)) {
      dataMap.set(item.supplierId, new Map());
    }
    dataMap.get(item.supplierId)!.set(item.date, item.ratePerM);
  });

  // Build chart data with all dates and all suppliers (null for missing data points)
  const chartData = allDates.map((date) => {
    const dataPoint: Record<string, any> = { date };
    supplierIds.forEach((supplierId) => {
      const supplierData = dataMap.get(supplierId);
      dataPoint[supplierId] = supplierData?.get(date) || null;
    });
    return dataPoint;
  });
  
  const colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Price Trends - {timberSizeName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
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
              formatter={(value: number | null) => 
                value !== null ? `R${value.toFixed(2)}/m` : 'No data'
              }
            />
            <Legend 
              formatter={(value) => supplierMap.get(value) || value}
            />
            {supplierIds.map((supplierId, index) => (
              <Line
                key={supplierId}
                type="monotone"
                dataKey={supplierId}
                name={supplierMap.get(supplierId)}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
