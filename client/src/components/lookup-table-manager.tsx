import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface LookupItem {
  id: string;
  name: string;
  description?: string;
  notes?: string;
  factor?: string;
  uom?: string;
  origin?: string;
  createdAt?: string;
}

interface FieldConfig {
  name: string;
  label: string;
  type?: 'text' | 'textarea';
  placeholder?: string;
}

interface LookupTableManagerProps {
  title: string;
  apiEndpoint: string;
  queryKey: string[];
  schema: z.ZodObject<any>;
  description?: string;
  fields?: FieldConfig[];
}

export function LookupTableManager({
  title,
  apiEndpoint,
  queryKey,
  schema,
  description,
  fields = [{ name: 'name', label: 'Name', placeholder: 'Enter name' }],
}: LookupTableManagerProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LookupItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<LookupItem | null>(null);

  const { data: items, isLoading } = useQuery<LookupItem[]>({
    queryKey,
  });

  const getDefaultValues = () => {
    const defaults: Record<string, string> = {};
    fields.forEach(field => {
      defaults[field.name] = '';
    });
    return defaults;
  };

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: getDefaultValues(),
  });

  useEffect(() => {
    if (editingItem) {
      const values: Record<string, string> = {};
      fields.forEach(field => {
        values[field.name] = (editingItem as any)[field.name] || '';
      });
      form.reset(values);
    } else {
      form.reset(getDefaultValues());
    }
  }, [editingItem, form]);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return apiRequest('POST', apiEndpoint, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setIsAddDialogOpen(false);
      form.reset();
      toast({
        title: 'Success',
        description: `${title.slice(0, -1)} created successfully`,
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

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string } & Record<string, any>) => {
      const { id, ...updateData } = data;
      return apiRequest('PUT', `${apiEndpoint}/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingItem(null);
      form.reset();
      toast({
        title: 'Success',
        description: `${title.slice(0, -1)} updated successfully`,
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
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `${apiEndpoint}/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDeletingItem(null);
      toast({
        title: 'Success',
        description: `${title.slice(0, -1)} deleted successfully`,
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

  const onSubmit = (data: Record<string, any>) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleAdd = () => {
    form.reset(getDefaultValues());
    setIsAddDialogOpen(true);
  };

  const handleEdit = (item: LookupItem) => {
    setEditingItem(item);
  };

  const handleDelete = (item: LookupItem) => {
    setDeletingItem(item);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{title}</h1>
          {description && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>
        <Button onClick={handleAdd} data-testid="button-add">
          <Plus className="h-4 w-4 mr-2" />
          Add New
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All {title}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items && items.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {fields.map((field) => (
                      <TableHead key={field.name} data-testid={`header-${field.name}`}>
                        {field.label}
                      </TableHead>
                    ))}
                    <TableHead className="w-[200px] text-right" data-testid="header-actions">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} data-testid={`row-${item.id}`}>
                      {fields.map((field) => (
                        <TableCell 
                          key={field.name} 
                          className={field.name === 'name' ? 'font-medium' : ''} 
                          data-testid={`cell-${field.name}-${item.id}`}
                        >
                          {(item as any)[field.name] || '-'}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                            data-testid={`button-edit-${item.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item)}
                            data-testid={`button-delete-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No {title.toLowerCase()} found. Click "Add New" to create one.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen || !!editingItem} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setEditingItem(null);
          form.reset();
        }
      }}>
        <DialogContent data-testid="dialog-form">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit' : 'Add'} {title.slice(0, -1)}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update' : 'Create a new'} {title.slice(0, -1).toLowerCase()}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {fields.map((fieldConfig) => (
                <FormField
                  key={fieldConfig.name}
                  control={form.control}
                  name={fieldConfig.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel data-testid={`label-${fieldConfig.name}`}>{fieldConfig.label}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder={fieldConfig.placeholder || `Enter ${fieldConfig.label.toLowerCase()}`} 
                          data-testid={`input-${fieldConfig.name}`} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingItem(null);
                    form.reset();
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingItem
                    ? 'Update'
                    : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingItem?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingItem && deleteMutation.mutate(deletingItem.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-confirm"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
