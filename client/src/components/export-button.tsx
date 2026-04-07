import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ExportButtonProps = {
  endpoint: string;
  filename: string;
  period?: string;
  selectedSupplierIds?: string[];
};

export function ExportButton({ endpoint, filename, period, selectedSupplierIds }: ExportButtonProps) {
  const { toast } = useToast();

  const handleExport = async (format: 'xlsx' | 'csv' | 'pdf') => {
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      if (period) {
        params.append('period', period);
      }
      if (selectedSupplierIds && selectedSupplierIds.length > 0) {
        params.append('selectedSupplierIds', selectedSupplierIds.join(','));
      }
      
      const response = await fetch(`${endpoint}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: `Downloaded ${filename}.${format}`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Could not export data. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-export">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('xlsx')} data-testid="button-export-excel">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('csv')} data-testid="button-export-csv">
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')} data-testid="button-export-pdf">
          <FileType className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
