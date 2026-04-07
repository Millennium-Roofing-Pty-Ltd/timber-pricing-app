import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type PriceChange = {
  rate: {
    id: string;
    ratePerM: string;
    year: number;
    month: number;
  };
  supplier: {
    id: string;
    name: string;
  };
  timberSize: {
    id: string;
    thickness: number;
    width: number;
    classification: string;
    grade: string;
  };
  priceChange: {
    percentage: number;
    previous: number;
    new: number;
  };
};

export function PriceChangesAlert({ threshold = 5 }: { threshold?: number }) {
  const { data: priceChanges, isLoading } = useQuery<PriceChange[]>({
    queryKey: [`/api/dashboard/price-changes?threshold=${threshold}`],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="gap-1 space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Price Change Alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!priceChanges || priceChanges.length === 0) {
    return (
      <Card>
        <CardHeader className="gap-1 space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Price Change Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No significant price changes detected (threshold: {threshold}%)
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="gap-1 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <AlertTriangle className="h-4 w-4" />
          Price Change Alerts
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Changes exceeding {threshold}% threshold
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {priceChanges.slice(0, 5).map((change) => {
          const percentage = change.priceChange.percentage;
          
          // Guard against non-finite percentages
          if (!isFinite(percentage)) {
            return null;
          }
          
          const isIncrease = percentage > 0;
          const absPercentage = Math.abs(percentage);
          
          return (
            <Alert
              key={change.rate.id}
              className="py-3"
              data-testid={`alert-price-change-${change.rate.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 flex-1">
                  {isIncrease ? (
                    <TrendingUp className="h-4 w-4 mt-0.5 text-destructive" />
                  ) : (
                    <TrendingDown className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-500" />
                  )}
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {change.supplier.name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {change.timberSize.thickness}x{change.timberSize.width}mm
                      </Badge>
                    </div>
                    <AlertDescription className="text-xs">
                      {change.timberSize.classification} - {change.timberSize.grade}
                    </AlertDescription>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      <span>
                        R{change.priceChange.previous.toFixed(2)} → R{change.priceChange.new.toFixed(2)}/m
                      </span>
                      <Badge 
                        variant={isIncrease ? "destructive" : "default"}
                        className="text-xs"
                      >
                        {isIncrease ? '+' : ''}{absPercentage.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </Alert>
          );
        })}
      </CardContent>
    </Card>
  );
}
