import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type TimberSize, type Supplier } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, TrendingUp, TrendingDown, Filter } from "lucide-react";
import { ExportButton } from "@/components/export-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { sortTimberSizesByExcelSequence } from "@shared/timber-sort";

interface PricingDataItem {
  timberSize: TimberSize;
  supplierRates: any[];
  lowest: number | null;
  average: number | null;
  highest: number | null;
}

interface HistoricalPeriod {
  year: number;
  month: number;
}

interface HistoricalRate {
  id: string;
  timberSizeId: string;
  systemRate: string;
  year: number;
  month: number;
  timberSize: TimberSize;
}

type PricingReportData = {
  timberSize: TimberSize;
  marketLow: number | null;
  marketAvg: number | null;
  marketHigh: number | null;
  systemRate: number;
  percentDifference: number | null;
};

export default function Reports() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("current");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [tempSelectedSupplierIds, setTempSelectedSupplierIds] = useState<string[]>([]);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: historicalPeriods } = useQuery<HistoricalPeriod[]>({
    queryKey: ["/api/system-pricing/history/periods"],
  });

  const { data: pricingData, isLoading: isLoadingCurrent } = useQuery<PricingDataItem[]>({
    queryKey: [
      "/api/system-pricing/data",
      selectedSupplierIds
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedSupplierIds.length > 0) {
        params.append('selectedSupplierIds', selectedSupplierIds.join(','));
      }
      const url = `/api/system-pricing/data${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch pricing data');
      return res.json();
    },
    enabled: selectedPeriod === "current",
  });

  const { data: historicalRates, isLoading: isLoadingHistorical } = useQuery<HistoricalRate[]>({
    queryKey: [`/api/system-pricing/history/${selectedYear}/${selectedMonth}`],
    enabled: selectedPeriod !== "current" && selectedYear !== null && selectedMonth !== null,
  });

  useEffect(() => {
    if (selectedPeriod !== "current" && selectedPeriod !== "") {
      const [year, month] = selectedPeriod.split("-");
      setSelectedYear(parseInt(year));
      setSelectedMonth(parseInt(month));
    }
  }, [selectedPeriod]);

  const isLoading = selectedPeriod === "current" ? isLoadingCurrent : isLoadingHistorical;

  // Sort pricing data by Excel row sequence
  const sortedPricingData = pricingData 
    ? sortTimberSizesByExcelSequence(pricingData.map(item => item.timberSize))
        .map(timberSize => pricingData.find(item => item.timberSize.id === timberSize.id)!)
        .filter(Boolean)
    : [];
  
  const sortedHistoricalData = historicalRates
    ? sortTimberSizesByExcelSequence(historicalRates.map(hr => hr.timberSize))
        .map(timberSize => historicalRates.find(hr => hr.timberSize.id === timberSize.id)!)
        .filter(Boolean)
    : [];

  const reportData: PricingReportData[] = selectedPeriod === "current"
    ? sortedPricingData.map((item) => {
        const systemRate = parseFloat(item.timberSize.systemRate || "0");
        const marketHigh = item.highest;
        
        // Calculate % difference: ((systemRate - marketHigh) / marketHigh) * 100
        let percentDifference: number | null = null;
        if (marketHigh !== null && marketHigh > 0 && isFinite(marketHigh)) {
          const diff = ((systemRate - marketHigh) / marketHigh) * 100;
          percentDifference = isFinite(diff) ? diff : null;
        }
        
        return {
          timberSize: item.timberSize,
          marketLow: item.lowest,
          marketAvg: item.average,
          marketHigh: item.highest,
          systemRate,
          percentDifference,
        };
      })
    : sortedHistoricalData.map((item) => {
        const systemRate = parseFloat(item.systemRate || "0");
        
        return {
          timberSize: item.timberSize,
          marketLow: null,
          marketAvg: null,
          marketHigh: null,
          systemRate,
          percentDifference: null,
        };
      });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-reports-title">
            Pricing Reports
          </h1>
          <p className="text-muted-foreground">
            {selectedPeriod === "current" ? "Current system rates vs market rates" : "Historical system rates"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-48" data-testid="select-period">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Rates</SelectItem>
              {historicalPeriods?.map((period) => {
                const periodKey = `${period.year}-${period.month}`;
                const date = new Date(period.year, period.month - 1);
                const label = date.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                });
                return (
                  <SelectItem key={periodKey} value={periodKey}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {selectedPeriod === "current" && (
            <Popover open={filterPopoverOpen} onOpenChange={(open) => {
              setFilterPopoverOpen(open);
              if (open) {
                setTempSelectedSupplierIds(selectedSupplierIds);
              }
            }}>
              <PopoverTrigger asChild>
                <Button variant="outline" data-testid="button-filter-suppliers">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter Suppliers
                  {selectedSupplierIds.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedSupplierIds.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-3">Select Suppliers for Market Calculations</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Choose which suppliers to include. Deselect all to use default (includeInMarket flag).
                    </p>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {suppliers?.map((supplier) => (
                      <div key={supplier.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`supplier-${supplier.id}`}
                          checked={tempSelectedSupplierIds.includes(supplier.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setTempSelectedSupplierIds([...tempSelectedSupplierIds, supplier.id]);
                            } else {
                              setTempSelectedSupplierIds(tempSelectedSupplierIds.filter(id => id !== supplier.id));
                            }
                          }}
                          data-testid={`checkbox-supplier-${supplier.id}`}
                        />
                        <label
                          htmlFor={`supplier-${supplier.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {supplier.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {tempSelectedSupplierIds.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTempSelectedSupplierIds([])}
                        className="flex-1"
                        data-testid="button-clear-supplier-filter"
                      >
                        Clear Selection
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedSupplierIds(tempSelectedSupplierIds);
                        setFilterPopoverOpen(false);
                      }}
                      className="flex-1"
                      data-testid="button-apply-supplier-filter"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <ExportButton 
            endpoint="/api/export/pricing-report" 
            filename="pricing-report"
            period={selectedPeriod}
            selectedSupplierIds={selectedSupplierIds}
          />
        </div>
      </div>

      {reportData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>System vs Market Pricing Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timber Size</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Grade</TableHead>
                    {selectedPeriod === "current" && (
                      <>
                        <TableHead className="text-right">Market Low (R/m)</TableHead>
                        <TableHead className="text-right">Market Avg (R/m)</TableHead>
                        <TableHead className="text-right">Market High (R/m)</TableHead>
                      </>
                    )}
                    <TableHead className="text-right">System Rate (R/m³)</TableHead>
                    {selectedPeriod === "current" && (
                      <TableHead className="text-right">% Diff vs Market High</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((row) => (
                    <TableRow key={row.timberSize.id}>
                      <TableCell className="font-medium">
                        {row.timberSize.thickness}×{row.timberSize.width}mm
                      </TableCell>
                      <TableCell>{row.timberSize.classification}</TableCell>
                      <TableCell>{row.timberSize.grade}</TableCell>
                      {selectedPeriod === "current" && (
                        <>
                          <TableCell className="text-right font-mono">
                            {row.marketLow !== null ? `R${row.marketLow.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.marketAvg !== null ? `R${row.marketAvg.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.marketHigh !== null ? `R${row.marketHigh.toFixed(2)}` : "—"}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-right font-mono font-semibold text-primary">
                        R{row.systemRate.toFixed(2)}
                      </TableCell>
                      {selectedPeriod === "current" && (
                        <TableCell className="text-right">
                          {row.percentDifference !== null ? (
                            <div className="flex items-center justify-end gap-1">
                              {row.percentDifference > 0 ? (
                                <TrendingUp className="h-3 w-3 text-chart-1" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-chart-4" />
                              )}
                              <span className="font-mono">{row.percentDifference.toFixed(1)}%</span>
                            </div>
                          ) : (
                            <span>—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No pricing data available. Add timber sizes and supplier rates to generate reports.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
