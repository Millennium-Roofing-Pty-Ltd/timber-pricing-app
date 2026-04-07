import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
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

export default function StockNewPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Load all lookup data
  const { data: relations } = useQuery<any[]>({
    queryKey: ['/api/stock/lookups/relations'],
  });

  const { data: behaviours } = useQuery<any[]>({
    queryKey: ['/api/stock/lookups/behaviours'],
  });

  const { data: types } = useQuery<any[]>({
    queryKey: ['/api/stock/lookups/types'],
  });

  const { data: uoms } = useQuery<any[]>({
    queryKey: ['/api/stock/lookups/uoms'],
  });

  const { data: suppliers } = useQuery<any[]>({
    queryKey: ['/api/suppliers'],
  });

  const { data: markupGroups } = useQuery<any[]>({
    queryKey: ['/api/stock/lookups/markup-groups'],
  });

  const { data: discountGroups } = useQuery<any[]>({
    queryKey: ['/api/stock/lookups/discount-groups'],
  });

  const { data: marginGroups } = useQuery<any[]>({
    queryKey: ['/api/stock/lookups/margin-groups'],
  });

  // Form setup
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

  // Detect if the selected type is Composite
  const selectedTypeId = form.watch('typeId');
  const selectedType = types?.find(t => t.id === selectedTypeId);
  const typeName = selectedType?.name?.toLowerCase() || '';
  const typeDesc = selectedType?.description?.toLowerCase() || '';
  const isCompositeType = typeName.includes('composite') || typeDesc.includes('composite');

  // Auto-set Primary Supplier to empty (None) for composite items
  React.useEffect(() => {
    if (isCompositeType) {
      const currentPrimarySupplierId = form.getValues('primarySupplierId');
      if (currentPrimarySupplierId !== null) {
        form.setValue('primarySupplierId', null);
      }
    }
  }, [isCompositeType, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertStock) => {
      return apiRequest('POST', '/api/stock', data);
    },
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: ['/api/stock'] });
      toast({
        title: 'Success',
        description: 'Stock item created successfully',
      });
      // Navigate to the detail page of the newly created item
      setLocation(`/stock/${newItem.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: InsertStock) => {
    // Clean up the data: remove empty strings for numeric and optional fields
    const cleanedData: any = { ...data };
    
    // Remove empty strings for numeric fields (convert to undefined)
    if (cleanedData.supplierCost === '') delete cleanedData.supplierCost;
    if (cleanedData.averageCost === '') delete cleanedData.averageCost;
    if (cleanedData.lastCost === '') delete cleanedData.lastCost;
    if (cleanedData.highestCost === '') delete cleanedData.highestCost;
    
    // Remove empty strings for text fields (convert to undefined)
    if (cleanedData.partcode === '') delete cleanedData.partcode;
    if (cleanedData.itemHierarchy === '') delete cleanedData.itemHierarchy;
    if (cleanedData.description === '') delete cleanedData.description;
    if (cleanedData.notes === '') delete cleanedData.notes;
    
    // Remove empty strings for select fields (convert to undefined/null)
    if (cleanedData.relationId === '') cleanedData.relationId = null;
    if (cleanedData.behaviourId === '') cleanedData.behaviourId = null;
    if (cleanedData.typeId === '') cleanedData.typeId = null;
    if (cleanedData.stockUnitId === '') cleanedData.stockUnitId = null;
    if (cleanedData.purchaseUnitId === '') cleanedData.purchaseUnitId = null;
    if (cleanedData.salesUnitId === '') cleanedData.salesUnitId = null;
    if (cleanedData.primarySupplierId === '') cleanedData.primarySupplierId = null;
    if (cleanedData.markupGroupId === '') cleanedData.markupGroupId = null;
    if (cleanedData.discountGroupId === '') cleanedData.discountGroupId = null;
    if (cleanedData.marginGroupId === '') cleanedData.marginGroupId = null;
    
    createMutation.mutate(cleanedData as InsertStock);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation('/stock')}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Stock
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-semibold">Create New Stock Item</h1>
        <p className="text-muted-foreground mt-1">
          Add a new item to the stock inventory
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    <FormLabel data-testid="label-product-code">Product Code *</FormLabel>
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
                  Cost fields are disabled for composite items. Costs will be calculated from component items after creation.
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

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation('/stock')}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              data-testid="button-save"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Stock Item'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
