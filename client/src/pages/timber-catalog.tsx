import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, Boxes, Upload } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTimberSizeSchema, type TimberSize, type InsertTimberSize } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExportButton } from "@/components/export-button";
import { TimberImportDialog } from "@/components/timber-import-dialog";

// Group timber items by thickness×width
type TimberGroup = {
  key: string;
  thickness: number;
  width: number;
  grade: string;
  items: TimberSize[];
};

export default function TimberCatalog() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingTimber, setEditingTimber] = useState<TimberSize | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: timberSizes, isLoading } = useQuery<TimberSize[]>({
    queryKey: ["/api/timber-sizes"],
  });

  // Group timber sizes by thickness×width×grade
  const groupedTimber = useMemo(() => {
    if (!timberSizes) return [];
    
    const groups = new Map<string, TimberGroup>();
    
    timberSizes.forEach((timber) => {
      const key = `${timber.thickness}×${timber.width}-${timber.grade}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          thickness: timber.thickness,
          width: timber.width,
          grade: timber.grade,
          items: [],
        });
      }
      
      groups.get(key)!.items.push(timber);
    });
    
    // Sort items within each group by classification order (Shorts -> Mediums -> Longs)
    const classificationOrder: Record<string, number> = {
      'Shorts': 1,
      'Mediums': 2,
      'Longs': 3,
    };
    
    groups.forEach((group) => {
      group.items.sort((a, b) => {
        return (classificationOrder[a.classification] || 99) - (classificationOrder[b.classification] || 99);
      });
    });
    
    // Convert to array and sort by thickness, then width
    return Array.from(groups.values()).sort((a, b) => {
      if (a.thickness !== b.thickness) return a.thickness - b.thickness;
      if (a.width !== b.width) return a.width - b.width;
      return a.grade.localeCompare(b.grade);
    });
  }, [timberSizes]);

  const form = useForm<InsertTimberSize>({
    resolver: zodResolver(insertTimberSizeSchema),
    defaultValues: {
      thickness: 0,
      width: 0,
      lengthMin: "0",
      lengthMax: "0",
      classification: "",
      grade: "",
      bufferPercentage: "10",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertTimberSize) => apiRequest("POST", "/api/timber-sizes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timber-sizes"] });
      setIsAddOpen(false);
      form.reset();
      toast({ title: "Timber size added successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertTimberSize }) =>
      apiRequest("PUT", `/api/timber-sizes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timber-sizes"] });
      setEditingTimber(null);
      form.reset();
      toast({ title: "Timber size updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/timber-sizes/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timber-sizes"] });
      setDeletingId(null);
      toast({ title: "Timber size deleted successfully" });
    },
  });

  const onSubmit = (data: InsertTimberSize) => {
    if (editingTimber) {
      updateMutation.mutate({ id: editingTimber.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (timber: TimberSize) => {
    setEditingTimber(timber);
    form.reset({
      thickness: timber.thickness,
      width: timber.width,
      lengthMin: timber.lengthMin,
      lengthMax: timber.lengthMax,
      classification: timber.classification,
      grade: timber.grade,
      bufferPercentage: timber.bufferPercentage || "10",
    });
  };

  const handleCloseDialog = () => {
    setIsAddOpen(false);
    setEditingTimber(null);
    form.reset();
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'Shorts':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Mediums':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'Longs':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-timber-catalog-title">
            Timber Catalog
          </h1>
          <p className="text-muted-foreground">Manage timber sizes and specifications</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton 
            endpoint="/api/export/timber-sizes" 
            filename="timber-sizes"
          />
          <Button
            variant="outline"
            onClick={() => setIsImportOpen(true)}
            data-testid="button-import-timber"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => setIsAddOpen(true)} data-testid="button-add-timber">
            <Plus className="h-4 w-4 mr-2" />
            Add Timber Size
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : groupedTimber && groupedTimber.length > 0 ? (
        <div className="space-y-4">
          {groupedTimber.map((group) => (
            <Card key={group.key} data-testid={`card-timber-group-${group.key}`}>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">
                  {group.thickness}×{group.width}mm {group.grade}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {group.items.map((timber) => (
                    <div
                      key={timber.id}
                      className={`p-4 rounded-lg border ${getClassificationColor(timber.classification)}`}
                      data-testid={`block-timber-${timber.id}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline" className="font-semibold">
                          {timber.classification}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(timber)}
                            data-testid={`button-edit-${timber.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setDeletingId(timber.id)}
                            data-testid={`button-delete-${timber.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Length:</span>
                          <span className="font-medium">
                            {timber.lengthMin}m - {timber.lengthMax}m
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">m³ Factor:</span>
                          <span className="font-mono text-xs">
                            {parseFloat(timber.m3Factor).toFixed(6)}
                          </span>
                        </div>
                        {timber.systemRate && (
                          <div className="flex justify-between pt-1.5 border-t">
                            <span className="text-muted-foreground">System Rate:</span>
                            <span className="font-mono font-semibold">
                              R{parseFloat(timber.systemRate).toFixed(2)}/m
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Boxes className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No timber sizes added yet</p>
            <Button onClick={() => setIsAddOpen(true)} data-testid="button-add-first-timber">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Timber Size
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={isAddOpen || !!editingTimber} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTimber ? "Edit" : "Add"} Timber Size</DialogTitle>
            <DialogDescription>
              {editingTimber ? "Update" : "Enter"} the timber specifications below
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="thickness"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thickness (mm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          data-testid="input-thickness"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="width"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Width (mm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          data-testid="input-width"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lengthMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Length (m)</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-length-min" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lengthMax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Length (m)</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-length-max" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="classification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Classification</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Shorts, Mediums, Longs" {...field} data-testid="input-classification" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., S5, BBB, BG" {...field} data-testid="input-grade" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bufferPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buffer Percentage (%)</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-buffer-percentage" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-timber"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingTimber
                    ? "Update"
                    : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Timber Size</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this timber size and all associated supplier rates. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TimberImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
    </div>
  );
}
