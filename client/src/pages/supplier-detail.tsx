import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Mail, Phone, MapPin, FileText, Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSupplierSchema, type InsertSupplier, type Supplier } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface StockItem {
  id: string;
  productCode: string;
  description: string;
  supplierCost: string | null;
  purchaseUnitName: string | null;
}

export default function SupplierDetail() {
  const params = useParams();
  const supplierId = params.id;
  const [isEditInfoOpen, setIsEditInfoOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<{ stockId: string; productCode: string; currentCost: string | null } | null>(null);
  const [editCostValue, setEditCostValue] = useState<string>("");
  const { toast } = useToast();

  const { data: supplier, isLoading: isLoadingSupplier } = useQuery<Supplier>({
    queryKey: [`/api/suppliers/${supplierId}/detail`],
    enabled: !!supplierId,
  });

  const { data: stockItems, isLoading: isLoadingStock } = useQuery<StockItem[]>({
    queryKey: [`/api/suppliers/${supplierId}/stock`],
    enabled: !!supplierId,
  });

  const form = useForm<InsertSupplier>({
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

  const updateSupplierMutation = useMutation({
    mutationFn: (data: InsertSupplier) =>
      apiRequest("PUT", `/api/suppliers/${supplierId}`, data),
    onSuccess: async () => {
      toast({ title: "Supplier information updated successfully" });
      await queryClient.invalidateQueries({ queryKey: [`/api/suppliers/${supplierId}/detail`] });
      await queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setIsEditInfoOpen(false);
    },
  });

  const updateCostMutation = useMutation({
    mutationFn: async ({ stockId, newCost }: { stockId: string; newCost: string }) => {
      return apiRequest("PUT", `/api/stock/${stockId}/cost`, {
        newCost,
        changeSource: "supplier_grid",
        supplierId: supplierId,
      });
    },
    onSuccess: async () => {
      toast({ title: "Supplier cost updated successfully" });
      await queryClient.invalidateQueries({ queryKey: [`/api/suppliers/${supplierId}/stock`] });
      setEditingCost(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update cost",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleEditInfo = () => {
    if (!supplier) return;
    
    form.reset({
      name: supplier.name,
      contactPerson: supplier.contactPerson || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      physicalAddress: supplier.physicalAddress || "",
      postalAddress: supplier.postalAddress || "",
      taxNumber: supplier.taxNumber || "",
    });
    setIsEditInfoOpen(true);
  };

  const handleEditCost = (item: StockItem) => {
    setEditingCost({
      stockId: item.id,
      productCode: item.productCode,
      currentCost: item.supplierCost,
    });
    setEditCostValue(item.supplierCost || "");
  };

  const handleSaveCost = () => {
    if (!editingCost) return;
    
    if (!editCostValue || editCostValue.trim() === "") {
      toast({
        title: "Invalid cost",
        description: "Please enter a valid cost",
        variant: "destructive",
      });
      return;
    }

    updateCostMutation.mutate({
      stockId: editingCost.stockId,
      newCost: editCostValue,
    });
  };

  const onSubmitBusinessInfo = (formData: InsertSupplier) => {
    updateSupplierMutation.mutate(formData);
  };

  const isLoading = isLoadingSupplier || isLoadingStock;

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="container mx-auto py-6">
        <p data-testid="text-error">Supplier not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          asChild
          data-testid="button-back"
        >
          <Link href="/suppliers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold" data-testid="text-supplier-name">{supplier.name}</h1>
          <p className="text-muted-foreground">Manufacturer / Supplier Details</p>
        </div>
        <Button
          variant="outline"
          onClick={handleEditInfo}
          data-testid="button-edit-supplier"
        >
          <Pencil className="h-4 w-4 mr-2" />
          Edit Details
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Contact Person</p>
              <p className="text-base" data-testid="text-contact-person">{supplier.contactPerson || "—"}</p>
            </div>
            {supplier.taxNumber && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tax Number</p>
                <p className="text-base" data-testid="text-tax-number">{supplier.taxNumber}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {supplier.email && (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-base" data-testid="text-email">{supplier.email}</p>
                </div>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Phone</p>
                  <p className="text-base" data-testid="text-phone">{supplier.phone}</p>
                </div>
              </div>
            )}
            {supplier.physicalAddress && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Physical Address</p>
                  <p className="text-base whitespace-pre-line" data-testid="text-physical-address">{supplier.physicalAddress}</p>
                </div>
              </div>
            )}
            {supplier.postalAddress && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Postal Address</p>
                  <p className="text-base whitespace-pre-line" data-testid="text-postal-address">{supplier.postalAddress}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock Items</CardTitle>
        </CardHeader>
        <CardContent>
          {!stockItems || stockItems.length === 0 ? (
            <p className="text-muted-foreground" data-testid="text-no-stock">
              No stock items found for this manufacturer.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead data-testid="header-product-code">Product Code</TableHead>
                    <TableHead data-testid="header-description">Description</TableHead>
                    <TableHead data-testid="header-purchase-unit">Purchase Unit</TableHead>
                    <TableHead className="text-right" data-testid="header-supplier-cost">Supplier Cost</TableHead>
                    <TableHead className="text-right" data-testid="header-actions">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockItems.map((item) => (
                    <TableRow key={item.id} data-testid={`row-stock-${item.id}`}>
                      <TableCell className="font-medium" data-testid={`text-product-code-${item.id}`}>
                        {item.productCode}
                      </TableCell>
                      <TableCell data-testid={`text-description-${item.id}`}>
                        {item.description}
                      </TableCell>
                      <TableCell data-testid={`text-purchase-unit-${item.id}`}>
                        {item.purchaseUnitName || "—"}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-supplier-cost-${item.id}`}>
                        {item.supplierCost ? `R ${parseFloat(item.supplierCost).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditCost(item)}
                          data-testid={`button-edit-cost-${item.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditInfoOpen} onOpenChange={setIsEditInfoOpen}>
        <DialogContent data-testid="dialog-edit-supplier">
          <DialogHeader>
            <DialogTitle>Edit Supplier Information</DialogTitle>
            <DialogDescription>
              Update the supplier's business and contact details.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitBusinessInfo)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-supplier-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-contact-person" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="physicalAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Physical Address</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-physical-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postalAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Address</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-postal-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="taxNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Number</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-tax-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditInfoOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateSupplierMutation.isPending}
                  data-testid="button-save-supplier"
                >
                  {updateSupplierMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCost} onOpenChange={(open) => !open && setEditingCost(null)}>
        <DialogContent data-testid="dialog-edit-cost">
          <DialogHeader>
            <DialogTitle>Edit Supplier Cost</DialogTitle>
            <DialogDescription>
              Update the supplier cost for {editingCost?.productCode}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Current Cost</label>
              <p className="text-muted-foreground">
                {editingCost?.currentCost ? `R ${parseFloat(editingCost.currentCost).toFixed(2)}` : "Not set"}
              </p>
            </div>
            <div>
              <label htmlFor="newCost" className="text-sm font-medium">New Cost</label>
              <Input
                id="newCost"
                type="number"
                step="0.01"
                min="0"
                value={editCostValue}
                onChange={(e) => setEditCostValue(e.target.value)}
                placeholder="0.00"
                data-testid="input-new-cost"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingCost(null)}
                data-testid="button-cancel-cost"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveCost}
                disabled={updateCostMutation.isPending}
                data-testid="button-save-cost"
              >
                {updateCostMutation.isPending ? "Saving..." : "Save Cost"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
