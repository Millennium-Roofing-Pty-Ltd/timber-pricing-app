import { useQuery } from "@tanstack/react-query";
import { type TimberSize } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { SizeGroupTrendsChart } from "@/components/size-group-trends-chart";
import { TrendingUp } from "lucide-react";

type SizeGroup = {
  dimensions: string;
  sizes: TimberSize[];
};

export default function Trends() {
  const { data: timberSizes, isLoading } = useQuery<TimberSize[]>({
    queryKey: ["/api/timber-sizes"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Group timber sizes by dimensions (thickness x width)
  const sizeGroups: Record<string, SizeGroup> = {};
  
  (timberSizes || []).forEach((size) => {
    const dimensions = `${size.thickness}×${size.width}`;
    
    if (!sizeGroups[dimensions]) {
      sizeGroups[dimensions] = {
        dimensions,
        sizes: [],
      };
    }
    
    sizeGroups[dimensions].sizes.push(size);
  });

  // Sort each group by classification (Shorts, Mediums, Longs)
  Object.values(sizeGroups).forEach((group) => {
    const classOrder = { "Shorts": 1, "Mediums": 2, "Longs": 3 };
    group.sizes.sort((a, b) => 
      (classOrder[a.classification as keyof typeof classOrder] || 0) - 
      (classOrder[b.classification as keyof typeof classOrder] || 0)
    );
  });

  const groups = Object.values(sizeGroups).sort((a, b) => {
    // Sort by numeric dimension value (thickness * width)
    const sizeA = a.sizes[0].thickness * a.sizes[0].width;
    const sizeB = b.sizes[0].thickness * b.sizes[0].width;
    return sizeA - sizeB;
  });

  const groupsWithRates = groups.filter((group) => 
    group.sizes.some((size) => size.systemRate)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-trends-title">
          Price Trends by Size
        </h1>
        <p className="text-muted-foreground">
          Compare Shorts, Mediums, and Longs pricing trends for each timber size
        </p>
      </div>

      {groupsWithRates.length > 0 ? (
        <div className="space-y-6">
          {groupsWithRates.map((group) => (
            <SizeGroupTrendsChart
              key={group.dimensions}
              dimensions={group.dimensions}
              sizes={group.sizes}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <TrendingUp className="h-12 w-12 mb-4" />
          <p>No pricing data available for trend analysis</p>
          <p className="text-sm">Add timber sizes and supplier rates to see trends</p>
        </div>
      )}
    </div>
  );
}
