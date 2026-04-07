import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Upload, Download, FileSpreadsheet, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import * as XLSX from "xlsx";
import type { InsertTimberSize } from "@shared/schema";

interface TimberImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedTimberSize extends InsertTimberSize {
  rowNumber: number;
  errors?: string[];
}

export function TimberImportDialog({ open, onOpenChange }: TimberImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedTimberSize[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const downloadTemplate = () => {
    const template = [
      {
        thickness: 38,
        width: 114,
        lengthMin: "2.40",
        lengthMax: "4.80",
        classification: "Standard",
        grade: "A1",
        bufferPercentage: "10",
      },
      {
        thickness: 50,
        width: 150,
        lengthMin: "3.00",
        lengthMax: "5.40",
        classification: "Premium",
        grade: "S5",
        bufferPercentage: "12",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timber Sizes");
    XLSX.writeFile(wb, "timber-sizes-template.xlsx");
  };

  const validateRow = (row: any, rowNumber: number): ParsedTimberSize => {
    const errors: string[] = [];
    
    if (!row.thickness || isNaN(Number(row.thickness)) || Number(row.thickness) < 1) {
      errors.push("Invalid thickness");
    }
    if (!row.width || isNaN(Number(row.width)) || Number(row.width) < 1) {
      errors.push("Invalid width");
    }
    if (!row.lengthMin || !/^\d+(\.\d{1,2})?$/.test(String(row.lengthMin))) {
      errors.push("Invalid min length");
    }
    if (!row.lengthMax || !/^\d+(\.\d{1,2})?$/.test(String(row.lengthMax))) {
      errors.push("Invalid max length");
    }
    if (!row.classification || String(row.classification).trim() === "") {
      errors.push("Classification required");
    }
    if (!row.grade || String(row.grade).trim() === "") {
      errors.push("Grade required");
    }

    return {
      rowNumber,
      thickness: Number(row.thickness) || 0,
      width: Number(row.width) || 0,
      lengthMin: String(row.lengthMin || "0"),
      lengthMax: String(row.lengthMax || "0"),
      classification: String(row.classification || ""),
      grade: String(row.grade || ""),
      bufferPercentage: String(row.bufferPercentage || "10"),
      errors: errors.length > 0 ? errors : undefined,
    };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const validated = jsonData.map((row, index) => validateRow(row, index + 2));
        setParsedData(validated);
      } catch (error) {
        toast({
          title: "Error parsing file",
          description: "Please check the file format and try again",
          variant: "destructive",
        });
      }
    };

    reader.readAsArrayBuffer(uploadedFile);
  };

  const handleImport = async () => {
    const validRows = parsedData.filter((row) => !row.errors);
    
    if (validRows.length === 0) {
      toast({
        title: "No valid rows to import",
        description: "Please fix the errors and try again",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      // Prepare rows for batch import
      const rows = validRows.map((row) => {
        const { errors, ...data } = row;
        return data;
      });

      // Call batch import endpoint
      const response = await apiRequest("POST", "/api/timber-sizes/import", { rows });

      queryClient.invalidateQueries({ queryKey: ["/api/timber-sizes"] });
      
      // Validate response structure
      if (!response || typeof response !== 'object') {
        throw new Error("Invalid response from server");
      }

      const { summary, results } = response as any;
      
      if (!summary) {
        throw new Error("Invalid response structure: missing summary");
      }
      
      toast({
        title: "Import complete",
        description: `${summary.successful || 0} imported, ${summary.skipped || 0} skipped (duplicates), ${summary.failed || 0} failed`,
      });

      // Show detailed errors if any
      if (summary.failed > 0 || summary.skipped > 0) {
        const errors = results
          .filter((r: any) => r.status !== "success")
          .map((r: any) => `Row ${r.rowNumber}: ${r.message}`)
          .join("\n");
        
        console.log("Import details:", errors);
      }

      if (summary.failed === 0) {
        setFile(null);
        setParsedData([]);
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message || "An error occurred during import",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Timber Sizes</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file to import multiple timber sizes at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              data-testid="button-download-template"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <div className="text-sm text-muted-foreground">
              Download template to see the required format
            </div>
          </div>

          <div>
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover-elevate">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">
                  {file ? file.name : "Click to upload or drag and drop"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Excel (.xlsx, .xls) or CSV files supported
                </p>
              </div>
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-file-upload"
              />
            </label>
          </div>

          {parsedData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Preview ({parsedData.length} rows)</h3>
                <div className="text-sm text-muted-foreground">
                  {parsedData.filter((r) => !r.errors).length} valid,{" "}
                  {parsedData.filter((r) => r.errors).length} with errors
                </div>
              </div>
              <div className="border rounded-lg overflow-x-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>Thickness</TableHead>
                      <TableHead>Width</TableHead>
                      <TableHead>Length Range</TableHead>
                      <TableHead>Classification</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Buffer %</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, index) => (
                      <TableRow key={index} className={row.errors ? "bg-destructive/10" : ""}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>{row.thickness}</TableCell>
                        <TableCell>{row.width}</TableCell>
                        <TableCell>
                          {row.lengthMin} - {row.lengthMax}m
                        </TableCell>
                        <TableCell>{row.classification}</TableCell>
                        <TableCell>{row.grade}</TableCell>
                        <TableCell>{row.bufferPercentage}%</TableCell>
                        <TableCell>
                          {row.errors ? (
                            <div className="flex items-center gap-1 text-destructive text-xs">
                              <AlertCircle className="h-3 w-3" />
                              {row.errors.join(", ")}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Valid</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setFile(null);
                setParsedData([]);
                onOpenChange(false);
              }}
              data-testid="button-cancel-import"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={parsedData.length === 0 || isImporting}
              data-testid="button-confirm-import"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isImporting ? "Importing..." : `Import ${parsedData.filter((r) => !r.errors).length} Rows`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
