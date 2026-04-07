import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Clock, Building2 } from "lucide-react";
import type { TimberSize, Supplier } from "@shared/schema";
import { sortTimberSizesByExcelSequence } from "@shared/timber-sort";

interface SupplierRate {
  id: string;
  supplierId: string;
  timberSizeId: string;
  ratePerM3: string;
  ratePerM: string;
  year: number;
  month: number;
  timberSize: TimberSize;
  supplier: Supplier;
}

export default function History() {
  const { data: rates, isLoading } = useQuery<SupplierRate[]>({
    queryKey: ["/api/supplier-rates/history"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!rates || rates.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Historical Rates</h1>
          <p className="text-muted-foreground">
            View historical pricing data by period
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No historical rates available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group rates by period (year-month)
  const ratesByPeriod: Record<string, SupplierRate[]> = {};
  
  rates.forEach((rate) => {
    const periodKey = `${rate.year}-${String(rate.month).padStart(2, '0')}`;
    if (!ratesByPeriod[periodKey]) {
      ratesByPeriod[periodKey] = [];
    }
    ratesByPeriod[periodKey].push(rate);
  });

  // Sort periods (newest first)
  const periods = Object.keys(ratesByPeriod).sort((a, b) => b.localeCompare(a));

  const formatPeriodLabel = (periodKey: string) => {
    const [year, month] = periodKey.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-ZA", {
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-history-title">
          Historical Rates
        </h1>
        <p className="text-muted-foreground">
          Click on a date to view suppliers, then click a supplier to view their pricing
        </p>
      </div>

      <Accordion type="single" collapsible className="space-y-4">
        {periods.map((periodKey) => {
          const periodRates = ratesByPeriod[periodKey];
          
          // Group by supplier within this period
          const ratesBySupplier: Record<string, SupplierRate[]> = {};
          periodRates.forEach((rate) => {
            if (!ratesBySupplier[rate.supplierId]) {
              ratesBySupplier[rate.supplierId] = [];
            }
            ratesBySupplier[rate.supplierId].push(rate);
          });

          // Sort suppliers by name
          const suppliers = Object.keys(ratesBySupplier).sort((a, b) => {
            const nameA = ratesBySupplier[a][0].supplier.name;
            const nameB = ratesBySupplier[b][0].supplier.name;
            return nameA.localeCompare(nameB);
          });

          // Sort timber sizes within each supplier following Excel row sequence
          suppliers.forEach((supplierId) => {
            const timberSizesData = ratesBySupplier[supplierId].map(r => r.timberSize);
            const sortedTimberSizes = sortTimberSizesByExcelSequence(timberSizesData);
            
            // Reorder rates to match sorted timber sizes
            ratesBySupplier[supplierId] = sortedTimberSizes.map(ts => 
              ratesBySupplier[supplierId].find(r => r.timberSizeId === ts.id)!
            );
          });

          return (
            <AccordionItem 
              key={periodKey} 
              value={periodKey}
              className="border rounded-lg"
              data-testid={`period-${periodKey}`}
            >
              <AccordionTrigger 
                className="px-6 hover:no-underline hover-elevate"
                data-testid={`button-period-${periodKey}`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{formatPeriodLabel(periodKey)}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    ({suppliers.length} {suppliers.length === 1 ? 'supplier' : 'suppliers'})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-4">
                <Accordion type="single" collapsible className="space-y-2">
                  {suppliers.map((supplierId) => {
                    const supplierRates = ratesBySupplier[supplierId];
                    const supplierName = supplierRates[0].supplier.name;

                    return (
                      <AccordionItem 
                        key={supplierId} 
                        value={supplierId}
                        className="border rounded-lg"
                        data-testid={`supplier-${supplierId}`}
                      >
                        <AccordionTrigger 
                          className="px-4 hover:no-underline hover-elevate"
                          data-testid={`button-supplier-${supplierId}`}
                        >
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            <span className="font-medium">{supplierName}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              ({supplierRates.length} {supplierRates.length === 1 ? 'item' : 'items'})
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Timber Size</TableHead>
                                  <TableHead>Classification</TableHead>
                                  <TableHead>Grade</TableHead>
                                  <TableHead>Length Range</TableHead>
                                  <TableHead className="text-right">Rate per m³</TableHead>
                                  <TableHead className="text-right">Rate per m</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {supplierRates.map((rate) => (
                                  <TableRow key={rate.id} data-testid={`row-rate-${rate.id}`}>
                                    <TableCell className="font-medium">
                                      {rate.timberSize.thickness}×{rate.timberSize.width}mm
                                    </TableCell>
                                    <TableCell>
                                      {rate.timberSize.classification}
                                    </TableCell>
                                    <TableCell>{rate.timberSize.grade}</TableCell>
                                    <TableCell>
                                      {rate.timberSize.lengthMin}m - {rate.timberSize.lengthMax}m
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      R{parseFloat(rate.ratePerM3).toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      R{parseFloat(rate.ratePerM).toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
