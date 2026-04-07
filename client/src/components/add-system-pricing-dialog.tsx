import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface SupplierRate {
  supplierId: string;
  supplierName: string;
  ratePerM3: number;
  year: number;
  month: number;
}

interface PricingDataItem {
  timberSize: any;
  supplierRates: SupplierRate[];
  lowest: number | null;
  average: number | null;
  highest: number | null;
}

interface AddSystemPricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddSystemPricingDialog({ open, onOpenChange }: AddSystemPricingDialogProps) {
  const { toast } = useToast();
  const [newPrices, setNewPrices] = useState<Record<string, string>>({});

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const { data: pricingData, isLoading } = useQuery<PricingDataItem[]>({
    queryKey: ["/api/system-pricing/data"],
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const pricingUpdates = Object.entries(newPrices)
        .filter(([_, value]) => value && parseFloat(value) > 0)
        .map(([timberSizeId, newSystemRate]) => ({
          timberSizeId,
          newSystemRate: parseFloat(newSystemRate),
        }));

      if (pricingUpdates.length === 0) {
        throw new Error("Please enter at least one new system price");
      }

      return await apiRequest("POST", "/api/system-pricing/save", {
        pricingUpdates,
        year: currentYear,
        month: currentMonth,
      });
    },
    onSuccess: async () => {
      toast({
        title: "System pricing updated",
        description: "New system rates have been saved and old rates archived",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/timber-sizes"] });
      setNewPrices({});
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePriceChange = (timberSizeId: string, value: string) => {
    setNewPrices((prev) => ({
      ...prev,
      [timberSizeId]: value,
    }));
  };

  const calculatePercentDiff = (newVal: number, oldVal: number | null) => {
    if (!oldVal || oldVal === 0 || !isFinite(newVal)) return null;
    return ((newVal - oldVal) / oldVal) * 100;
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

  const formatPercentDiff = (diff: number | null) => {
    if (diff === null || !isFinite(diff)) return "—";
    const sign = diff > 0 ? "+" : "";
    return `${sign}${diff.toFixed(1)}%`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New System Pricing</DialogTitle>
          <DialogDescription>
            Enter new system rates for timber sizes. Showing supplier data from the last 3 months.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 bg-background">Size</TableHead>
                  <TableHead className="sticky top-0 bg-background">Class</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">Suppliers (3mo)</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">Lowest (R/m)</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">Average (R/m)</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">Highest (R/m)</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">Current System</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">New System Rate</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">vs Old</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">vs Avg</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">vs High</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricingData?.map((item) => {
                  const newPrice = newPrices[item.timberSize.id]
                    ? parseFloat(newPrices[item.timberSize.id])
                    : null;
                  const currentSystemRate = item.timberSize.systemRate
                    ? parseFloat(item.timberSize.systemRate)
                    : null;
                  
                  const diffVsOld = newPrice ? calculatePercentDiff(newPrice, currentSystemRate) : null;
                  const diffVsAvg = newPrice ? calculatePercentDiff(newPrice, item.average) : null;
                  const diffVsHigh = newPrice ? calculatePercentDiff(newPrice, item.highest) : null;

                  return (
                    <TableRow key={item.timberSize.id}>
                      <TableCell className="font-medium">
                        {item.timberSize.thickness}×{item.timberSize.width}mm
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={getClassificationColor(item.timberSize.classification)}
                        >
                          {item.timberSize.classification}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.supplierRates.length}</TableCell>
                      <TableCell className="text-right">
                        {item.lowest !== null ? `R${item.lowest.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.average !== null ? `R${item.average.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.highest !== null ? `R${item.highest.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {currentSystemRate !== null ? `R${currentSystemRate.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={newPrices[item.timberSize.id] || ""}
                          onChange={(e) => handlePriceChange(item.timberSize.id, e.target.value)}
                          className="w-32 text-right"
                          data-testid={`input-new-price-${item.timberSize.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatPercentDiff(diffVsOld)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatPercentDiff(diffVsAvg)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatPercentDiff(diffVsHigh)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-system-pricing"
          >
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || Object.keys(newPrices).length === 0}
            data-testid="button-save-system-pricing"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save System Pricing"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
