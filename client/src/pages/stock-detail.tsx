import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2, Edit } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { insertStockSchema, type InsertStock } from '@shared/schema';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface StockItemDetail {
  id: string;
  productCode: string;
  partcode: string | null;
  itemHierarchy: string | null;
  description: string | null;
  notes: string | null;
  supplierCost: string | null;
  averageCost: string | null;
  lastCost: string | null;
  highestCost: string | null;
  maxQuantity: number | null;
  qtyOnHand: number | null;
  status: boolean | null;
  relationId: string | null;
  behaviourId: string | null;
  typeId: string | null;
  stockUnitId: string | null;
  purchaseUnitId: string | null;
  salesUnitId: string | null;
  primarySupplierId: string | null;
  markupGroupId: string | null;
  discountGroupId: string | null;
  marginGroupId: string | null;
  relation: { id: string; name: string } | null;
  behaviour: { id: string; name: string } | null;
  type: { id: string; name: string } | null;
  stockUnit: { id: string; name: string } | null;
  purchaseUnit: { id: string; name: string } | null;
  salesUnit: { id: string; name: string } | null;
  primarySupplier: { id: string; name: string } | null;
  markupGroup: { id: string; name: string } | null;
  discountGroup: { id: string; name: string } | null;
  marginGroup: { id: string; name: string } | null;
  properties: any[];
  colours: any[];
  variants: any[];
  compositeItems: any[];
  tallyItems: any[];
}

interface LookupItem {
  id: string;
  name: string;
  description?: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

export default function StockDetailPage() {
  const [, params] = useRoute('/stock/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const stockId = params?.id;

  const { data: stockItem, isLoading } = useQuery<StockItemDetail>({
    queryKey: ['/api/stock', stockId],
    enabled: !!stockId,
  });

  const { data: relations } = useQuery<LookupItem[]>({
    queryKey: ['/api/stock/lookups/relations'],
  });

  const { data: behaviours } = useQuery<LookupItem[]>({
    queryKey: ['/api/stock/lookups/behaviours'],
  });

  const { data: types } = useQuery<LookupItem[]>({
    queryKey: ['/api/stock/lookups/types'],
  });

  const { data: uoms } = useQuery<LookupItem[]>({
    queryKey: ['/api/stock/lookups/uoms'],
  });

  const { data: markupGroups } = useQuery<LookupItem[]>({
    queryKey: ['/api/stock/lookups/markup-groups'],
  });

  const { data: discountGroups } = useQuery<LookupItem[]>({
    queryKey: ['/api/stock/lookups/discount-groups'],
  });

  const { data: marginGroups } = useQuery<LookupItem[]>({
    queryKey: ['/api/stock/lookups/margin-groups'],
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
  });

  // Lookup data for grids
  const { data: propertyDefinitions } = useQuery<LookupItem[]>({
    queryKey: ['/api/stock/lookups/property-definitions'],
  });

  const { data: colours } = useQuery<LookupItem[]>({
    queryKey: ['/api/stock/lookups/colours'],
  });

  const { data: variants } = useQuery<LookupItem[]>({
    queryKey: ['/api/stock/lookups/variants'],
  });

  // Junction data for current stock item
  const { data: stockProperties } = useQuery<any[]>({
    queryKey: ['/api/stock', stockId, 'properties'],
    queryFn: async () => {
      const response = await fetch(`/api/stock/${stockId}/properties`);
      if (!response.ok) throw new Error('Failed to fetch stock properties');
      return response.json();
    },
    enabled: !!stockId,
  });

  const { data: stockColours } = useQuery<any[]>({
    queryKey: ['/api/stock', stockId, 'colours'],
    queryFn: async () => {
      const response = await fetch(`/api/stock/${stockId}/colours`);
      if (!response.ok) throw new Error('Failed to fetch stock colours');
      return response.json();
    },
    enabled: !!stockId,
  });

  const { data: stockVariants } = useQuery<any[]>({
    queryKey: ['/api/stock', stockId, 'variants'],
    queryFn: async () => {
      const response = await fetch(`/api/stock/${stockId}/variants`);
      if (!response.ok) throw new Error('Failed to fetch stock variants');
      return response.json();
    },
    enabled: !!stockId,
  });

  const form = useForm<InsertStock>({
    resolver: zodResolver(insertStockSchema),
    defaultValues: {
      productCode: '',
      partcode: '',
      itemHierarchy: '',
      description: '',
      notes: '',
      supplierCost: '',
      averageCost: '',
      lastCost: '',
      highestCost: '',
      maxQuantity: null,
      qtyOnHand: null,
      relationId: null,
      behaviourId: null,
      typeId: null,
      stockUnitId: null,
      purchaseUnitId: null,
      salesUnitId: null,
      primarySupplierId: null,
      markupGroupId: null,
      discountGroupId: null,
      marginGroupId: null,
      status: true,
    },
  });

  // Update form when stock item loads (using useEffect to prevent resets during user edits)
  React.useEffect(() => {
    if (stockItem && !form.formState.isDirty) {
      form.reset({
        productCode: stockItem.productCode,
        partcode: stockItem.partcode || '',
        itemHierarchy: stockItem.itemHierarchy || '',
        description: stockItem.description || '',
        notes: stockItem.notes || '',
        supplierCost: stockItem.supplierCost || '',
        averageCost: stockItem.averageCost || '',
        lastCost: stockItem.lastCost || '',
        highestCost: stockItem.highestCost || '',
        maxQuantity: stockItem.maxQuantity,
        qtyOnHand: stockItem.qtyOnHand,
        relationId: stockItem.relationId,
        behaviourId: stockItem.behaviourId,
        typeId: stockItem.typeId,
        stockUnitId: stockItem.stockUnitId,
        purchaseUnitId: stockItem.purchaseUnitId,
        salesUnitId: stockItem.salesUnitId,
        primarySupplierId: stockItem.primarySupplierId,
        markupGroupId: stockItem.markupGroupId,
        discountGroupId: stockItem.discountGroupId,
        marginGroupId: stockItem.marginGroupId,
        status: stockItem.status ?? true,
      });
    }
  }, [stockItem, form]);

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const updateMutation = useMutation({
    mutationFn: async (data: InsertStock) => {
      return apiRequest('PUT', `/api/stock/${stockId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stock'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId] });
      toast({
        title: 'Success',
        description: 'Stock item updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/stock/${stockId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stock'] });
      toast({
        title: 'Success',
        description: 'Stock item deleted successfully',
      });
      setLocation('/stock');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
    setDeleteDialogOpen(false);
  };

  const handleBack = async () => {
    // Auto-save on back if form has changes
    if (form.formState.isDirty) {
      try {
        const formData = form.getValues();
        
        // Clean up the data (same logic as onSubmit)
        const cleanData: any = { ...formData };
        
        // Remove empty strings for numeric fields
        if (cleanData.supplierCost === '') delete cleanData.supplierCost;
        if (cleanData.averageCost === '') delete cleanData.averageCost;
        if (cleanData.lastCost === '') delete cleanData.lastCost;
        if (cleanData.highestCost === '') delete cleanData.highestCost;
        
        // Remove empty strings for text fields
        if (cleanData.partcode === '') delete cleanData.partcode;
        if (cleanData.itemHierarchy === '') delete cleanData.itemHierarchy;
        if (cleanData.description === '') delete cleanData.description;
        if (cleanData.notes === '') delete cleanData.notes;
        
        // Remove empty strings for select fields
        if (cleanData.relationId === '') cleanData.relationId = null;
        if (cleanData.behaviourId === '') cleanData.behaviourId = null;
        if (cleanData.typeId === '') cleanData.typeId = null;
        if (cleanData.stockUnitId === '') cleanData.stockUnitId = null;
        if (cleanData.purchaseUnitId === '') cleanData.purchaseUnitId = null;
        if (cleanData.salesUnitId === '') cleanData.salesUnitId = null;
        if (cleanData.primarySupplierId === '') cleanData.primarySupplierId = null;
        if (cleanData.markupGroupId === '') cleanData.markupGroupId = null;
        if (cleanData.discountGroupId === '') cleanData.discountGroupId = null;
        if (cleanData.marginGroupId === '') cleanData.marginGroupId = null;
        
        // Save the changes and wait for completion
        await updateMutation.mutateAsync(cleanData);
        
        // Navigate back to list after successful save
        setLocation('/stock');
      } catch (error) {
        // Error is already handled by mutation's onError with toast
        // Just stay on the page
      }
    } else {
      setLocation('/stock');
    }
  };

  // Property mutations
  const [propertyDialog, setPropertyDialog] = React.useState(false);
  const [editingProperty, setEditingProperty] = React.useState<any>(null);
  const [propertyForm, setPropertyForm] = React.useState({ propertyDefinitionId: '', value: '', unit: '' });

  // Reset property form when dialog closes
  React.useEffect(() => {
    if (!propertyDialog) {
      setEditingProperty(null);
      setPropertyForm({ propertyDefinitionId: '', value: '', unit: '' });
    }
  }, [propertyDialog]);

  const addPropertyMutation = useMutation({
    mutationFn: async (data: { propertyDefinitionId: string; value: string; unit: string }) => {
      return apiRequest('POST', `/api/stock/${stockId}/properties`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId, 'properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId] });
      setPropertyDialog(false);
      setPropertyForm({ propertyDefinitionId: '', value: '', unit: '' });
      setEditingProperty(null);
      toast({ title: 'Success', description: 'Property added successfully' });
    },
  });

  const updatePropertyMutation = useMutation({
    mutationFn: async (data: { id: string; value: string; unit: string }) => {
      return apiRequest('PUT', `/api/stock/properties/${data.id}`, { value: data.value, unit: data.unit });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId, 'properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId] });
      setEditingProperty(null);
      setPropertyDialog(false);
      setPropertyForm({ propertyDefinitionId: '', value: '', unit: '' });
      toast({ title: 'Success', description: 'Property updated successfully' });
    },
  });

  const deletePropertyMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      return apiRequest('DELETE', `/api/stock/properties/${propertyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId, 'properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId] });
      toast({ title: 'Success', description: 'Property removed successfully' });
    },
  });

  // Colour mutations
  const [colourDialog, setColourDialog] = React.useState(false);
  const [selectedColourId, setSelectedColourId] = React.useState('');

  const addColourMutation = useMutation({
    mutationFn: async (colourId: string) => {
      if (!colourId) throw new Error('Please select a colour');
      return apiRequest('POST', `/api/stock/${stockId}/colours`, { colourId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId, 'colours'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId] });
      setColourDialog(false);
      setSelectedColourId('');
      toast({ title: 'Success', description: 'Colour added successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteColourMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return apiRequest('DELETE', `/api/stock/colours/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId, 'colours'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId] });
      toast({ title: 'Success', description: 'Colour removed successfully' });
    },
  });

  // Variant mutations
  const [variantDialog, setVariantDialog] = React.useState(false);
  const [selectedVariantId, setSelectedVariantId] = React.useState('');

  const addVariantMutation = useMutation({
    mutationFn: async (variantId: string) => {
      if (!variantId) throw new Error('Please select a variant');
      return apiRequest('POST', `/api/stock/${stockId}/variants`, { variantId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId, 'variants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId] });
      setVariantDialog(false);
      setSelectedVariantId('');
      toast({ title: 'Success', description: 'Variant added successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return apiRequest('DELETE', `/api/stock/variants/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId, 'variants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId] });
      toast({ title: 'Success', description: 'Variant removed successfully' });
    },
  });

  // Composite items state and mutations
  const [compositeDialog, setCompositeDialog] = React.useState(false);
  const [compositeForm, setCompositeForm] = React.useState({ componentStockId: '', quantity: '', unitId: '' });

  // Get available stock items for composite components
  const { data: allStockItems } = useQuery<any[]>({
    queryKey: ['/api/stock'],
  });

  // Get composite items for this stock item
  const { data: compositeItems } = useQuery<any[]>({
    queryKey: ['/api/stock', stockId, 'composite-items'],
    queryFn: async () => {
      const response = await fetch(`/api/stock/${stockId}/composite-items`);
      if (!response.ok) throw new Error('Failed to fetch composite items');
      return response.json();
    },
    enabled: !!stockId,
  });

  // Get total cost for composite item
  const { data: compositeCost } = useQuery<{ totalCost: string }>({
    queryKey: ['/api/stock', stockId, 'composite-cost'],
    queryFn: async () => {
      const response = await fetch(`/api/stock/${stockId}/composite-cost`);
      if (!response.ok) throw new Error('Failed to fetch composite cost');
      return response.json();
    },
    enabled: !!stockId,
  });

  const addCompositeItemMutation = useMutation({
    mutationFn: async (data: { componentStockId: string; quantity: string; unitId: string }) => {
      if (!data.componentStockId) throw new Error('Please select a component item');
      if (!data.quantity) throw new Error('Please enter a quantity');
      return apiRequest('POST', `/api/stock/${stockId}/composite-items`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId, 'composite-items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId, 'composite-cost'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock/lookups/uoms'] });
      setCompositeDialog(false);
      setCompositeForm({ componentStockId: '', quantity: '', unitId: '' });
      toast({ title: 'Success', description: 'Component item added successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCompositeItemMutation = useMutation({
    mutationFn: async (compositeItemId: string) => {
      return apiRequest('DELETE', `/api/stock/composite-items/${compositeItemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId, 'composite-items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId, 'composite-cost'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock', stockId] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock/lookups/uoms'] });
      toast({ title: 'Success', description: 'Component item removed successfully' });
    },
  });

  // Detect if the current type is Composite
  const selectedTypeId = form.watch('typeId');
  const selectedType = types?.find(t => t.id === selectedTypeId);
  const typeName = selectedType?.name?.toLowerCase() || '';
  const typeDesc = selectedType?.description?.toLowerCase() || '';
  const isCompositeType = typeName.includes('composite') || typeDesc.includes('composite');

  // Auto-update Supplier Cost from Composite Total Cost for composite items
  React.useEffect(() => {
    if (isCompositeType && compositeCost && compositeCost.totalCost) {
      const currentSupplierCost = form.getValues('supplierCost');
      // Only update if different (avoid infinite loops)
      if (currentSupplierCost !== compositeCost.totalCost) {
        form.setValue('supplierCost', compositeCost.totalCost, { shouldDirty: true });
      }
    }
  }, [isCompositeType, compositeCost, form]);

  // Auto-set Primary Supplier to empty (None) for composite items
  React.useEffect(() => {
    if (isCompositeType) {
      const currentPrimarySupplierId = form.getValues('primarySupplierId');
      if (currentPrimarySupplierId !== null) {
        form.setValue('primarySupplierId', null, { shouldDirty: true });
      }
    }
  }, [isCompositeType, form]);

  const onSubmit = (data: InsertStock) => {
    // Clean up the data: remove empty strings for numeric and optional fields
    const cleanData: any = { ...data };
    
    // Remove empty strings for numeric fields (convert to undefined)
    if (cleanData.supplierCost === '') delete cleanData.supplierCost;
    if (cleanData.averageCost === '') delete cleanData.averageCost;
    if (cleanData.lastCost === '') delete cleanData.lastCost;
    if (cleanData.highestCost === '') delete cleanData.highestCost;
    
    // Remove empty strings for text fields (convert to undefined)
    if (cleanData.partcode === '') delete cleanData.partcode;
    if (cleanData.itemHierarchy === '') delete cleanData.itemHierarchy;
    if (cleanData.description === '') delete cleanData.description;
    if (cleanData.notes === '') delete cleanData.notes;
    
    // Remove empty strings for select fields (convert to undefined/null)
    if (cleanData.relationId === '') cleanData.relationId = null;
    if (cleanData.behaviourId === '') cleanData.behaviourId = null;
    if (cleanData.typeId === '') cleanData.typeId = null;
    if (cleanData.stockUnitId === '') cleanData.stockUnitId = null;
    if (cleanData.purchaseUnitId === '') cleanData.purchaseUnitId = null;
    if (cleanData.salesUnitId === '') cleanData.salesUnitId = null;
    if (cleanData.primarySupplierId === '') cleanData.primarySupplierId = null;
    if (cleanData.markupGroupId === '') cleanData.markupGroupId = null;
    if (cleanData.discountGroupId === '') cleanData.discountGroupId = null;
    if (cleanData.marginGroupId === '') cleanData.marginGroupId = null;
    
    updateMutation.mutate(cleanData);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!stockItem) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/stock')} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-semibold">Stock Not Found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold">{stockItem.productCode}</h1>
          <p className="text-muted-foreground mt-1">{stockItem.description || 'No description'}</p>
        </div>
        <div className="flex items-center gap-2">
          {form.watch('status') ? (
            <Badge variant="default" className="bg-green-600" data-testid="badge-status">
              Active
            </Badge>
          ) : (
            <Badge variant="secondary" data-testid="badge-status">
              Inactive
            </Badge>
          )}
          
          <Button 
            variant="destructive" 
            onClick={() => setDeleteDialogOpen(true)}
            data-testid="button-delete"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form id="stock-edit-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Section 1: Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>1. Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="productCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-product-code">Product Code</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-product-code" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="partcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-part-code">Part Code</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} data-testid="input-part-code" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel data-testid="label-description">Description</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="itemHierarchy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-item-hierarchy">Item Hierarchy</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} data-testid="input-item-hierarchy" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="relationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-relation">Relation</FormLabel>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-relation">
                          <SelectValue placeholder="Select relation" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {relations?.map((item) => (
                          <SelectItem key={item.id} value={item.id} data-testid={`option-relation-${item.id}`}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="behaviourId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-behaviour">Behaviour</FormLabel>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-behaviour">
                          <SelectValue placeholder="Select behaviour" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {behaviours?.map((item) => (
                          <SelectItem key={item.id} value={item.id} data-testid={`option-behaviour-${item.id}`}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="typeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-type">Type</FormLabel>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {types?.map((item) => (
                          <SelectItem key={item.id} value={item.id} data-testid={`option-type-${item.id}`}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel data-testid="label-notes">Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ''} data-testid="input-notes" className="resize-none" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-4">
                    <FormLabel data-testid="label-status">Active</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value ?? true}
                        onCheckedChange={field.onChange}
                        data-testid="switch-status"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 2: Costing */}
          <Card>
            <CardHeader>
              <CardTitle>2. Costing (ZAR)</CardTitle>
              {isCompositeType && (
                <p className="text-sm text-muted-foreground mt-1">
                  Cost fields are read-only for composite items. Supplier Cost is auto-calculated from component costs.
                </p>
              )}
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="supplierCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-supplier-cost">Supplier Cost (Total Cost)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value ?? ''} 
                        type="text" 
                        disabled={isCompositeType}
                        className={isCompositeType ? 'bg-muted cursor-not-allowed' : ''}
                        data-testid="input-supplier-cost" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="averageCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-average-cost">Average Cost (Read Only)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value ?? ''} 
                        type="text" 
                        disabled
                        className="bg-muted cursor-not-allowed"
                        data-testid="input-average-cost" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-last-cost">Last Cost (Read Only)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value ?? ''} 
                        type="text" 
                        disabled
                        className="bg-muted cursor-not-allowed"
                        data-testid="input-last-cost" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="highestCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-highest-cost">Highest Cost (Read Only)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value ?? ''} 
                        type="text" 
                        disabled
                        className="bg-muted cursor-not-allowed"
                        data-testid="input-highest-cost" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 3: Stocking */}
          <Card>
            <CardHeader>
              <CardTitle>3. Stocking</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="maxQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-max-quantity">Max Quantity (Read Only)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        value={field.value ?? ''} 
                        disabled
                        className="bg-muted cursor-not-allowed"
                        data-testid="input-max-quantity" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="qtyOnHand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-qty-on-hand">Quantity on Hand (Read Only)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        value={field.value ?? ''} 
                        disabled
                        className="bg-muted cursor-not-allowed"
                        data-testid="input-qty-on-hand" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 4: Units */}
          <Card>
            <CardHeader>
              <CardTitle>4. Units</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="stockUnitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-stock-unit">Stock Unit</FormLabel>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-stock-unit">
                          <SelectValue placeholder="Select stock unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {uoms?.map((item) => (
                          <SelectItem key={item.id} value={item.id} data-testid={`option-stock-unit-${item.id}`}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchaseUnitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-purchase-unit">Purchase Unit</FormLabel>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-purchase-unit">
                          <SelectValue placeholder="Select purchase unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {uoms?.map((item) => (
                          <SelectItem key={item.id} value={item.id} data-testid={`option-purchase-unit-${item.id}`}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="salesUnitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-sales-unit">Sales Unit</FormLabel>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-sales-unit">
                          <SelectValue placeholder="Select sales unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {uoms?.map((item) => (
                          <SelectItem key={item.id} value={item.id} data-testid={`option-sales-unit-${item.id}`}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 5: Procurement */}
          <Card>
            <CardHeader>
              <CardTitle>5. Procurement</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="primarySupplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-primary-supplier">Primary Supplier</FormLabel>
                    {isCompositeType ? (
                      <FormControl>
                        <Input 
                          value="None" 
                          disabled 
                          className="bg-muted cursor-not-allowed"
                          data-testid="input-manufacturer-readonly"
                        />
                      </FormControl>
                    ) : (
                      <Select
                        value={field.value ?? ''}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-manufacturer">
                            <SelectValue placeholder="Select manufacturer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers?.map((item) => (
                            <SelectItem key={item.id} value={item.id} data-testid={`option-manufacturer-${item.id}`}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 6: Pricing Groups */}
          <Card>
            <CardHeader>
              <CardTitle>6. Pricing Groups</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="markupGroupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-markup-group">Markup Group</FormLabel>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-markup-group">
                          <SelectValue placeholder="Select markup group" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {markupGroups?.map((item) => (
                          <SelectItem key={item.id} value={item.id} data-testid={`option-markup-group-${item.id}`}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discountGroupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-discount-group">Discount Group</FormLabel>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-discount-group">
                          <SelectValue placeholder="Select discount group" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {discountGroups?.map((item) => (
                          <SelectItem key={item.id} value={item.id} data-testid={`option-discount-group-${item.id}`}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="marginGroupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel data-testid="label-margin-group">Margin Group</FormLabel>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-margin-group">
                          <SelectValue placeholder="Select margin group" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {marginGroups?.map((item) => (
                          <SelectItem key={item.id} value={item.id} data-testid={`option-margin-group-${item.id}`}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 7: Properties Grid */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <CardTitle>7. Properties</CardTitle>
              <Dialog open={propertyDialog} onOpenChange={setPropertyDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => {
                    setEditingProperty(null);
                    setPropertyForm({ propertyDefinitionId: '', value: '', unit: '' });
                  }} data-testid="button-add-property">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Property
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-property">
                  <DialogHeader>
                    <DialogTitle>{editingProperty ? 'Edit Property' : 'Add Property'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {!editingProperty && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Property</label>
                        <Select
                          value={propertyForm.propertyDefinitionId}
                          onValueChange={(value) => setPropertyForm({ ...propertyForm, propertyDefinitionId: value })}
                        >
                          <SelectTrigger data-testid="select-property-definition">
                            <SelectValue placeholder="Select property" />
                          </SelectTrigger>
                          <SelectContent>
                            {propertyDefinitions?.map((prop) => (
                              <SelectItem key={prop.id} value={prop.id} data-testid={`option-property-${prop.id}`}>
                                {prop.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Value</label>
                      <Input
                        value={propertyForm.value}
                        onChange={(e) => setPropertyForm({ ...propertyForm, value: e.target.value })}
                        placeholder="Enter value"
                        data-testid="input-property-value"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Unit</label>
                      <Input
                        value={propertyForm.unit}
                        onChange={(e) => setPropertyForm({ ...propertyForm, unit: e.target.value })}
                        placeholder="e.g., meters, kg, etc."
                        data-testid="input-property-unit"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        if (editingProperty) {
                          updatePropertyMutation.mutate({
                            id: editingProperty.id,
                            value: propertyForm.value,
                            unit: propertyForm.unit,
                          });
                        } else {
                          addPropertyMutation.mutate(propertyForm);
                        }
                      }}
                      disabled={!propertyForm.propertyDefinitionId && !editingProperty}
                      data-testid="button-save-property"
                    >
                      {editingProperty ? 'Update' : 'Add'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {stockProperties && stockProperties.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockProperties.map((prop) => {
                      const propDef = propertyDefinitions?.find(p => p.id === prop.propertyDefinitionId);
                      return (
                        <TableRow key={prop.id} data-testid={`row-property-${prop.id}`}>
                          <TableCell>{propDef?.name || 'Unknown'}</TableCell>
                          <TableCell>{prop.value || '-'}</TableCell>
                          <TableCell>{prop.unit || '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditingProperty(prop);
                                  setPropertyForm({
                                    propertyDefinitionId: prop.propertyDefinitionId,
                                    value: prop.value || '',
                                    unit: prop.unit || '',
                                  });
                                  setPropertyDialog(true);
                                }}
                                data-testid={`button-edit-property-${prop.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deletePropertyMutation.mutate(prop.id)}
                                data-testid={`button-delete-property-${prop.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-no-properties">No properties added yet</p>
              )}
            </CardContent>
          </Card>

          {/* Section 8: Colours Grid */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <CardTitle>8. Colours</CardTitle>
              <Dialog open={colourDialog} onOpenChange={setColourDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => setSelectedColourId('')} data-testid="button-add-colour">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Colour
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-colour">
                  <DialogHeader>
                    <DialogTitle>Add Colour</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Colour</label>
                      <Select
                        value={selectedColourId}
                        onValueChange={setSelectedColourId}
                      >
                        <SelectTrigger data-testid="select-colour">
                          <SelectValue placeholder="Select colour" />
                        </SelectTrigger>
                        <SelectContent>
                          {colours?.filter(c => !stockColours?.some(sc => sc.colourId === c.id)).map((colour) => (
                            <SelectItem key={colour.id} value={colour.id} data-testid={`option-colour-${colour.id}`}>
                              {colour.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => addColourMutation.mutate(selectedColourId)}
                      disabled={!selectedColourId}
                      data-testid="button-save-colour"
                    >
                      Add
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {stockColours && stockColours.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {stockColours.map((colourLink) => {
                    return (
                      <Badge key={colourLink.id} variant="secondary" className="flex items-center gap-2" data-testid={`badge-colour-${colourLink.id}`}>
                        {colourLink.colourName || 'Unknown'}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-4 w-4 p-0 hover:bg-transparent"
                          onClick={() => deleteColourMutation.mutate(colourLink.id)}
                          data-testid={`button-delete-colour-${colourLink.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-no-colours">No colours added yet</p>
              )}
            </CardContent>
          </Card>

          {/* Section 9: Variants Grid */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <CardTitle>9. Variants</CardTitle>
              <Dialog open={variantDialog} onOpenChange={setVariantDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => setSelectedVariantId('')} data-testid="button-add-variant">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Variant
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-variant">
                  <DialogHeader>
                    <DialogTitle>Add Variant</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Variant</label>
                      <Select
                        value={selectedVariantId}
                        onValueChange={setSelectedVariantId}
                      >
                        <SelectTrigger data-testid="select-variant">
                          <SelectValue placeholder="Select variant" />
                        </SelectTrigger>
                        <SelectContent>
                          {variants?.filter(v => !stockVariants?.some(sv => sv.variantId === v.id)).map((variant) => (
                            <SelectItem key={variant.id} value={variant.id} data-testid={`option-variant-${variant.id}`}>
                              {variant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => addVariantMutation.mutate(selectedVariantId)}
                      disabled={!selectedVariantId}
                      data-testid="button-save-variant"
                    >
                      Add
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {stockVariants && stockVariants.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {stockVariants.map((variantLink) => {
                    const variant = variants?.find(v => v.id === variantLink.variantId);
                    return (
                      <Badge key={variantLink.id} variant="secondary" className="flex items-center gap-2" data-testid={`badge-variant-${variantLink.id}`}>
                        {variant?.name || 'Unknown'}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-4 w-4 p-0 hover:bg-transparent"
                          onClick={() => deleteVariantMutation.mutate(variantLink.id)}
                          data-testid={`button-delete-variant-${variantLink.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-no-variants">No variants added yet</p>
              )}
            </CardContent>
          </Card>

          {/* Section 10: Composite Stock Grid (Conditional - only when Type = 'Composite') */}
          {(() => {
            const selectedTypeId = form.watch('typeId');
            const selectedType = types?.find(t => t.id === selectedTypeId);
            const typeName = selectedType?.name?.toLowerCase() || '';
            const typeDesc = selectedType?.description?.toLowerCase() || '';
            const isCompositeType = typeName.includes('composite') || typeDesc.includes('composite');
            return isCompositeType ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle>10. Composite Items</CardTitle>
                    {compositeCost && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Total Cost: <span className="font-mono font-semibold">R {compositeCost.totalCost}</span> (auto-calculated)
                      </p>
                    )}
                  </div>
                  <Dialog open={compositeDialog} onOpenChange={setCompositeDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={() => setCompositeForm({ componentStockId: '', quantity: '', unitId: '' })} data-testid="button-add-composite-item">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Component
                      </Button>
                    </DialogTrigger>
                    <DialogContent data-testid="dialog-composite-item">
                      <DialogHeader>
                        <DialogTitle>Add Component Item</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Component Stock Item</label>
                          <Select
                            value={compositeForm.componentStockId}
                            onValueChange={(value) => setCompositeForm({ ...compositeForm, componentStockId: value })}
                          >
                            <SelectTrigger data-testid="select-component-stock">
                              <SelectValue placeholder="Select stock item" />
                            </SelectTrigger>
                            <SelectContent>
                              {allStockItems?.filter(item => item.id !== stockId).map((item) => (
                                <SelectItem key={item.id} value={item.id} data-testid={`option-component-${item.id}`}>
                                  {item.productCode} - {item.description}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Quantity</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={compositeForm.quantity}
                            onChange={(e) => setCompositeForm({ ...compositeForm, quantity: e.target.value })}
                            placeholder="Enter quantity"
                            data-testid="input-composite-quantity"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Unit (Optional)</label>
                          <Select
                            value={compositeForm.unitId}
                            onValueChange={(value) => setCompositeForm({ ...compositeForm, unitId: value })}
                          >
                            <SelectTrigger data-testid="select-composite-unit">
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                            <SelectContent>
                              {uoms?.map((uom) => (
                                <SelectItem key={uom.id} value={uom.id} data-testid={`option-unit-${uom.id}`}>
                                  {uom.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={() => addCompositeItemMutation.mutate(compositeForm)}
                          disabled={!compositeForm.componentStockId || !compositeForm.quantity}
                          data-testid="button-save-composite-item"
                        >
                          Add Component
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {compositeItems && compositeItems.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Component Item</TableHead>
                          <TableHead>Product Code</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead className="text-right">Cost Each</TableHead>
                          <TableHead className="text-right">Total Cost</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {compositeItems.map((item) => {
                          const cost = parseFloat(item.componentStock?.supplierCost || item.componentStock?.averageCost || item.componentStock?.lastCost || '0');
                          const quantity = parseFloat(item.quantity || '0');
                          const totalCost = cost * quantity;
                          return (
                            <TableRow key={item.id} data-testid={`row-composite-item-${item.id}`}>
                              <TableCell>{item.componentStock?.description || 'Unknown'}</TableCell>
                              <TableCell className="font-mono text-sm">{item.componentStock?.productCode || '-'}</TableCell>
                              <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                              <TableCell>{item.unit?.name || '-'}</TableCell>
                              <TableCell className="text-right font-mono">R {cost.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-mono font-semibold">R {totalCost.toFixed(2)}</TableCell>
                              <TableCell>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => deleteCompositeItemMutation.mutate(item.id)}
                                  data-testid={`button-delete-composite-item-${item.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground" data-testid="text-no-composite-items">No component items added yet</p>
                  )}
                </CardContent>
              </Card>
            ) : null;
          })()}

          {/* Section 11: Tally Grid (Conditional - only when Behaviour = 'Tally') */}
          {(() => {
            const selectedBehaviourId = form.watch('behaviourId');
            const selectedBehaviour = behaviours?.find(b => b.id === selectedBehaviourId);
            const behaviourName = selectedBehaviour?.name?.toLowerCase() || '';
            const behaviourDesc = selectedBehaviour?.description?.toLowerCase() || '';
            const isTallyBehaviour = behaviourName.includes('tally') || behaviourDesc.includes('tally');
            return isTallyBehaviour ? (
              <Card>
                <CardHeader>
                  <CardTitle>11. Tally Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Tally grid coming soon...</p>
                </CardContent>
              </Card>
            ) : null;
          })()}
        </form>
      </Form>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-confirmation">
          <DialogHeader>
            <DialogTitle>Delete Stock Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{stockItem?.productCode}</strong>? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleteMutation.isPending}
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
