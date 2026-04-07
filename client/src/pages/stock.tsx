import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
} from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, X, ArrowUpDown, ArrowUp, ArrowDown, Plus, Upload, Download, Settings2, Save, Eye, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface StockItem {
  id: string;
  productCode: string;
  partcode: string | null;
  itemHierarchy: string | null;
  description: string | null;
  notes: string | null;
  // Costing fields from schema
  supplierCost: string | null;
  averageCost: string | null;
  lastCost: string | null;
  highestCost: string | null;
  maxQuantity: number | null;
  qtyOnHand: number | null;
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
  status: boolean;
  createdAt: string;
}

interface StockType {
  id: string;
  name: string;
  description: string | null;
}

interface GridView {
  id: string;
  name: string;
  columnVisibility: VisibilityState;
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
}

export default function StockPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<string>('all');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);
  
  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    // Default view: Product Code, Part Code, Description, Avg Cost, Max Qty, Status
    id: false,
    itemHierarchy: false,
    notes: false,
    relationId: false,
    behaviourId: false,
    typeId: false,
    stockUnitId: false,
    purchaseUnitId: false,
    salesUnitId: false,
    primarySupplierId: false,
    markupCategoryId: false,
    discountCategoryId: false,
  });
  const [rowSelection, setRowSelection] = useState({});
  
  // View management
  const [savedViews, setSavedViews] = useState<GridView[]>([]);
  const [currentView, setCurrentView] = useState<string | null>(null);
  const [showSaveViewDialog, setShowSaveViewDialog] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  
  // Import dialog
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: stockItems, isLoading } = useQuery<StockItem[]>({
    queryKey: ['/api/stock'],
  });
  
  const { data: stockTypes } = useQuery<StockType[]>({
    queryKey: ['/api/stock/lookups/types'],
  });
  
  // Search suggestions from API - now unlimited, searches all fields including properties
  const { data: searchSuggestions, isLoading: isSearching } = useQuery<any[]>({
    queryKey: ['/api/stock/search', debouncedSearch],
    queryFn: async () => {
      const response = await fetch(`/api/stock/search?q=${encodeURIComponent(debouncedSearch)}`);
      if (!response.ok) throw new Error('Failed to search');
      return response.json();
    },
    enabled: debouncedSearch.length >= 2,
  });
  
  // Separate query for grid results
  const { data: gridSearchResults } = useQuery<any[]>({
    queryKey: ['/api/stock/search/grid', debouncedSearch],
    queryFn: async () => {
      const response = await fetch(`/api/stock/search?q=${encodeURIComponent(debouncedSearch)}`);
      if (!response.ok) throw new Error('Failed to search');
      return response.json();
    },
    enabled: debouncedSearch.length >= 2,
  });
  
  // Load saved views and apply last used view
  useEffect(() => {
    const saved = localStorage.getItem('stock-grid-views');
    if (saved) {
      try {
        const views = JSON.parse(saved);
        setSavedViews(views);
        
        // Auto-load the last saved view on mount
        const lastViewId = localStorage.getItem('stock-grid-last-view');
        if (lastViewId && views.find((v: GridView) => v.id === lastViewId)) {
          const view = views.find((v: GridView) => v.id === lastViewId);
          if (view) {
            setColumnVisibility(view.columnVisibility);
            setSorting(view.sorting);
            setColumnFilters(view.columnFilters);
            setCurrentView(lastViewId);
          }
        }
      } catch (e) {
        console.error('Failed to load saved views', e);
      }
    }
  }, []);
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // Show suggestions
  useEffect(() => {
    if (searchTerm.length >= 2 && searchSuggestions) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [searchTerm, searchSuggestions]);
  
  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Column definitions
  const columns = useMemo<ColumnDef<StockItem>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            data-testid="checkbox-select-all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            data-testid={`checkbox-select-${row.original.productCode}`}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'productCode',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 -mx-2"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                data-testid="sort-product-code"
              >
                Product Code
                {column.getIsSorted() === 'asc' ? (
                  <ArrowUp className="ml-2 h-4 w-4" />
                ) : column.getIsSorted() === 'desc' ? (
                  <ArrowDown className="ml-2 h-4 w-4" />
                ) : (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
              <Input
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-product-code"
              />
            </div>
          );
        },
        cell: ({ row }) => (
          <div className="font-medium" data-testid={`cell-product-code-${row.original.productCode}`}>
            {row.getValue('productCode')}
          </div>
        ),
      },
      {
        accessorKey: 'partcode',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 -mx-2"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                data-testid="sort-part-code"
              >
                Part Code
                {column.getIsSorted() === 'asc' ? (
                  <ArrowUp className="ml-2 h-4 w-4" />
                ) : column.getIsSorted() === 'desc' ? (
                  <ArrowDown className="ml-2 h-4 w-4" />
                ) : (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
              <Input
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-part-code"
              />
            </div>
          );
        },
        cell: ({ row }) => (
          <div className="text-muted-foreground" data-testid={`cell-part-code-${row.original.productCode}`}>
            {row.getValue('partcode') || '—'}
          </div>
        ),
      },
      {
        accessorKey: 'description',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 -mx-2"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                data-testid="sort-description"
              >
                Description
                {column.getIsSorted() === 'asc' ? (
                  <ArrowUp className="ml-2 h-4 w-4" />
                ) : column.getIsSorted() === 'desc' ? (
                  <ArrowDown className="ml-2 h-4 w-4" />
                ) : (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
              <Input
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-description"
              />
            </div>
          );
        },
        cell: ({ row }) => (
          <div className="max-w-[400px]" data-testid={`cell-description-${row.original.productCode}`}>
            <div className="font-medium text-sm">
              {row.getValue('description') || '—'}
            </div>
            {row.original.notes && (
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {row.original.notes}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'averageCost',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 -mx-2"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                data-testid="sort-average-cost"
              >
                Avg Cost
                {column.getIsSorted() === 'asc' ? (
                  <ArrowUp className="ml-2 h-4 w-4" />
                ) : column.getIsSorted() === 'desc' ? (
                  <ArrowDown className="ml-2 h-4 w-4" />
                ) : (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
              <Input
                type="number"
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-average-cost"
              />
            </div>
          );
        },
        filterFn: (row, id, value) => {
          if (!value || value === '') return true;
          const rowValue = row.getValue(id);
          if (rowValue === null || rowValue === undefined) return false;
          
          const rowNum = Number(rowValue);
          const filterNum = Number(value);
          
          if (!Number.isFinite(rowNum) || !Number.isFinite(filterNum)) return false;
          
          // Compare numbers with small epsilon for floating point comparison
          return Math.abs(rowNum - filterNum) < 0.01;
        },
        cell: ({ row }) => {
          const costValue = row.getValue('averageCost');
          const cost = costValue != null ? Number(costValue) : null;
          return (
            <div className="text-right font-mono text-sm" data-testid={`cell-average-cost-${row.original.productCode}`}>
              {cost != null && Number.isFinite(cost) ? `$${cost.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
            </div>
          );
        },
      },
      {
        accessorKey: 'maxQuantity',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 -mx-2"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                data-testid="sort-max-qty"
              >
                Max Qty
                {column.getIsSorted() === 'asc' ? (
                  <ArrowUp className="ml-2 h-4 w-4" />
                ) : column.getIsSorted() === 'desc' ? (
                  <ArrowDown className="ml-2 h-4 w-4" />
                ) : (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
              <Input
                type="number"
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-max-qty"
              />
            </div>
          );
        },
        filterFn: (row, id, value) => {
          if (!value || value === '') return true;
          const rowValue = row.getValue(id);
          if (rowValue === null || rowValue === undefined) return false;
          
          const rowNum = Number(rowValue);
          const filterNum = Number(value);
          
          if (!Number.isFinite(rowNum) || !Number.isFinite(filterNum)) return false;
          
          // Compare numbers with small epsilon for floating point comparison
          return Math.abs(rowNum - filterNum) < 0.01;
        },
        cell: ({ row }) => {
          const qtyValue = row.getValue('maxQuantity');
          const qty = qtyValue != null ? Number(qtyValue) : null;
          return (
            <div className="text-right font-mono text-sm" data-testid={`cell-max-qty-${row.original.productCode}`}>
              {qty != null && Number.isFinite(qty) ? qty.toLocaleString() : <span className="text-muted-foreground">—</span>}
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 -mx-2"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                data-testid="sort-status"
              >
                Status
                {column.getIsSorted() === 'asc' ? (
                  <ArrowUp className="ml-2 h-4 w-4" />
                ) : column.getIsSorted() === 'desc' ? (
                  <ArrowDown className="ml-2 h-4 w-4" />
                ) : (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
              <Select
                value={(column.getFilterValue() as string) ?? 'all'}
                onValueChange={(value) => column.setFilterValue(value === 'all' ? '' : value)}
              >
                <SelectTrigger className="h-8 text-xs" data-testid="filter-status">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        },
        filterFn: (row, id, value) => {
          if (!value || value === 'all') return true;
          return String(row.getValue(id)) === value;
        },
        cell: ({ row }) => {
          const status = row.getValue('status') as boolean | null;
          return (
            <div className="text-center">
              {status ? (
                <Badge 
                  variant="default" 
                  className="bg-green-600 hover:bg-green-700"
                  data-testid={`status-active-${row.original.productCode}`}
                >
                  Active
                </Badge>
              ) : (
                <Badge 
                  variant="secondary"
                  data-testid={`status-inactive-${row.original.productCode}`}
                >
                  Inactive
                </Badge>
              )}
            </div>
          );
        },
      },
      // Additional columns (hidden by default)
      {
        accessorKey: 'id',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">ID</div>
              <Input
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-id"
              />
            </div>
          );
        },
        cell: ({ row }) => <div className="font-mono text-xs">{row.getValue('id')}</div>,
      },
      {
        accessorKey: 'itemHierarchy',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">Item Hierarchy</div>
              <Input
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-item-hierarchy"
              />
            </div>
          );
        },
        cell: ({ row }) => <div className="text-sm">{row.getValue('itemHierarchy') || '—'}</div>,
      },
      {
        accessorKey: 'notes',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">Notes</div>
              <Input
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-notes"
              />
            </div>
          );
        },
        cell: ({ row }) => <div className="text-sm max-w-[300px] truncate">{row.getValue('notes') || '—'}</div>,
      },
      {
        accessorKey: 'relationId',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">Relation ID</div>
              <Input
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-relation-id"
              />
            </div>
          );
        },
        cell: ({ row }) => <div className="font-mono text-xs">{row.getValue('relationId') || '—'}</div>,
      },
      {
        accessorKey: 'behaviourId',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">Behaviour ID</div>
              <Input
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-behaviour-id"
              />
            </div>
          );
        },
        cell: ({ row }) => <div className="font-mono text-xs">{row.getValue('behaviourId') || '—'}</div>,
      },
      {
        accessorKey: 'typeId',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">Type ID</div>
              <Input
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-type-id"
              />
            </div>
          );
        },
        cell: ({ row }) => <div className="font-mono text-xs">{row.getValue('typeId') || '—'}</div>,
      },
      {
        accessorKey: 'stockUnitId',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">Stock Unit ID</div>
              <Input
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-stock-unit-id"
              />
            </div>
          );
        },
        cell: ({ row }) => <div className="font-mono text-xs">{row.getValue('stockUnitId') || '—'}</div>,
      },
      {
        accessorKey: 'purchaseUnitId',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">Purchase Unit ID</div>
              <Input
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-purchase-unit-id"
              />
            </div>
          );
        },
        cell: ({ row }) => <div className="font-mono text-xs">{row.getValue('purchaseUnitId') || '—'}</div>,
      },
      {
        accessorKey: 'salesUnitId',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">Sales Unit ID</div>
              <Input
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-sales-unit-id"
              />
            </div>
          );
        },
        cell: ({ row }) => <div className="font-mono text-xs">{row.getValue('salesUnitId') || '—'}</div>,
      },
      {
        accessorKey: 'primarySupplierId',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">Primary Supplier ID</div>
              <Input
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-primary-supplier-id"
              />
            </div>
          );
        },
        cell: ({ row }) => <div className="font-mono text-xs">{row.getValue('primarySupplierId') || '—'}</div>,
      },
      {
        accessorKey: 'markupCategoryId',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">Markup Category ID</div>
              <Input
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-markup-category-id"
              />
            </div>
          );
        },
        cell: ({ row }) => <div className="font-mono text-xs">{row.getValue('markupCategoryId') || '—'}</div>,
      },
      {
        accessorKey: 'discountCategoryId',
        header: ({ column }) => {
          return (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">Discount Category ID</div>
              <Input
                placeholder="Filter..."
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(e) => column.setFilterValue(e.target.value)}
                className="h-8 text-xs"
                data-testid="filter-discount-category-id"
              />
            </div>
          );
        },
        cell: ({ row }) => <div className="font-mono text-xs">{row.getValue('discountCategoryId') || '—'}</div>,
      },
    ],
    []
  );
  
  // Prepare data with type and search filters
  const filteredData = useMemo(() => {
    let data = debouncedSearch.length >= 2 && gridSearchResults 
      ? gridSearchResults 
      : stockItems || [];
    
    // Apply type filter
    if (selectedTypeId && selectedTypeId !== 'all') {
      data = data.filter(item => item.typeId === selectedTypeId);
    }
    
    return data;
  }, [stockItems, gridSearchResults, debouncedSearch, selectedTypeId]);
  
  // TanStack Table instance
  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 50,
      },
      columnVisibility: {
        // Default view: Product Code, Part Code, Description, Avg Cost, Max Qty, Status
        // Hide all other columns
        id: false,
        itemHierarchy: false,
        notes: false,
        relationId: false,
        behaviourId: false,
        typeId: false,
        stockUnitId: false,
        purchaseUnitId: false,
        salesUnitId: false,
        primarySupplierId: false,
        markupCategoryId: false,
        discountCategoryId: false,
      },
    },
  });
  
  // View handlers
  const handleSaveView = () => {
    if (!newViewName.trim()) {
      toast({ title: 'Error', description: 'Please enter a view name', variant: 'destructive' });
      return;
    }
    
    const newView: GridView = {
      id: Date.now().toString(),
      name: newViewName.trim(),
      columnVisibility: { ...columnVisibility },
      sorting: [...sorting],
      columnFilters: [...columnFilters],
    };
    
    const updatedViews = [...savedViews, newView];
    setSavedViews(updatedViews);
    localStorage.setItem('stock-grid-views', JSON.stringify(updatedViews));
    
    setShowSaveViewDialog(false);
    setNewViewName('');
    toast({ title: 'Success', description: `View "${newView.name}" saved` });
  };
  
  const handleLoadView = (viewId: string) => {
    const view = savedViews.find(v => v.id === viewId);
    if (view) {
      setColumnVisibility(view.columnVisibility);
      setSorting(view.sorting);
      setColumnFilters(view.columnFilters);
      setCurrentView(viewId);
      localStorage.setItem('stock-grid-last-view', viewId);
      toast({ title: 'Success', description: `Loaded view "${view.name}"` });
    }
  };
  
  const handleDeleteView = (viewId: string) => {
    const updatedViews = savedViews.filter(v => v.id !== viewId);
    setSavedViews(updatedViews);
    localStorage.setItem('stock-grid-views', JSON.stringify(updatedViews));
    if (currentView === viewId) setCurrentView(null);
    toast({ title: 'Success', description: 'View deleted' });
  };
  
  const handleExport = () => {
    // Use getRowModel() to get filtered AND sorted rows
    const rows = table.getRowModel().rows;
    if (rows.length === 0) {
      toast({ title: 'Error', description: 'No data to export', variant: 'destructive' });
      return;
    }
    
    const exportData = rows.map(row => {
      const cost = row.original.cost != null ? Number(row.original.cost) : null;
      const maxQty = row.original.maxQuantity != null ? Number(row.original.maxQuantity) : null;
      
      return {
        'Product Code': row.original.productCode,
        'Part Code': row.original.partcode || '',
        'Description': row.original.description || '',
        'Cost': cost != null && Number.isFinite(cost) ? cost.toFixed(2) : '',
        'Max Quantity': maxQty != null && Number.isFinite(maxQty) ? maxQty : '',
        'Status': row.original.status ? 'Active' : 'Inactive',
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Items');
    XLSX.writeFile(wb, `stock-items-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({ title: 'Success', description: `Exported ${rows.length} items` });
  };
  
  const handleImportFile = () => {
    if (!importFile) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        toast({ 
          title: 'Import Preview', 
          description: `Found ${jsonData.length} rows. Import functionality coming soon.` 
        });
        
        setShowImportDialog(false);
        setImportFile(null);
        // Reset file input to allow re-selection of same file
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        toast({ 
          title: 'Error', 
          description: 'Failed to parse Excel file', 
          variant: 'destructive' 
        });
      }
    };
    reader.readAsBinaryString(importFile);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Stock Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage stock items with properties, colours, and variants
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stockItems && (
            <Badge variant="secondary" className="text-sm" data-testid="badge-stock-count">
              {stockItems.length.toLocaleString()} items
            </Badge>
          )}
        </div>
      </div>
      
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          {/* Search */}
          <div className="flex-1 max-w-md relative" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code, description, dimensions, materials..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => searchTerm.length >= 2 && setShowSuggestions(true)}
              className="pl-10 pr-10"
              data-testid="input-stock-search"
            />
            {searchTerm && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => {
                  setSearchTerm('');
                  setDebouncedSearch('');
                  setShowSuggestions(false);
                }}
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            
            {/* Suggestions dropdown */}
            {showSuggestions && searchTerm.length >= 2 && (
              <Card className="absolute top-full mt-1 w-full z-50 max-h-[500px] overflow-hidden flex flex-col shadow-lg" data-testid="search-suggestions">
                {isSearching ? (
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Searching...</div>
                  </CardContent>
                ) : searchSuggestions && searchSuggestions.length > 0 ? (
                  <>
                    <div className="px-4 py-2 border-b bg-muted/50">
                      <p className="text-xs text-muted-foreground">
                        Found {searchSuggestions.length} {searchSuggestions.length === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {searchSuggestions.map((item) => (
                            <div
                              key={item.id}
                              className="p-3 hover-elevate cursor-pointer"
                              onClick={() => {
                                setLocation(`/stock/${item.id}`);
                                setShowSuggestions(false);
                              }}
                              data-testid={`suggestion-${item.productCode}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-medium text-sm">{item.productCode}</span>
                                    {item.partcode && (
                                      <span className="text-xs text-muted-foreground">({item.partcode})</span>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground truncate mt-1">
                                    {item.description || 'No description'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </div>
                  </>
                ) : (
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">
                      No items found matching "{searchTerm}"
                    </div>
                  </CardContent>
                )}
              </Card>
            )}
          </div>
          
          {/* Type filter */}
          <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
            <SelectTrigger className="w-[180px]" data-testid="select-type-filter">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {stockTypes?.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Command buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setLocation('/stock/new')}
            data-testid="button-add-item"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Item
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportDialog(true)}
            data-testid="button-import"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            data-testid="button-export"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          {/* Column visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-columns">
                <Settings2 className="h-4 w-4 mr-2" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      data-testid={`toggle-column-${column.id}`}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Saved views */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-views">
                <Eye className="h-4 w-4 mr-2" />
                Views
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px]">
              <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowSaveViewDialog(true)} data-testid="menu-save-view">
                <Save className="h-4 w-4 mr-2" />
                Save current view
              </DropdownMenuItem>
              {savedViews.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {savedViews.map((view) => (
                    <div key={view.id} className="flex items-center justify-between px-2 py-1.5 hover-elevate rounded-sm">
                      <button
                        onClick={() => handleLoadView(view.id)}
                        className="flex-1 text-left text-sm"
                        data-testid={`load-view-${view.id}`}
                      >
                        {view.name}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleDeleteView(view.id)}
                        data-testid={`delete-view-${view.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {table.getFilteredRowModel().rows.length} items
              {Object.keys(rowSelection).length > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({Object.keys(rowSelection).length} selected)
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && 'selected'}
                        onDoubleClick={() => setLocation(`/stock/${row.original.id}`)}
                        className="cursor-pointer hover-elevate"
                        data-testid={`row-stock-${row.original.productCode}`}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        No results.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Save View Dialog */}
      <Dialog open={showSaveViewDialog} onOpenChange={setShowSaveViewDialog}>
        <DialogContent data-testid="dialog-save-view">
          <DialogHeader>
            <DialogTitle>Save Current View</DialogTitle>
            <DialogDescription>
              Save the current column visibility, sorting, and filters as a named view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="View name"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              data-testid="input-view-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveViewDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveView} data-testid="button-save-view">
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent data-testid="dialog-import">
          <DialogHeader>
            <DialogTitle>Import from Excel</DialogTitle>
            <DialogDescription>
              Upload an Excel file to import stock items.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
              data-testid="button-choose-file"
            >
              {importFile ? importFile.name : 'Choose Excel file...'}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowImportDialog(false);
              setImportFile(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleImportFile} disabled={!importFile} data-testid="button-import-file">
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
