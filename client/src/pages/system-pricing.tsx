import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AddSystemPricingDialog } from "@/components/add-system-pricing-dialog";
import type { TimberSize, Supplier } from "@shared/schema";
import { sortTimberSizesByExcelSequence } from "@shared/timber-sort";

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

interface SystemPricingData {
  timberSize: TimberSize;
  supplierRates: Array<{
    supplierId: string;
    supplierName: string;
    ratePerM3: number;
    year: number;
    month: number;
  }>;
  lowest: number | null;
  average: number | null;
  highest: number | null;
}

export default function SystemPricing() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("current");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [tempSelectedSupplierIds, setTempSelectedSupplierIds] = useState<string[]>([]);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  
  const { data: timberSizes, isLoading: isLoadingCurrent } = useQuery<TimberSize[]>({
    queryKey: ["/api/timber-sizes"],
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: systemPricingData, isLoading: isLoadingMarket } = useQuery<SystemPricingData[]>({
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
      if (!res.ok) throw new Error('Failed to fetch system pricing data');
      return res.json();
    },
    enabled: selectedPeriod === "current",
  });

  const { data: historicalPeriods } = useQuery<HistoricalPeriod[]>({
    queryKey: ["/api/system-pricing/history/periods"],
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

  const isLoading = selectedPeriod === "current" ? (isLoadingCurrent || isLoadingMarket) : isLoadingHistorical;
  
  const rawData = selectedPeriod === "current" 
    ? systemPricingData?.map(item => item.timberSize) 
    : historicalRates?.map(hr => ({
        ...hr.timberSize,
        systemRate: hr.systemRate,
      }));
  
  const displayData = rawData ? sortTimberSizesByExcelSequence(rawData) : [];
  
  const getMarketData = (sizeId: string) => {
    if (selectedPeriod !== "current" || !systemPricingData) return null;
    return systemPricingData.find(item => item.timberSize.id === sizeId);
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case "Shorts":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Mediums":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case "Longs":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">System Pricing</h1>
            <p className="text-muted-foreground mt-1">Manage system rates for all timber sizes</p>
          </div>
        </div>
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">System Pricing</h1>
          <p className="text-muted-foreground mt-1">
            {selectedPeriod === "current" ? "Current system rates for all timber sizes" : "Historical system rates"}
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
          <Button onClick={() => setDialogOpen(true)} data-testid="button-add-system-pricing">
            <Plus className="h-4 w-4 mr-2" />
            Add New System Pricing
          </Button>
        </div>
      </div>

      <AddSystemPricingDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timber Size</TableHead>
              <TableHead>Classification</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Length Range</TableHead>
              {selectedPeriod === "current" && (
                <>
                  <TableHead className="text-right">Market Low (R/m)</TableHead>
                  <TableHead className="text-right">Market Avg (R/m)</TableHead>
                  <TableHead className="text-right">Market High (R/m)</TableHead>
                </>
              )}
              <TableHead className="text-right">System Rate (R/m³)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData?.map((size) => {
              const marketData = getMarketData(size.id);
              return (
                <TableRow key={size.id} data-testid={`row-timber-${size.id}`}>
                  <TableCell className="font-medium">
                    {size.thickness}×{size.width}mm
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={getClassificationColor(size.classification)}
                    >
                      {size.classification}
                    </Badge>
                  </TableCell>
                  <TableCell>{size.grade}</TableCell>
                  <TableCell>{size.lengthMin}m - {size.lengthMax}m</TableCell>
                  {selectedPeriod === "current" && (
                    <>
                      <TableCell className="text-right text-muted-foreground">
                        {marketData?.lowest !== null && marketData?.lowest !== undefined
                          ? `R${marketData.lowest.toFixed(2)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {marketData?.average !== null && marketData?.average !== undefined
                          ? `R${marketData.average.toFixed(2)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {marketData?.highest !== null && marketData?.highest !== undefined
                          ? `R${marketData.highest.toFixed(2)}`
                          : "—"}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="text-right font-medium">
                    {size.systemRate !== null && size.systemRate !== undefined
                      ? `R${parseFloat(size.systemRate).toFixed(2)}`
                      : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
