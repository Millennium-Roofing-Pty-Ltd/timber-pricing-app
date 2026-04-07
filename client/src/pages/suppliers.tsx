import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, TrendingUp, TrendingDown, Users, Eye } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertSupplierSchema,
  insertSupplierRateSchema,
  type Supplier,
  type InsertSupplier,
  type InsertSupplierRate,
  type TimberSize,
  type SupplierRate,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type SupplierWithRates = Supplier & {
  latestRate?: SupplierRate & { timberSize: TimberSize };
  previousRate?: SupplierRate;
  percentageIncrease?: number;
};

export default function Suppliers() {
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isAddRateOpen, setIsAddRateOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: suppliers, isLoading } = useQuery<SupplierWithRates[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: timberSizes } = useQuery<TimberSize[]>({
    queryKey: ["/api/timber-sizes"],
  });

  const supplierForm = useForm<InsertSupplier>({
    resolver: zodResolver(insertSupplierSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      physicalAddress: "",
      postalAddress: "",
      taxNumber: "",
    },
  });

  const rateForm = useForm<InsertSupplierRate>({
    resolver: zodResolver(insertSupplierRateSchema),
    defaultValues: {
      supplierId: "",
      timberSizeId: "",
      ratePerM3: "",
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: (data: InsertSupplier) => apiRequest("POST", "/api/suppliers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setIsAddSupplierOpen(false);
      supplierForm.reset();
      toast({ title: "Supplier added successfully" });
    },
  });

  const createRateMutation = useMutation({
    mutationFn: (data: InsertSupplierRate) => apiRequest("POST", "/api/supplier-rates", data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-updates"] });
      queryClient.invalidateQueries({ predicate: (query) => 
        Boolean(query.queryKey[0]?.toString().startsWith("/api/dashboard/price-changes"))
      });
      setIsAddRateOpen(false);
      setSelectedSupplierId(null);
      rateForm.reset();
      
      if (response.priceChange && isFinite(response.priceChange.percentage)) {
        const { percentage, previous, new: newRate } = response.priceChange;
        const isIncrease = percentage > 0;
        const absPercentage = Math.abs(percentage);
        
        if (absPercentage >= 10) {
          toast({
            title: isIncrease ? "Significant Price Increase!" : "Significant Price Decrease!",
            description: `Rate ${isIncrease ? 'increased' : 'decreased'} by ${absPercentage.toFixed(1)}% (R${previous.toFixed(2)} → R${newRate.toFixed(2)})`,
            variant: isIncrease ? "destructive" : "default",
          });
        } else if (absPercentage >= 5) {
          toast({
            title: isIncrease ? "Price Increase Detected" : "Price Decrease Detected",
            description: `Rate ${isIncrease ? 'increased' : 'decreased'} by ${absPercentage.toFixed(1)}% (R${previous.toFixed(2)} → R${newRate.toFixed(2)})`,
          });
        } else {
          toast({ 
            title: "Rate added successfully",
            description: `Price change: ${percentage > 0 ? '+' : ''}${percentage.toFixed(1)}%`
          });
        }
      } else {
        toast({ title: "Rate added successfully" });
      }
    },
  });

  const onSubmitSupplier = (data: InsertSupplier) => {
    createSupplierMutation.mutate(data);
  };

  const onSubmitRate = (data: InsertSupplierRate) => {
    createRateMutation.mutate(data);
  };

  const handleAddRate = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    rateForm.setValue("supplierId", supplierId);
    setIsAddRateOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-suppliers-title">
            Suppliers
          </h1>
          <p className="text-muted-foreground">Manage suppliers and their rates</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsAddRateOpen(true)}
            data-testid="button-add-rate"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Rate
          </Button>
          <Dialog open={isAddRateOpen} onOpenChange={setIsAddRateOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Supplier Rate</DialogTitle>
                <DialogDescription>Enter the supplier rate details</DialogDescription>
              </DialogHeader>
              <Form {...rateForm}>
                <form onSubmit={rateForm.handleSubmit(onSubmitRate)} className="space-y-4">
                  <FormField
                    control={rateForm.control}
                    name="supplierId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-supplier">
                              <SelectValue placeholder="Select supplier" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {suppliers?.map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={rateForm.control}
                    name="timberSizeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timber Size</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-timber-size">
                              <SelectValue placeholder="Select timber size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {timberSizes?.map((timber) => (
                              <SelectItem key={timber.id} value={timber.id}>
                                {timber.thickness}x{timber.width} - {timber.classification}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={rateForm.control}
                    name="ratePerM3"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rate per m³ (R)</FormLabel>
                        <FormControl>
                          <Input placeholder="0.00" {...field} data-testid="input-rate-per-m3" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={rateForm.control}
                      name="year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Year</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              data-testid="input-year"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={rateForm.control}
                      name="month"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Month</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="12"
                              {...field}
                              data-testid="input-month"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsAddRateOpen(false);
                        setSelectedSupplierId(null);
                        rateForm.reset();
                      }}
                      data-testid="button-cancel-rate"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createRateMutation.isPending}
                      data-testid="button-submit-rate"
                    >
                      {createRateMutation.isPending ? "Adding..." : "Add Rate"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Button onClick={() => setIsAddSupplierOpen(true)} data-testid="button-add-supplier">
            <Plus className="h-4 w-4 mr-2" />
            Add Supplier
          </Button>
          <Dialog open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Supplier</DialogTitle>
                <DialogDescription>Enter the supplier details</DialogDescription>
              </DialogHeader>
              <Form {...supplierForm}>
                <form onSubmit={supplierForm.handleSubmit(onSubmitSupplier)} className="space-y-4">
                  <FormField
                    control={supplierForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., ABC Timber Supplies"
                            {...field}
                            data-testid="input-supplier-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={supplierForm.control}
                      name="contactPerson"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Person</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., John Smith"
                              {...field}
                              data-testid="input-contact-person"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={supplierForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., +27 11 123 4567"
                              {...field}
                              data-testid="input-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={supplierForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="e.g., info@abctimber.com"
                            {...field}
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={supplierForm.control}
                    name="physicalAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Physical Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., 123 Main Road, Johannesburg"
                            {...field}
                            data-testid="input-physical-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={supplierForm.control}
                    name="postalAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., P.O. Box 1234, Johannesburg, 2000"
                            {...field}
                            data-testid="input-postal-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={supplierForm.control}
                    name="taxNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax/VAT Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., 1234567890"
                            {...field}
                            data-testid="input-tax-number"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsAddSupplierOpen(false);
                        supplierForm.reset();
                      }}
                      data-testid="button-cancel-supplier"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createSupplierMutation.isPending}
                      data-testid="button-submit-supplier"
                    >
                      {createSupplierMutation.isPending ? "Adding..." : "Add Supplier"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : suppliers && suppliers.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((supplier) => (
            <Card key={supplier.id} data-testid={`card-supplier-${supplier.id}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{supplier.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {supplier.latestRate ? (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Latest Rate</p>
                      <p className="text-lg font-mono font-semibold">
                        R{parseFloat(supplier.latestRate.ratePerM).toFixed(2)}/m
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {supplier.latestRate.timberSize.thickness}x
                        {supplier.latestRate.timberSize.width} -{" "}
                        {new Date(
                          supplier.latestRate.year,
                          supplier.latestRate.month - 1
                        ).toLocaleDateString("en-ZA", {
                          year: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                    {supplier.percentageIncrease !== undefined && (
                      <div className="flex items-center gap-2 text-sm">
                        {supplier.percentageIncrease > 0 ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-chart-4" />
                            <span className="text-chart-4">
                              +{supplier.percentageIncrease.toFixed(1)}%
                            </span>
                          </>
                        ) : supplier.percentageIncrease < 0 ? (
                          <>
                            <TrendingDown className="h-4 w-4 text-chart-1" />
                            <span className="text-chart-1">
                              {supplier.percentageIncrease.toFixed(1)}%
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">No change</span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No rates added yet</p>
                )}
                <div className="flex gap-2">
                  <Link href={`/suppliers/${supplier.id}`} className="flex-1">
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full"
                      data-testid={`button-view-detail-${supplier.id}`}
                    >
                      <Eye className="h-3 w-3 mr-2" />
                      View Details
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddRate(supplier.id)}
                    data-testid={`button-add-rate-${supplier.id}`}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No suppliers added yet</p>
            <Button onClick={() => setIsAddSupplierOpen(true)} data-testid="button-add-first-supplier">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Supplier
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
