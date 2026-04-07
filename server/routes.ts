import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertTimberSizeSchema,
  insertSupplierSchema,
  insertSupplierRateSchema,
  insertStockSchema,
} from "@shared/schema";
import { db, pool } from "./db";
import { timberSizes, suppliers, supplierRates, systemPricingHistory, stock, stockUoms } from "@shared/schema";
import { eq, desc, sql, and, inArray, isNotNull } from "drizzle-orm";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";
import * as fs from "fs";
import multer from "multer";
import path from "path";

// Configure multer for file uploads
const upload = multer({
  dest: 'attached_assets/uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});


export async function registerRoutes(app: Express): Promise<Server> {
  // TEST endpoint
  app.get("/api/test-colours-debug", async (req, res) => {
    console.log('[TEST] Test endpoint called!');
    try {
      const result = await pool.query('SELECT * FROM stock_colours ORDER BY name');
      console.log('[TEST] Query result rows:', result.rowCount);
      res.json({ rowCount: result.rowCount, rows: result.rows });
    } catch (error: any) {
      console.error('[TEST] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // File upload endpoint
  app.post("/api/upload", upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Return the file path
      res.json({ filePath: req.file.path });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });
  // Timber sizes routes
  app.get("/api/timber-sizes", async (req, res) => {
    try {
      const sizes = await storage.getTimberSizes();
      res.json(sizes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch timber sizes" });
    }
  });

  app.post("/api/timber-sizes", async (req, res) => {
    try {
      const data = insertTimberSizeSchema.parse(req.body);
      const timber = await storage.createTimberSize(data);
      res.json(timber);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid data" });
    }
  });

  app.put("/api/timber-sizes/:id", async (req, res) => {
    try {
      const data = insertTimberSizeSchema.parse(req.body);
      const timber = await storage.updateTimberSize(req.params.id, data);
      
      // Recalculate system rate based on latest supplier rates
      const rates = await storage.getSupplierRatesByTimberSize(req.params.id);
      
      // Get current rates (latest for each supplier)
      const latestRatesMap = new Map<string, { year: number; month: number; ratePerM: number }>();
      rates.forEach((r) => {
        if (!r.ratePerM) return;
        const existing = latestRatesMap.get(r.supplierId);
        if (!existing || r.year > existing.year || 
            (r.year === existing.year && r.month > existing.month)) {
          latestRatesMap.set(r.supplierId, {
            year: r.year,
            month: r.month,
            ratePerM: parseFloat(r.ratePerM),
          });
        }
      });

      const currentRates = Array.from(latestRatesMap.values()).map(r => r.ratePerM);
      
      if (currentRates.length > 0) {
        const average = currentRates.reduce((a, b) => a + b, 0) / currentRates.length;
        const bufferPercentage = data.bufferPercentage ? parseFloat(data.bufferPercentage) : 10;
        const systemRate = average * (1 + bufferPercentage / 100);

        await db
          .update(timberSizes)
          .set({ systemRate: systemRate.toString() })
          .where(eq(timberSizes.id, req.params.id));
      }
      
      res.json(timber);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid data" });
    }
  });

  app.delete("/api/timber-sizes/:id", async (req, res) => {
    try {
      await storage.deleteTimberSize(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete timber size" });
    }
  });

  // Bulk import timber sizes
  app.post("/api/timber-sizes/import", async (req, res) => {
    try {
      const { rows } = req.body;
      
      if (!Array.isArray(rows)) {
        return res.status(400).json({ error: "Invalid request: rows must be an array" });
      }

      const results = await Promise.allSettled(
        rows.map(async (row: any, index: number) => {
          try {
            const validatedData = insertTimberSizeSchema.parse(row);
            
            // Check for duplicates based on thickness, width, and classification
            const existing = await db
              .select()
              .from(timberSizes)
              .where(
                and(
                  eq(timberSizes.thickness, validatedData.thickness),
                  eq(timberSizes.width, validatedData.width),
                  eq(timberSizes.classification, validatedData.classification)
                )
              )
              .limit(1);

            if (existing.length > 0) {
              return {
                rowNumber: row.rowNumber || index + 1,
                status: "skipped",
                message: "Duplicate timber size already exists",
              };
            }

            const timber = await storage.createTimberSize(validatedData);
            return {
              rowNumber: row.rowNumber || index + 1,
              status: "success",
              data: timber,
            };
          } catch (error: any) {
            return {
              rowNumber: row.rowNumber || index + 1,
              status: "error",
              message: error.message || "Validation failed",
            };
          }
        })
      );

      const processedResults = results.map((result) =>
        result.status === "fulfilled" ? result.value : { status: "error", message: "Processing failed" }
      );

      const successful = processedResults.filter((r) => r.status === "success").length;
      const skipped = processedResults.filter((r) => r.status === "skipped").length;
      const failed = processedResults.filter((r) => r.status === "error").length;

      res.json({
        summary: { successful, skipped, failed, total: rows.length },
        results: processedResults,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Import failed" });
    }
  });

  // Suppliers routes
  app.get("/api/suppliers", async (req, res) => {
    try {
      const suppliersList = await storage.getSuppliers();
      
      const suppliersWithRates = await Promise.all(
        suppliersList.map(async (supplier) => {
          // Get timber rates (with timber size info)
          const timberRates = await db
            .select({
              rate: supplierRates,
              timberSize: timberSizes,
            })
            .from(supplierRates)
            .innerJoin(timberSizes, eq(supplierRates.timberSizeId, timberSizes.id))
            .where(eq(supplierRates.supplierId, supplier.id))
            .orderBy(desc(supplierRates.year), desc(supplierRates.month))
            .limit(2);

          // Determine latest and previous rates
          let latestRate: any;
          let previousRate: any;
          let percentageIncrease: number | undefined;

          if (timberRates.length > 0) {
            latestRate = { ...timberRates[0].rate, timberSize: timberRates[0].timberSize };
            previousRate = timberRates[1]?.rate;

            if (latestRate && previousRate && latestRate.ratePerM && previousRate.ratePerM) {
              const latest = parseFloat(latestRate.ratePerM);
              const previous = parseFloat(previousRate.ratePerM);
              
              if (previous !== 0) {
                percentageIncrease = ((latest - previous) / previous) * 100;
              }
            }
          }

          return {
            ...supplier,
            latestRate,
            previousRate,
            percentageIncrease,
          };
        })
      );

      res.json(suppliersWithRates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch suppliers" });
    }
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const data = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(data);
      res.json(supplier);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid data" });
    }
  });

  app.put("/api/suppliers/:id", async (req, res) => {
    try {
      const data = insertSupplierSchema.parse(req.body);
      const supplier = await storage.updateSupplier(req.params.id, data);
      res.json(supplier);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid data" });
    }
  });

  app.patch("/api/suppliers/:id/include-in-market", async (req, res) => {
    try {
      const { includeInMarket } = req.body;
      
      if (typeof includeInMarket !== 'boolean') {
        return res.status(400).json({ error: "includeInMarket must be a boolean" });
      }

      const updated = await db
        .update(suppliers)
        .set({ includeInMarket })
        .where(eq(suppliers.id, req.params.id))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ error: "Supplier not found" });
      }

      res.json(updated[0]);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update supplier" });
    }
  });

  // Get supplier's stock items with purchase unit details (optimized with join)
  app.get("/api/suppliers/:id/stock", async (req, res) => {
    try {
      const supplierId = req.params.id;
      
      // Get all stock items with purchase unit in single query
      const stockItems = await db
        .select({
          id: stock.id,
          productCode: stock.productCode,
          description: stock.description,
          supplierCost: stock.supplierCost,
          purchaseUnitName: stockUoms.name,
        })
        .from(stock)
        .leftJoin(stockUoms, eq(stock.purchaseUnitId, stockUoms.id))
        .where(eq(stock.primarySupplierId, supplierId))
        .orderBy(stock.productCode);
      
      res.json(stockItems);
    } catch (error) {
      console.error('Get supplier stock error:', error);
      res.status(500).json({ error: "Failed to fetch supplier stock items" });
    }
  });

  // Get supplier detail with all timber sizes and their rates by period
  app.get("/api/suppliers/:id/detail", async (req, res) => {
    try {
      const supplierId = req.params.id;
      
      // Get supplier info
      const supplierData = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, supplierId))
        .limit(1);
      
      if (supplierData.length === 0) {
        return res.status(404).json({ error: "Supplier not found" });
      }
      
      // Get all timber sizes
      const allTimberSizes = await db
        .select()
        .from(timberSizes)
        .orderBy(timberSizes.width, timberSizes.thickness);
      
      // Get all rates for this supplier (filter to timber only for now)
      const rates = await db
        .select()
        .from(supplierRates)
        .where(
          and(
            eq(supplierRates.supplierId, supplierId),
            isNotNull(supplierRates.timberSizeId)
          )
        );
      
      // Get all unique periods (year-month combinations) for this supplier
      const periodSet = new Set(rates.map(r => `${r.year}-${r.month.toString().padStart(2, '0')}`));
      const periods = Array.from(periodSet);
      periods.sort().reverse(); // Most recent first
      
      // Build response with timber sizes and their rates by period
      const timberSizesWithRates = allTimberSizes.map(timber => {
        const timberRates = rates.filter(r => r.timberSizeId === timber.id);
        const ratesByPeriod: Record<string, { id: string; ratePerM3: string | null; ratePerM: string | null }> = {};
        
        timberRates.forEach(rate => {
          const periodKey = `${rate.year}-${rate.month.toString().padStart(2, '0')}`;
          ratesByPeriod[periodKey] = {
            id: rate.id,
            ratePerM3: rate.ratePerM3,
            ratePerM: rate.ratePerM,
          };
        });
        
        return {
          ...timber,
          ratesByPeriod,
        };
      });
      
      res.json({
        supplier: supplierData[0],
        timberSizes: timberSizesWithRates,
        periods,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch supplier detail" });
    }
  });

  // Supplier rates routes
  app.get("/api/supplier-rates/history", async (req, res) => {
    try {
      // Get timber rates
      const timberRates = await db
        .select({
          rate: supplierRates,
          supplier: suppliers,
          timberSize: timberSizes,
        })
        .from(supplierRates)
        .innerJoin(suppliers, eq(supplierRates.supplierId, suppliers.id))
        .innerJoin(timberSizes, eq(supplierRates.timberSizeId, timberSizes.id))
        .where(isNotNull(supplierRates.timberSizeId))
        .orderBy(desc(supplierRates.year), desc(supplierRates.month));

      // Return timber rates only
      const result = timberRates.map((r) => ({
        ...r.rate,
        supplier: r.supplier,
        timberSize: r.timberSize,
      }));

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rate history" });
    }
  });

  app.post("/api/supplier-rates", async (req, res) => {
    try {
      const data = insertSupplierRateSchema.parse(req.body);
      
      // Check for previous rate from same supplier for this timber size
      const previousRates = await db
        .select()
        .from(supplierRates)
        .where(
          and(
            eq(supplierRates.supplierId, data.supplierId),
            eq(supplierRates.timberSizeId, data.timberSizeId)
          )
        )
        .orderBy(desc(supplierRates.year), desc(supplierRates.month))
        .limit(1);
      
      const rate = await storage.createSupplierRate(data);
        
        // Calculate price change if there was a previous rate
        let priceChange: { percentage: number; previous: number; new: number } | null = null;
        if (previousRates.length > 0 && previousRates[0].ratePerM) {
          const previousRate = parseFloat(previousRates[0].ratePerM);
          const newRate = parseFloat(rate.ratePerM || '0');
          
          if (previousRate !== 0) {
            const percentage = ((newRate - previousRate) / previousRate) * 100;
            priceChange = {
              percentage,
              previous: previousRate,
              new: newRate,
            };
          }
        }
        
        // Update system rate for the timber size
        const rates = await storage.getSupplierRatesByTimberSize(data.timberSizeId);
        const allSuppliers = await storage.getSuppliers();
        const supplierMap = new Map(allSuppliers.map(s => [s.id, s]));
        
        // Get latest rate per supplier (across all periods)
        const latestRatesMap = new Map<string, { year: number; month: number; ratePerM: number; includeInMarket: boolean }>();
        
        rates.forEach((r) => {
          if (!r.ratePerM) return;
          const supplier = supplierMap.get(r.supplierId);
          
          const existing = latestRatesMap.get(r.supplierId);
          const isNewer = !existing || 
            r.year > existing.year || 
            (r.year === existing.year && r.month > existing.month);
            
          if (isNewer) {
            latestRatesMap.set(r.supplierId, {
              year: r.year,
              month: r.month,
              ratePerM: parseFloat(r.ratePerM),
              includeInMarket: supplier?.includeInMarket ?? true,
            });
          }
        });
        
        // Add the newly submitted rate to the map (must include in market calculations)
        if (rate.ratePerM) {
          const supplier = supplierMap.get(data.supplierId);
          const existing = latestRatesMap.get(data.supplierId);
          const isNewer = !existing || 
            data.year > existing.year || 
            (data.year === existing.year && data.month > existing.month);
            
          if (isNewer) {
            latestRatesMap.set(data.supplierId, {
              year: data.year,
              month: data.month,
              ratePerM: parseFloat(rate.ratePerM),
              includeInMarket: supplier?.includeInMarket ?? true,
            });
          }
        }

        // Find the absolute latest period including the submitted period
        const allLatestPeriods = Array.from(latestRatesMap.values());
        const submittedPeriod = { year: data.year, month: data.month };
        const periodsToCompare = [...allLatestPeriods, submittedPeriod];
        
        const trulyLatestPeriod = periodsToCompare.reduce((latest, current) => {
          if (current.year > latest.year || 
              (current.year === latest.year && current.month > latest.month)) {
            return { year: current.year, month: current.month };
          }
          return latest;
        }, periodsToCompare[0]);
        
        // Calculate market statistics from latest rates
        const marketRates = Array.from(latestRatesMap.values())
          .filter(r => r.includeInMarket)
          .map(r => r.ratePerM);
        
        // Calculate market stats (or use null if no suppliers included in market)
        const marketLow = marketRates.length > 0 ? Math.min(...marketRates) : null;
        const marketHigh = marketRates.length > 0 ? Math.max(...marketRates) : null;
        const marketAvg = marketRates.length > 0
          ? marketRates.reduce((a, b) => a + b, 0) / marketRates.length
          : null;
        
        // Calculate system rate (use marketAvg if available, otherwise null)
        let systemRate: number | null = null;
        if (marketAvg !== null) {
          const timber = await storage.getTimberSize(data.timberSizeId);
          const bufferPercentage = timber?.bufferPercentage
            ? parseFloat(timber.bufferPercentage)
            : 10;
          systemRate = marketAvg * (1 + bufferPercentage / 100);
        }

        // Always persist system pricing history for submitted period (even if no market data)
        const existingHistory = await db
          .select()
          .from(systemPricingHistory)
          .where(
            and(
              eq(systemPricingHistory.timberSizeId, data.timberSizeId),
              eq(systemPricingHistory.year, data.year),
              eq(systemPricingHistory.month, data.month)
            )
          )
          .limit(1);
        
        if (existingHistory.length > 0) {
          // Update existing history record for this period
          await db
            .update(systemPricingHistory)
            .set({
              systemRate: systemRate !== null ? systemRate.toString() : null,
              marketLow: marketLow !== null ? marketLow.toString() : null,
              marketAvg: marketAvg !== null ? marketAvg.toString() : null,
              marketHigh: marketHigh !== null ? marketHigh.toString() : null,
            })
            .where(eq(systemPricingHistory.id, existingHistory[0].id));
        } else {
          // Insert new history record for this period
          await db.insert(systemPricingHistory).values({
            timberSizeId: data.timberSizeId,
            systemRate: systemRate !== null ? systemRate.toString() : null,
            marketLow: marketLow !== null ? marketLow.toString() : null,
            marketAvg: marketAvg !== null ? marketAvg.toString() : null,
            marketHigh: marketHigh !== null ? marketHigh.toString() : null,
            year: data.year,
            month: data.month,
          });
        }
        
        // Only update current timber system rate if submitted period is the truly latest period and we have market data
        const isNewestPeriod = data.year === trulyLatestPeriod.year && data.month === trulyLatestPeriod.month;
        
        if (isNewestPeriod && systemRate !== null) {
          await db
            .update(timberSizes)
            .set({ systemRate: systemRate.toString() })
            .where(eq(timberSizes.id, data.timberSizeId));
        }

        res.json({ ...rate, priceChange });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid data" });
    }
  });

  app.post("/api/supplier-rates/bulk", async (req, res) => {
    try {
      const { rates } = req.body;
      
      if (!Array.isArray(rates) || rates.length === 0) {
        return res.status(400).json({ error: "Invalid rates array" });
      }

      // Validate all rates
      const validatedRates = rates.map(rate => insertSupplierRateSchema.parse(rate));
      
      // Insert all rates
      const createdRates = await Promise.all(
        validatedRates.map(rate => storage.createSupplierRate(rate))
      );

      // Update system rates for affected timber sizes
      const uniqueTimberSizeIds = Array.from(new Set(validatedRates.map(r => r.timberSizeId)));
      
      for (const timberSizeId of uniqueTimberSizeIds) {
        if (!timberSizeId) continue;
        
        const rates = await storage.getSupplierRatesByTimberSize(timberSizeId);
        
        // Get current rates (latest for each supplier for this timber size)
        const latestRatesMap = new Map<string, { year: number; month: number; ratePerM: number }>();
        rates.forEach((r) => {
          if (!r.ratePerM) return;
          const existing = latestRatesMap.get(r.supplierId);
          if (!existing || r.year > existing.year || 
              (r.year === existing.year && r.month > existing.month)) {
            latestRatesMap.set(r.supplierId, {
              year: r.year,
              month: r.month,
              ratePerM: parseFloat(r.ratePerM),
            });
          }
        });

        const currentRates = Array.from(latestRatesMap.values()).map(r => r.ratePerM);
        
        if (currentRates.length > 0) {
          const average = currentRates.reduce((a, b) => a + b, 0) / currentRates.length;
          const timber = await storage.getTimberSize(timberSizeId);
          const bufferPercentage = timber?.bufferPercentage
            ? parseFloat(timber.bufferPercentage)
            : 10;
          const systemRate = average * (1 + bufferPercentage / 100);

          await db
            .update(timberSizes)
            .set({ systemRate: systemRate.toString() })
            .where(eq(timberSizes.id, timberSizeId));
        }
      }

      res.json({ success: true, count: createdRates.length });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid data" });
    }
  });

  // Update individual supplier rate (timber-only)
  app.put("/api/supplier-rates/:id", async (req, res) => {
    try {
      const rateId = req.params.id;
      const { ratePerM3 } = req.body;
      
      if (!ratePerM3 || isNaN(parseFloat(ratePerM3))) {
        return res.status(400).json({ error: "Invalid rate value" });
      }

      // Get the existing rate to find the timber size
      const existingRate = await db
        .select()
        .from(supplierRates)
        .where(eq(supplierRates.id, rateId))
        .limit(1);
      
      if (existingRate.length === 0 || !existingRate[0].timberSizeId) {
        return res.status(404).json({ error: "Timber rate not found" });
      }

      // Get timber dimensions to calculate rate per meter
      const timberData = await db
        .select()
        .from(timberSizes)
        .where(eq(timberSizes.id, existingRate[0].timberSizeId))
        .limit(1);
      
      if (timberData.length === 0) {
        return res.status(404).json({ error: "Timber size not found" });
      }

      const timber = timberData[0];
      const thicknessMm = Number(timber.thickness);
      const widthMm = Number(timber.width);
      
      let ratePerM = "0";
      if (isFinite(thicknessMm) && isFinite(widthMm) && thicknessMm > 0 && widthMm > 0) {
        const ratePerMeter = parseFloat(ratePerM3) * (thicknessMm / 1000) * (widthMm / 1000);
        if (isFinite(ratePerMeter) && ratePerMeter > 0) {
          ratePerM = ratePerMeter.toFixed(2);
        }
      }

      // Update the rate
      const updatedRate = await db
        .update(supplierRates)
        .set({
          ratePerM3: ratePerM3,
          ratePerM: ratePerM,
        })
        .where(eq(supplierRates.id, rateId))
        .returning();

      res.json(updatedRate[0]);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update rate" });
    }
  });

  // Export endpoints
  app.get("/api/export/timber-sizes", async (req, res) => {
    try {
      const sizes = await storage.getTimberSizes();
      
      const exportData = sizes.map(size => ({
        'Thickness (mm)': size.thickness,
        'Width (mm)': size.width,
        'Length Min (m)': size.lengthMin,
        'Length Max (m)': size.lengthMax,
        'Classification': size.classification,
        'Grade': size.grade,
        'M³ Factor': size.m3Factor,
        'System Rate (R/m)': size.systemRate || 'N/A',
        'Buffer %': size.bufferPercentage || '10',
      }));

      const format = req.query.format as string || 'xlsx';
      
      if (format === 'csv') {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=timber-sizes.csv');
        res.send(csv);
      } else {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Timber Sizes');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=timber-sizes.xlsx');
        res.send(buffer);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to export timber sizes" });
    }
  });

  app.get("/api/export/supplier-rates", async (req, res) => {
    try {
      const allRates = await db
        .select({
          rate: supplierRates,
          supplier: suppliers,
          timberSize: timberSizes,
        })
        .from(supplierRates)
        .innerJoin(suppliers, eq(supplierRates.supplierId, suppliers.id))
        .innerJoin(timberSizes, eq(supplierRates.timberSizeId, timberSizes.id))
        .orderBy(desc(supplierRates.year), desc(supplierRates.month));

      const exportData = allRates.map(item => ({
        'Supplier': item.supplier.name,
        'Timber Size': `${item.timberSize.thickness}x${item.timberSize.width}`,
        'Classification': item.timberSize.classification,
        'Grade': item.timberSize.grade,
        'Year': item.rate.year,
        'Month': item.rate.month,
        'Rate per M³ (R)': item.rate.ratePerM3,
        'Rate per M (R)': item.rate.ratePerM,
      }));

      const format = req.query.format as string || 'xlsx';
      
      if (format === 'csv') {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=supplier-rates.csv');
        res.send(csv);
      } else {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Supplier Rates');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=supplier-rates.xlsx');
        res.send(buffer);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to export supplier rates" });
    }
  });

  // Price trends endpoint
  app.get("/api/price-trends/:timberSizeId", async (req, res) => {
    try {
      const rates = await db
        .select({
          rate: supplierRates,
          supplier: suppliers,
        })
        .from(supplierRates)
        .innerJoin(suppliers, eq(supplierRates.supplierId, suppliers.id))
        .where(
          and(
            eq(supplierRates.timberSizeId, req.params.timberSizeId),
            isNotNull(supplierRates.timberSizeId)
          )
        )
        .orderBy(supplierRates.year, supplierRates.month, suppliers.name);

      const trendData = rates
        .filter(r => r.rate.ratePerM && r.rate.ratePerM3)
        .map((r) => ({
          date: `${r.rate.year}-${String(r.rate.month).padStart(2, '0')}`,
          year: r.rate.year,
          month: r.rate.month,
          supplierId: r.rate.supplierId,
          supplierName: r.supplier.name,
          ratePerM: parseFloat(r.rate.ratePerM!),
          ratePerM3: parseFloat(r.rate.ratePerM3!),
        }));

      res.json(trendData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch price trends" });
    }
  });

  app.get("/api/export/pricing-report", async (req, res) => {
    try {
      const format = req.query.format as string || 'xlsx';
      const period = req.query.period as string;
      const selectedSupplierIdsParam = req.query.selectedSupplierIds as string;
      
      const sizes = await storage.getTimberSizes();
      const allSuppliers = await storage.getSuppliers();
      
      const reportData = [];
      
      // Check if this is for a historical period
      const isHistorical = period && period !== 'current';
      
      if (isHistorical) {
        // Historical report - just show system rates for that period
        const [year, month] = period.split('-');
        const historicalRates = await db
          .select({
            id: systemPricingHistory.id,
            timberSizeId: systemPricingHistory.timberSizeId,
            systemRate: systemPricingHistory.systemRate,
            year: systemPricingHistory.year,
            month: systemPricingHistory.month,
            timberSize: timberSizes,
          })
          .from(systemPricingHistory)
          .innerJoin(timberSizes, eq(systemPricingHistory.timberSizeId, timberSizes.id))
          .where(and(
            eq(systemPricingHistory.year, parseInt(year)),
            eq(systemPricingHistory.month, parseInt(month))
          ));
        
        for (const item of historicalRates) {
          reportData.push({
            'Timber Size': `${item.timberSize.thickness}×${item.timberSize.width}mm`,
            'Classification': item.timberSize.classification,
            'Grade': item.timberSize.grade,
            'System Rate (R/m³)': item.systemRate ? parseFloat(item.systemRate).toFixed(2) : 'N/A',
          });
        }
      } else {
        // Current period report - include market data and % difference
        const selectedSupplierIds = selectedSupplierIdsParam 
          ? selectedSupplierIdsParam.split(',').filter(id => id.trim())
          : null;
        
        const filteredSuppliers = selectedSupplierIds 
          ? allSuppliers.filter(s => selectedSupplierIds.includes(s.id))
          : allSuppliers.filter(s => s.includeInMarket);
        
        const filteredSupplierIds = new Set(filteredSuppliers.map(s => s.id));
        
        const currentDate = new Date();
        const threeMonthsAgo = new Date(currentDate);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        for (const size of sizes) {
          const rates = await storage.getSupplierRatesByTimberSize(size.id);
          
          const latestRatesMap = new Map<string, { supplierId: string; supplierName: string; ratePerM3: number; year: number; month: number }>();
          
          for (const r of rates) {
            if (!filteredSupplierIds.has(r.supplierId) || !r.ratePerM3) {
              continue;
            }
            
            const rateDate = new Date(r.year, r.month - 1);
            if (rateDate >= threeMonthsAgo) {
              const supplier = allSuppliers.find(s => s.id === r.supplierId);
              const existing = latestRatesMap.get(r.supplierId);
              
              if (!existing || r.year > existing.year || 
                  (r.year === existing.year && r.month > existing.month)) {
                latestRatesMap.set(r.supplierId, {
                  supplierId: r.supplierId,
                  supplierName: supplier?.name || 'Unknown',
                  ratePerM3: parseFloat(r.ratePerM3),
                  year: r.year,
                  month: r.month,
                });
              }
            }
          }
          
          const supplierRates = Array.from(latestRatesMap.values());
          
          // Convert rates from R/m³ to R/m
          const thicknessMm = Number(size.thickness);
          const widthMm = Number(size.width);
          
          let lowest = null;
          let average = null;
          let highest = null;
          
          if (isFinite(thicknessMm) && isFinite(widthMm) && thicknessMm > 0 && widthMm > 0) {
            const ratePerMeterValues = supplierRates
              .map(r => {
                const ratePerMeter = r.ratePerM3 * (thicknessMm / 1000) * (widthMm / 1000);
                return isFinite(ratePerMeter) && ratePerMeter > 0 ? ratePerMeter : null;
              })
              .filter((rate): rate is number => rate !== null);
            
            if (ratePerMeterValues.length > 0) {
              lowest = Math.min(...ratePerMeterValues);
              highest = Math.max(...ratePerMeterValues);
              average = ratePerMeterValues.reduce((a, b) => a + b, 0) / ratePerMeterValues.length;
            }
          }
          
          const systemRate = parseFloat(size.systemRate || '0');
          
          // Calculate % difference: ((systemRate - marketHigh) / marketHigh) * 100
          let percentDiff = null;
          if (highest !== null && highest > 0 && isFinite(highest)) {
            const diff = ((systemRate - highest) / highest) * 100;
            percentDiff = isFinite(diff) ? diff : null;
          }
          
          reportData.push({
            'Timber Size': `${size.thickness}×${size.width}mm`,
            'Classification': size.classification,
            'Grade': size.grade,
            'Market Low (R/m)': lowest !== null ? lowest.toFixed(2) : 'N/A',
            'Market Avg (R/m)': average !== null ? average.toFixed(2) : 'N/A',
            'Market High (R/m)': highest !== null ? highest.toFixed(2) : 'N/A',
            'System Rate (R/m³)': systemRate.toFixed(2),
            '% Diff vs Market High': percentDiff !== null ? percentDiff.toFixed(1) + '%' : 'N/A',
          });
        }
      }

      if (format === 'csv') {
        const worksheet = XLSX.utils.json_to_sheet(reportData);
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=pricing-report.csv');
        res.send(csv);
      } else if (format === 'pdf') {
        // PDF export
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=pricing-report.pdf');
        
        doc.pipe(res);
        
        // Title
        doc.fontSize(18).font('Helvetica-Bold').text('Timber Pricing Report', { align: 'center' });
        doc.moveDown(0.5);
        
        // Period info
        if (isHistorical) {
          const [year, month] = period.split('-');
          const periodDate = new Date(parseInt(year), parseInt(month) - 1);
          const periodLabel = periodDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          });
          doc.fontSize(10).font('Helvetica').text(`Period: ${periodLabel}`, { align: 'center' });
        } else {
          doc.fontSize(10).font('Helvetica').text('Period: Current Rates', { align: 'center' });
        }
        
        doc.moveDown(1);
        
        // Table header
        const tableTop = doc.y;
        const colWidths = isHistorical 
          ? [150, 100, 80, 100] // Timber, Classification, Grade, System Rate
          : [120, 70, 50, 60, 60, 60, 65, 80]; // All columns for current
        
        doc.fontSize(9).font('Helvetica-Bold');
        
        if (isHistorical) {
          doc.text('Timber Size', 50, tableTop, { width: colWidths[0], align: 'left' });
          doc.text('Classification', 200, tableTop, { width: colWidths[1], align: 'left' });
          doc.text('Grade', 300, tableTop, { width: colWidths[2], align: 'left' });
          doc.text('System Rate', 380, tableTop, { width: colWidths[3], align: 'right' });
        } else {
          let xPos = 50;
          const headers = ['Timber Size', 'Class.', 'Grade', 'Low', 'Avg', 'High', 'System', '% Diff'];
          headers.forEach((header, i) => {
            doc.text(header, xPos, tableTop, { width: colWidths[i], align: i > 2 ? 'right' : 'left' });
            xPos += colWidths[i];
          });
        }
        
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.3);
        
        // Table rows
        doc.fontSize(8).font('Helvetica');
        
        reportData.forEach((row, index) => {
          if (doc.y > 700) {
            doc.addPage();
            doc.y = 50;
          }
          
          const rowY = doc.y;
          
          if (isHistorical) {
            doc.text(row['Timber Size'], 50, rowY, { width: colWidths[0] });
            doc.text(row['Classification'], 200, rowY, { width: colWidths[1] });
            doc.text(row['Grade'], 300, rowY, { width: colWidths[2] });
            doc.text(row['System Rate (R/m³)'], 380, rowY, { width: colWidths[3], align: 'right' });
          } else {
            let xPos = 50;
            doc.text(row['Timber Size'] || '', xPos, rowY, { width: colWidths[0] });
            xPos += colWidths[0];
            doc.text(row['Classification'] || '', xPos, rowY, { width: colWidths[1] });
            xPos += colWidths[1];
            doc.text(row['Grade'] || '', xPos, rowY, { width: colWidths[2] });
            xPos += colWidths[2];
            doc.text(row['Market Low (R/m)'] || '', xPos, rowY, { width: colWidths[3], align: 'right' });
            xPos += colWidths[3];
            doc.text(row['Market Avg (R/m)'] || '', xPos, rowY, { width: colWidths[4], align: 'right' });
            xPos += colWidths[4];
            doc.text(row['Market High (R/m)'] || '', xPos, rowY, { width: colWidths[5], align: 'right' });
            xPos += colWidths[5];
            doc.text(row['System Rate (R/m³)'] || '', xPos, rowY, { width: colWidths[6], align: 'right' });
            xPos += colWidths[6];
            doc.text(row['% Diff vs Market High'] || '', xPos, rowY, { width: colWidths[7], align: 'right' });
          }
          
          doc.moveDown(0.7);
          
          if (index % 5 === 4) {
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
            doc.moveDown(0.3);
          }
        });
        
        doc.end();
      } else {
        const worksheet = XLSX.utils.json_to_sheet(reportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Pricing Report');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=pricing-report.xlsx');
        res.send(buffer);
      }
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: "Failed to export pricing report" });
    }
  });

  // Get historical system pricing periods
  app.get("/api/system-pricing/history/periods", async (req, res) => {
    try {
      const periods = await db
        .selectDistinct({
          year: systemPricingHistory.year,
          month: systemPricingHistory.month,
        })
        .from(systemPricingHistory)
        .orderBy(desc(systemPricingHistory.year), desc(systemPricingHistory.month));
      
      res.json(periods);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch historical periods" });
    }
  });

  // Get historical system pricing for a specific period
  app.get("/api/system-pricing/history/:year/:month", async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      const historicalRates = await db
        .select({
          id: systemPricingHistory.id,
          timberSizeId: systemPricingHistory.timberSizeId,
          systemRate: systemPricingHistory.systemRate,
          year: systemPricingHistory.year,
          month: systemPricingHistory.month,
          timberSize: timberSizes,
        })
        .from(systemPricingHistory)
        .innerJoin(timberSizes, eq(systemPricingHistory.timberSizeId, timberSizes.id))
        .where(and(
          eq(systemPricingHistory.year, year),
          eq(systemPricingHistory.month, month)
        ));
      
      res.json(historicalRates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch historical system pricing" });
    }
  });

  // Get system pricing data for Add New System Pricing dialog
  app.get("/api/system-pricing/data", async (req, res) => {
    try {
      const sizes = await storage.getTimberSizes();
      const allSuppliers = await storage.getSuppliers();
      
      // Get selected supplier IDs from query parameter (comma-separated)
      const selectedSupplierIdsParam = req.query.selectedSupplierIds as string;
      const selectedSupplierIds = selectedSupplierIdsParam 
        ? selectedSupplierIdsParam.split(',').filter(id => id.trim())
        : null;
      
      // Filter suppliers based on selection or includeInMarket flag
      const filteredSuppliers = selectedSupplierIds 
        ? allSuppliers.filter(s => selectedSupplierIds.includes(s.id))
        : allSuppliers.filter(s => s.includeInMarket);
      
      const filteredSupplierIds = new Set(filteredSuppliers.map(s => s.id));
      
      const currentDate = new Date();
      const threeMonthsAgo = new Date(currentDate);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const pricingData = [];
      
      for (const size of sizes) {
        const rates = await storage.getSupplierRatesByTimberSize(size.id);
        
        // Filter rates from last 3 months and get latest rate per supplier
        const latestRatesMap = new Map<string, { supplierId: string; supplierName: string; ratePerM3: number; year: number; month: number }>();
        
        for (const r of rates) {
          // Skip if supplier is not in the filtered set or if ratePerM3 is null
          if (!filteredSupplierIds.has(r.supplierId) || !r.ratePerM3) {
            continue;
          }
          
          const rateDate = new Date(r.year, r.month - 1);
          if (rateDate >= threeMonthsAgo) {
            const supplier = allSuppliers.find(s => s.id === r.supplierId);
            const existing = latestRatesMap.get(r.supplierId);
            
            if (!existing || r.year > existing.year || 
                (r.year === existing.year && r.month > existing.month)) {
              latestRatesMap.set(r.supplierId, {
                supplierId: r.supplierId,
                supplierName: supplier?.name || 'Unknown',
                ratePerM3: parseFloat(r.ratePerM3),
                year: r.year,
                month: r.month,
              });
            }
          }
        }
        
        const supplierRates = Array.from(latestRatesMap.values());
        
        // Convert rates from R/m³ to R/m (rate per meter)
        const thicknessMm = Number(size.thickness);
        const widthMm = Number(size.width);
        
        let lowest = null;
        let average = null;
        let highest = null;
        
        // Validate dimensions before conversion - skip if invalid
        if (!isFinite(thicknessMm) || !isFinite(widthMm) || thicknessMm <= 0 || widthMm <= 0) {
          console.warn(`Skipping rate conversion for timber size ${size.id}: invalid dimensions (thickness=${size.thickness}, width=${size.width})`);
        } else {
          // Only convert if dimensions are valid
          const ratePerMeterValues = supplierRates
            .map(r => {
              // Formula: ratePerM³ × (thickness/1000) × (width/1000) = rate per meter
              const ratePerMeter = r.ratePerM3 * (thicknessMm / 1000) * (widthMm / 1000);
              return isFinite(ratePerMeter) && ratePerMeter > 0 ? ratePerMeter : null;
            })
            .filter((rate): rate is number => rate !== null);
          
          if (ratePerMeterValues.length > 0) {
            lowest = Math.min(...ratePerMeterValues);
            highest = Math.max(...ratePerMeterValues);
            average = ratePerMeterValues.reduce((a, b) => a + b, 0) / ratePerMeterValues.length;
          }
        }
        
        pricingData.push({
          timberSize: size,
          supplierRates,
          lowest,
          average,
          highest,
        });
      }
      
      res.json(pricingData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch system pricing data" });
    }
  });

  // Save new system pricing
  app.post("/api/system-pricing/save", async (req, res) => {
    try {
      const { pricingUpdates, year, month } = req.body;
      
      // Archive current system rates and update with new ones
      for (const update of pricingUpdates) {
        const { timberSizeId, newSystemRate } = update;
        
        // Get current system rate
        const [currentSize] = await db
          .select()
          .from(timberSizes)
          .where(eq(timberSizes.id, timberSizeId));
        
        // Archive current rate if it exists
        if (currentSize.systemRate) {
          await db.insert(systemPricingHistory).values({
            timberSizeId,
            systemRate: currentSize.systemRate,
            year,
            month,
          });
        }
        
        // Update to new system rate
        await db
          .update(timberSizes)
          .set({ systemRate: newSystemRate.toString() })
          .where(eq(timberSizes.id, timberSizeId));
      }
      
      res.json({ success: true, count: pricingUpdates.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to save system pricing" });
    }
  });

  // ===== STOCK MODULE API ENDPOINTS =====
  
  // Get all stock items
  app.get("/api/stock", async (req, res) => {
    try {
      const items = await storage.getStockItems();
      res.json(items);
    } catch (error) {
      console.error('Stock fetch error:', error);
      res.status(500).json({ error: "Failed to fetch stock items" });
    }
  });
  
  // Search stock items across all fields including properties with AND logic
  app.get("/api/stock/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.json([]);
      }
      
      // Normalize and split search query into individual terms
      const searchTerms = q.toLowerCase().trim().split(/\s+/).filter(term => term.length > 0);
      if (searchTerms.length === 0) {
        return res.json([]);
      }
      
      const { stock, stockProperties } = await import("@shared/schema");
      const { ilike, or, and, exists, eq } = await import("drizzle-orm");
      
      // Build AND logic: each term must be present somewhere in the record
      // For each term, create an OR predicate across all searchable fields
      const termPredicates = searchTerms.map(term => {
        const pattern = `%${term}%`;
        
        // Each term must match at least one of: productCode, partcode, description, notes, itemHierarchy, OR any property value
        return or(
          ilike(stock.productCode, pattern),
          ilike(stock.partcode, pattern),
          ilike(stock.description, pattern),
          ilike(stock.notes, pattern),
          ilike(stock.itemHierarchy, pattern),
          // Check if this term exists in any property value for this stock item
          exists(
            db.select()
              .from(stockProperties)
              .where(
                and(
                  eq(stockProperties.stockId, stock.id),
                  ilike(stockProperties.value, pattern)
                )
              )
          )
        );
      });
      
      // Combine all term predicates with AND - ALL terms must be satisfied
      const results = await db
        .select()
        .from(stock)
        .where(and(...termPredicates))
        .orderBy(stock.productCode)
        .limit(100);
      
      res.json(results);
    } catch (error) {
      console.error('Stock search error:', error);
      res.status(500).json({ error: "Failed to search stock items" });
    }
  });
  
  // LOOKUPS ROUTES - Must come before /:id routes to avoid parameter matching
  app.get("/api/stock/lookups/colours", async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      console.log('[COLOURS DEBUG] Starting query...');
      const result = await pool.query('SELECT * FROM stock_colours ORDER BY name');
      console.log('[COLOURS DEBUG] Query complete. Rows:', result.rowCount, 'First row:', result.rows[0]);
      res.json(result.rows);
    } catch (error: any) {
      console.error('[COLOURS DEBUG] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get all lookup tables
  app.get("/api/stock/lookups/relations", async (req, res) => {
    try {
      const { stockRelations } = await import("@shared/schema");
      const data = await db.select().from(stockRelations);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch relations" });
    }
  });
  
  app.get("/api/stock/lookups/behaviours", async (req, res) => {
    try {
      const { stockBehaviours } = await import("@shared/schema");
      const data = await db.select().from(stockBehaviours);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch behaviours" });
    }
  });
  
  app.get("/api/stock/lookups/types", async (req, res) => {
    try {
      const { stockTypes } = await import("@shared/schema");
      const data = await db.select().from(stockTypes);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch types" });
    }
  });
  
  app.get("/api/stock/lookups/uoms", async (req, res) => {
    try {
      const { stockUoms } = await import("@shared/schema");
      const data = await db.select().from(stockUoms);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch UOMs" });
    }
  });
  
  app.get("/api/stock/lookups/variants", async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      const result = await pool.query('SELECT * FROM stock_variants ORDER BY name');
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch variants" });
    }
  });
  
  app.get("/api/stock/lookups/markup-groups", async (req, res) => {
    try {
      const { stockMarkupGroups } = await import("@shared/schema");
      const data = await db.select().from(stockMarkupGroups);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch markup groups" });
    }
  });
  
  app.get("/api/stock/lookups/discount-groups", async (req, res) => {
    try {
      const { stockDiscountGroups } = await import("@shared/schema");
      const data = await db.select().from(stockDiscountGroups);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch discount groups" });
    }
  });

  app.get("/api/stock/lookups/margin-groups", async (req, res) => {
    try {
      const { stockMarginGroups } = await import("@shared/schema");
      const data = await db.select().from(stockMarginGroups);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch margin groups" });
    }
  });

  app.get("/api/stock/lookups/tallies", async (req, res) => {
    try {
      const { stockTallies } = await import("@shared/schema");
      const data = await db.select().from(stockTallies);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tallies" });
    }
  });
  
  app.get("/api/stock/lookups/property-definitions", async (req, res) => {
    try {
      const { stockPropertyDefinitions } = await import("@shared/schema");
      const data = await db.select().from(stockPropertyDefinitions);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch property definitions" });
    }
  });

  // CRUD endpoints for Relations
  app.post("/api/stock/lookups/relations", async (req, res) => {
    try {
      const { stockRelations, insertStockRelationSchema } = await import("@shared/schema");
      const data = insertStockRelationSchema.parse(req.body);
      const [result] = await db.insert(stockRelations).values(data).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/stock/lookups/relations/:id", async (req, res) => {
    try {
      const { stockRelations, insertStockRelationSchema } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const data = insertStockRelationSchema.partial().parse(req.body);
      const [result] = await db.update(stockRelations).set(data).where(eq(stockRelations.id, req.params.id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/stock/lookups/relations/:id", async (req, res) => {
    try {
      const { stockRelations } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(stockRelations).where(eq(stockRelations.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // CRUD endpoints for Behaviours
  app.post("/api/stock/lookups/behaviours", async (req, res) => {
    try {
      const { stockBehaviours, insertStockBehaviourSchema } = await import("@shared/schema");
      const data = insertStockBehaviourSchema.parse(req.body);
      const [result] = await db.insert(stockBehaviours).values(data).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/stock/lookups/behaviours/:id", async (req, res) => {
    try {
      const { stockBehaviours, insertStockBehaviourSchema } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const data = insertStockBehaviourSchema.partial().parse(req.body);
      const [result] = await db.update(stockBehaviours).set(data).where(eq(stockBehaviours.id, req.params.id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/stock/lookups/behaviours/:id", async (req, res) => {
    try {
      const { stockBehaviours } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(stockBehaviours).where(eq(stockBehaviours.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // CRUD endpoints for Types
  app.post("/api/stock/lookups/types", async (req, res) => {
    try {
      const { stockTypes, insertStockTypeSchema } = await import("@shared/schema");
      const data = insertStockTypeSchema.parse(req.body);
      const [result] = await db.insert(stockTypes).values(data).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/stock/lookups/types/:id", async (req, res) => {
    try {
      const { stockTypes, insertStockTypeSchema } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const data = insertStockTypeSchema.partial().parse(req.body);
      const [result] = await db.update(stockTypes).set(data).where(eq(stockTypes.id, req.params.id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/stock/lookups/types/:id", async (req, res) => {
    try {
      const { stockTypes } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(stockTypes).where(eq(stockTypes.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // CRUD endpoints for UOMs
  app.post("/api/stock/lookups/uoms", async (req, res) => {
    try {
      const { stockUoms, insertStockUomSchema } = await import("@shared/schema");
      const data = insertStockUomSchema.parse(req.body);
      const [result] = await db.insert(stockUoms).values(data).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/stock/lookups/uoms/:id", async (req, res) => {
    try {
      const { stockUoms, insertStockUomSchema } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const data = insertStockUomSchema.partial().parse(req.body);
      const [result] = await db.update(stockUoms).set(data).where(eq(stockUoms.id, req.params.id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/stock/lookups/uoms/:id", async (req, res) => {
    try {
      const { stockUoms } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(stockUoms).where(eq(stockUoms.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // CRUD endpoints for Colours
  app.post("/api/stock/lookups/colours", async (req, res) => {
    try {
      const { stockColours, insertStockColourSchema } = await import("@shared/schema");
      const data = insertStockColourSchema.parse(req.body);
      const [result] = await db.insert(stockColours).values(data).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/stock/lookups/colours/:id", async (req, res) => {
    try {
      const { stockColours, insertStockColourSchema } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const data = insertStockColourSchema.partial().parse(req.body);
      const [result] = await db.update(stockColours).set(data).where(eq(stockColours.id, req.params.id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/stock/lookups/colours/:id", async (req, res) => {
    try {
      const { stockColours } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(stockColours).where(eq(stockColours.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // CRUD endpoints for Variants
  app.post("/api/stock/lookups/variants", async (req, res) => {
    try {
      const { stockVariants, insertStockVariantSchema } = await import("@shared/schema");
      const data = insertStockVariantSchema.parse(req.body);
      const [result] = await db.insert(stockVariants).values(data).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/stock/lookups/variants/:id", async (req, res) => {
    try {
      const { stockVariants, insertStockVariantSchema } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const data = insertStockVariantSchema.partial().parse(req.body);
      const [result] = await db.update(stockVariants).set(data).where(eq(stockVariants.id, req.params.id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/stock/lookups/variants/:id", async (req, res) => {
    try {
      const { stockVariants } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(stockVariants).where(eq(stockVariants.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // CRUD endpoints for Markup Groups
  app.post("/api/stock/lookups/markup-groups", async (req, res) => {
    try {
      const { stockMarkupGroups, insertStockMarkupGroupSchema } = await import("@shared/schema");
      const data = insertStockMarkupGroupSchema.parse(req.body);
      const [result] = await db.insert(stockMarkupGroups).values(data).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/stock/lookups/markup-groups/:id", async (req, res) => {
    try {
      const { stockMarkupGroups, insertStockMarkupGroupSchema } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const data = insertStockMarkupGroupSchema.partial().parse(req.body);
      const [result] = await db.update(stockMarkupGroups).set(data).where(eq(stockMarkupGroups.id, req.params.id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/stock/lookups/markup-groups/:id", async (req, res) => {
    try {
      const { stockMarkupGroups } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(stockMarkupGroups).where(eq(stockMarkupGroups.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // CRUD endpoints for Discount Groups
  app.post("/api/stock/lookups/discount-groups", async (req, res) => {
    try {
      const { stockDiscountGroups, insertStockDiscountGroupSchema } = await import("@shared/schema");
      const data = insertStockDiscountGroupSchema.parse(req.body);
      const [result] = await db.insert(stockDiscountGroups).values(data).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/stock/lookups/discount-groups/:id", async (req, res) => {
    try {
      const { stockDiscountGroups, insertStockDiscountGroupSchema } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const data = insertStockDiscountGroupSchema.partial().parse(req.body);
      const [result] = await db.update(stockDiscountGroups).set(data).where(eq(stockDiscountGroups.id, req.params.id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/stock/lookups/discount-groups/:id", async (req, res) => {
    try {
      const { stockDiscountGroups } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(stockDiscountGroups).where(eq(stockDiscountGroups.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // CRUD endpoints for Margin Groups
  app.post("/api/stock/lookups/margin-groups", async (req, res) => {
    try {
      const { stockMarginGroups, insertStockMarginGroupSchema } = await import("@shared/schema");
      const data = insertStockMarginGroupSchema.parse(req.body);
      const [result] = await db.insert(stockMarginGroups).values(data).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/stock/lookups/margin-groups/:id", async (req, res) => {
    try {
      const { stockMarginGroups, insertStockMarginGroupSchema } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const data = insertStockMarginGroupSchema.partial().parse(req.body);
      const [result] = await db.update(stockMarginGroups).set(data).where(eq(stockMarginGroups.id, req.params.id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/stock/lookups/margin-groups/:id", async (req, res) => {
    try {
      const { stockMarginGroups } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(stockMarginGroups).where(eq(stockMarginGroups.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // CRUD endpoints for Tallies
  app.post("/api/stock/lookups/tallies", async (req, res) => {
    try {
      const { stockTallies, insertStockTallySchema } = await import("@shared/schema");
      const data = insertStockTallySchema.parse(req.body);
      const [result] = await db.insert(stockTallies).values(data).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/stock/lookups/tallies/:id", async (req, res) => {
    try {
      const { stockTallies, insertStockTallySchema } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const data = insertStockTallySchema.partial().parse(req.body);
      const [result] = await db.update(stockTallies).set(data).where(eq(stockTallies.id, req.params.id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/stock/lookups/tallies/:id", async (req, res) => {
    try {
      const { stockTallies } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(stockTallies).where(eq(stockTallies.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // CRUD endpoints for Property Definitions
  app.post("/api/stock/lookups/property-definitions", async (req, res) => {
    try {
      const { stockPropertyDefinitions, insertStockPropertyDefinitionSchema } = await import("@shared/schema");
      const data = insertStockPropertyDefinitionSchema.parse(req.body);
      const [result] = await db.insert(stockPropertyDefinitions).values(data).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/stock/lookups/property-definitions/:id", async (req, res) => {
    try {
      const { stockPropertyDefinitions, insertStockPropertyDefinitionSchema } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const data = insertStockPropertyDefinitionSchema.partial().parse(req.body);
      const [result] = await db.update(stockPropertyDefinitions).set(data).where(eq(stockPropertyDefinitions.id, req.params.id)).returning();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/stock/lookups/property-definitions/:id", async (req, res) => {
    try {
      const { stockPropertyDefinitions } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(stockPropertyDefinitions).where(eq(stockPropertyDefinitions.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // END LOOKUPS ROUTES
  
  // Get single stock item with full details including relationships
  app.get("/api/stock/:id", async (req, res) => {
    try {
      const item = await storage.getStockItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Stock item not found" });
      }
      
      // Get all lookup tables for relationships
      const { stockRelations, stockBehaviours, stockTypes, stockUoms, stockMarkupGroups, stockDiscountGroups, stockMarginGroups, suppliers, stockProperties, stockPropertyDefinitions, stockColourLinks, stockColours, stockVariantLinks, stockVariants, stockCompositeItems, stock, stockTallyItems, stockTallies } = await import("@shared/schema");
      
      // Get lookup entities
      let relation = null, behaviour = null, type = null, stockUnit = null, purchaseUnit = null, salesUnit = null;
      let manufacturer = null, markupGroup = null, discountGroup = null, marginGroup = null;
      
      if (item.relationId) {
        [relation] = await db.select().from(stockRelations).where(eq(stockRelations.id, item.relationId));
      }
      if (item.behaviourId) {
        [behaviour] = await db.select().from(stockBehaviours).where(eq(stockBehaviours.id, item.behaviourId));
      }
      if (item.typeId) {
        [type] = await db.select().from(stockTypes).where(eq(stockTypes.id, item.typeId));
      }
      if (item.stockUnitId) {
        [stockUnit] = await db.select().from(stockUoms).where(eq(stockUoms.id, item.stockUnitId));
      }
      if (item.purchaseUnitId) {
        [purchaseUnit] = await db.select().from(stockUoms).where(eq(stockUoms.id, item.purchaseUnitId));
      }
      if (item.salesUnitId) {
        [salesUnit] = await db.select().from(stockUoms).where(eq(stockUoms.id, item.salesUnitId));
      }
      if (item.primarySupplierId) {
        [manufacturer] = await db.select().from(suppliers).where(eq(suppliers.id, item.primarySupplierId));
      }
      if (item.markupGroupId) {
        [markupGroup] = await db.select().from(stockMarkupGroups).where(eq(stockMarkupGroups.id, item.markupGroupId));
      }
      if (item.discountGroupId) {
        [discountGroup] = await db.select().from(stockDiscountGroups).where(eq(stockDiscountGroups.id, item.discountGroupId));
      }
      if (item.marginGroupId) {
        [marginGroup] = await db.select().from(stockMarginGroups).where(eq(stockMarginGroups.id, item.marginGroupId));
      }
      
      // Get properties
      const properties = await db
        .select()
        .from(stockProperties)
        .where(eq(stockProperties.stockId, req.params.id))
        .leftJoin(stockPropertyDefinitions, eq(stockProperties.propertyDefinitionId, stockPropertyDefinitions.id));
      
      // Get colours
      const colours = await db
        .select()
        .from(stockColourLinks)
        .where(eq(stockColourLinks.stockId, req.params.id))
        .leftJoin(stockColours, eq(stockColourLinks.colourId, stockColours.id));
      
      // Get variants
      const variants = await db
        .select()
        .from(stockVariantLinks)
        .where(eq(stockVariantLinks.stockId, req.params.id))
        .leftJoin(stockVariants, eq(stockVariantLinks.variantId, stockVariants.id));
      
      // Get composite items (if type is composite)
      const compositeItems = await db
        .select()
        .from(stockCompositeItems)
        .where(eq(stockCompositeItems.parentStockId, req.params.id))
        .leftJoin(stock, eq(stockCompositeItems.componentStockId, stock.id))
        .leftJoin(stockUoms, eq(stockCompositeItems.unitId, stockUoms.id));
      
      // Get tally items (if behaviour is tally)
      const tallyItems = await db
        .select()
        .from(stockTallyItems)
        .where(eq(stockTallyItems.stockId, req.params.id))
        .leftJoin(stockTallies, eq(stockTallyItems.tallyId, stockTallies.id))
        .leftJoin(stockUoms, eq(stockTallyItems.unitId, stockUoms.id));
      
      const result = {
        ...item,
        relation,
        behaviour,
        type,
        stockUnit,
        purchaseUnit,
        salesUnit,
        manufacturer,
        markupGroup,
        discountGroup,
        marginGroup,
        properties: properties.map(p => ({ ...p.stock_properties, propertyDefinition: p.stock_property_definitions })),
        colours: colours.map(c => ({ ...c.stock_colour_links, colour: c.stock_colours })),
        variants: variants.map(v => ({ ...v.stock_variant_links, variant: v.stock_variants })),
        compositeItems: compositeItems.map(ci => ({ ...ci.stock_composite_items, componentStock: ci.stock, unit: ci.stock_uoms })),
        tallyItems: tallyItems.map(ti => ({ ...ti.stock_tally_items, tally: ti.stock_tallies, unit: ti.stock_uoms })),
      };
      
      res.json(result);
    } catch (error) {
      console.error('Stock detail fetch error:', error);
      res.status(500).json({ error: "Failed to fetch stock item" });
    }
  });
  
  // Create stock item
  app.post("/api/stock", async (req, res) => {
    try {
      const data = insertStockSchema.parse(req.body);
      const created = await storage.createStockItem(data);
      res.json(created);
    } catch (error: any) {
      console.error('Stock creation error:', error);
      res.status(400).json({ error: error.message || "Failed to create stock item" });
    }
  });
  
  // Update stock item
  app.put("/api/stock/:id", async (req, res) => {
    try {
      const data = insertStockSchema.partial().parse(req.body);
      const updated = await storage.updateStockItem(req.params.id, data);
      res.json(updated);
    } catch (error: any) {
      console.error('Stock update error:', error);
      res.status(400).json({ error: error.message || "Failed to update stock item" });
    }
  });
  
  // Delete stock item
  app.delete("/api/stock/:id", async (req, res) => {
    try {
      await storage.deleteStockItem(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Stock deletion error:', error);
      res.status(500).json({ error: "Failed to delete stock item" });
    }
  });
  
  // Stock Cost Update (centralized with history tracking)
  app.put("/api/stock/:id/cost", async (req, res) => {
    try {
      const { newCost, changeSource, changedBy, supplierId } = req.body;
      
      if (!newCost) {
        return res.status(400).json({ error: "New cost is required" });
      }
      
      const validSources = ['stock_form', 'supplier_grid', 'system_pricing'] as const;
      if (!changeSource || !validSources.includes(changeSource)) {
        return res.status(400).json({ 
          error: `Invalid change source. Must be one of: ${validSources.join(', ')}` 
        });
      }
      
      // Supplier ID is required for validation
      if (!supplierId) {
        return res.status(400).json({ error: "Supplier ID is required" });
      }
      
      // Verify stock exists before updating
      const existingStock = await storage.getStockItem(req.params.id);
      if (!existingStock) {
        return res.status(404).json({ error: "Stock item not found" });
      }
      
      // Validate supplier authorization - check if supplier is primary OR linked
      const isPrimarySupplier = existingStock.primarySupplierId === supplierId;
      
      // Check if supplier is in linked suppliers
      const linkedSuppliers = await db
        .select()
        .from(stockSupplierLinks)
        .where(
          and(
            eq(stockSupplierLinks.stockId, req.params.id),
            eq(stockSupplierLinks.supplierId, supplierId)
          )
        );
      
      const isLinkedSupplier = linkedSuppliers.length > 0;
      
      if (!isPrimarySupplier && !isLinkedSupplier) {
        return res.status(403).json({ 
          error: "This supplier is not authorized to update costs for this stock item" 
        });
      }
      
      const updatedStock = await storage.updateStockCost(
        req.params.id,
        newCost,
        changeSource,
        changedBy || undefined
      );
      
      res.json(updatedStock);
    } catch (error: any) {
      console.error('Update stock cost error:', error);
      res.status(400).json({ error: error.message || "Failed to update stock cost" });
    }
  });
  
  // Stock Cost History
  app.get("/api/stock/:id/cost-history", async (req, res) => {
    try {
      const history = await storage.getStockCostHistory(req.params.id);
      res.json(history);
    } catch (error) {
      console.error('Get stock cost history error:', error);
      res.status(500).json({ error: "Failed to fetch cost history" });
    }
  });
  
  // Import colours from Excel and relink stock items
  app.post("/api/stock/colours/import", async (req, res) => {
    try {
      const { filePath } = req.body;
      
      if (!filePath) {
        return res.status(400).json({ error: "File path is required" });
      }

      // Read the Excel file
      const fileBuffer = fs.readFileSync(filePath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const colourSheet = workbook.Sheets['Colour'];
      
      if (!colourSheet) {
        return res.status(400).json({ error: "Colour worksheet not found" });
      }

      // Parse colour data
      const rawData = XLSX.utils.sheet_to_json(colourSheet, { defval: '' });
      console.log(`Starting colour import of ${rawData.length} records...`);
      
      // Prepare colours for import
      const coloursToImport = rawData
        .filter((row: any) => row.Name && row.Name.toString().trim() !== '')
        .map((row: any) => ({
          name: row.Name.toString().trim(),
          description: row.Description?.toString().trim() || null,
          origin: row.Origin?.toString().trim() || null,
        }));
      
      console.log(`Processing ${coloursToImport.length} colours for upsert...`);
      
      // Bulk upsert colours
      const importedColours = await storage.bulkUpsertColours(coloursToImport);
      
      // Create a map of colour names to IDs (case-insensitive)
      const colourNameToIdMap = new Map(
        importedColours.map(c => [c.name.trim().toUpperCase(), c.id])
      );
      
      console.log(`Successfully imported ${importedColours.length} colours`);
      
      // Now relink all stock items that have colours - optimized with bulk operations
      const { stockColours: stockColoursTable, stockColourLinks: stockColourLinksTable } = await import("@shared/schema");
      
      console.log(`Fetching all colour links for relinking...`);
      
      // Fetch ALL colour links in one query
      const allColourLinks = await db
        .select()
        .from(stockColourLinksTable);
      
      if (allColourLinks.length === 0) {
        console.log('No colour links found, skipping relinking');
        res.json({
          success: true,
          summary: {
            coloursImported: importedColours.length,
            stockItemsRelinked: 0,
            relinkErrors: 0,
            unmatchedColours: [],
          }
        });
        return;
      }
      
      // Fetch ALL colours in one query
      const uniqueColourIds = new Set(allColourLinks.map(l => l.colourId));
      const allColourIds = Array.from(uniqueColourIds);
      const allColours = await db
        .select()
        .from(stockColoursTable)
        .where(inArray(stockColoursTable.id, allColourIds));
      
      // Create colour ID to name map
      const colourIdToName = new Map(allColours.map(c => [c.id, c.name.trim().toUpperCase()]));
      
      console.log(`Processing ${allColourLinks.length} colour links for ${new Set(allColourLinks.map(l => l.stockId)).size} stock items...`);
      
      // Group links by stock ID
      const linksByStock = new Map<string, string[]>();
      const unmatchedColours = new Set<string>();
      
      for (const link of allColourLinks) {
        const colourName = colourIdToName.get(link.colourId);
        if (!colourName) continue;
        
        const matchedId = colourNameToIdMap.get(colourName);
        if (matchedId) {
          if (!linksByStock.has(link.stockId)) {
            linksByStock.set(link.stockId, []);
          }
          linksByStock.get(link.stockId)!.push(matchedId);
        } else {
          unmatchedColours.add(allColours.find(c => c.id === link.colourId)?.name || colourName);
        }
      }
      
      console.log(`Replacing colour links for ${linksByStock.size} stock items...`);
      
      let relinkSuccessCount = 0;
      let relinkErrorCount = 0;
      
      // Process in batches of 100 for better performance
      const stockIds = Array.from(linksByStock.keys());
      const batchSize = 100;
      
      for (let i = 0; i < stockIds.length; i += batchSize) {
        const batch = stockIds.slice(i, i + batchSize);
        
        try {
          for (const stockId of batch) {
            const newColourIds = linksByStock.get(stockId)!;
            
            // Deduplicate colour IDs
            const uniqueSet = new Set(newColourIds);
            const uniqueColourIds = Array.from(uniqueSet);
            
            await storage.replaceStockColourLinks(stockId, uniqueColourIds);
            relinkSuccessCount++;
          }
          
          console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stockIds.length / batchSize)} (${relinkSuccessCount} items)`);
        } catch (error) {
          console.error(`Error processing batch starting at index ${i}:`, error);
          relinkErrorCount += batch.length;
        }
      }
      
      console.log(`Colour relinking complete. Success: ${relinkSuccessCount}, Errors: ${relinkErrorCount}`);
      
      res.json({
        success: true,
        summary: {
          coloursImported: importedColours.length,
          stockItemsRelinked: relinkSuccessCount,
          relinkErrors: relinkErrorCount,
          unmatchedColours: Array.from(unmatchedColours),
        }
      });
      
    } catch (error) {
      console.error('Colour import error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to import colours" 
      });
    }
  });
  
  // Import stock items from Excel
  app.post("/api/stock/import", async (req, res) => {
    try {
      const { filePath } = req.body;
      
      if (!filePath) {
        return res.status(400).json({ error: "File path is required" });
      }

      // Read the Excel file using fs
      const fileBuffer = fs.readFileSync(filePath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const stockSheet = workbook.Sheets['Stock'];
      
      if (!stockSheet) {
        return res.status(400).json({ error: "Stock worksheet not found" });
      }

      // Parse the data
      const rawData = XLSX.utils.sheet_to_json(stockSheet, { defval: '' });
      
      console.log(`Starting import of ${rawData.length} stock records...`);
      
      // Load all lookup data first
      const { 
        stockRelations, 
        stockBehaviours, 
        stockTypes, 
        stockUoms,
        stockMarkupGroups,
        stockDiscountGroups,
        stockPropertyDefinitions,
        stockColours,
        stockVariants
      } = await import("@shared/schema");
      
      const [
        relations,
        behaviours,
        types,
        uoms,
        manufacturersData,
        markupGroups,
        discountGroups,
        propertyDefs,
        colours,
        variants
      ] = await Promise.all([
        db.select().from(stockRelations),
        db.select().from(stockBehaviours),
        db.select().from(stockTypes),
        db.select().from(stockUoms),
        db.select().from(suppliers),
        db.select().from(stockMarkupGroups),
        db.select().from(stockDiscountGroups),
        db.select().from(stockPropertyDefinitions),
        db.select().from(stockColours),
        db.select().from(stockVariants)
      ]);
      
      // Create lookup maps
      const relationMap = new Map(relations.map((r: any) => [r.name.trim(), r.id]));
      const behaviourMap = new Map(behaviours.map((b: any) => [b.name.trim(), b.id]));
      const typeMap = new Map(types.map((t: any) => [t.name.trim(), t.id]));
      const uomMap = new Map(uoms.map((u: any) => [u.name.trim(), u.id]));
      const manufacturerMap = new Map(manufacturersData.map((m: any) => [m.name.trim(), m.id]));
      const markupGroupMap = new Map(markupGroups.map((g: any) => [g.name.trim(), g.id]));
      const discountGroupMap = new Map(discountGroups.map((g: any) => [g.name.trim(), g.id]));
      const propertyDefMap = new Map(propertyDefs.map((p: any) => [p.name.trim(), p.id]));
      const colourMap = new Map(colours.map((c: any) => [c.name.trim(), c.id]));
      const variantMap = new Map(variants.map((v: any) => [v.name.trim(), v.id]));
      
      // Get existing product codes to support resume
      const existingStockItems = await db.select({ productCode: stock.productCode }).from(stock);
      const existingProductCodes = new Set(existingStockItems.map(s => s.productCode));
      
      const results: any[] = [];
      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      
      for (let i = 0; i < rawData.length; i++) {
        const row: any = rawData[i];
        
        try {
          // Skip empty rows
          if (!row['Product Code'] || row['Product Code'].toString().trim() === '') {
            results.push({
              row: i + 2,
              status: 'skipped',
              message: 'Empty product code'
            });
            skippedCount++;
            continue;
          }
          
          // Check if product already exists - if so, we'll update it
          const productCode = row['Product Code'].toString().trim();
          const existingStock = existingProductCodes.has(productCode) 
            ? await db.select().from(stock).where(eq(stock.productCode, productCode)).limit(1)
            : [];
          const isUpdate = existingStock.length > 0;
          
          // Map the row data to stock schema
          const stockData: any = {
            productCode: row['Product Code']?.toString().trim() || '',
            partcode: row['Partcode']?.toString().trim() || null,
            itemHierarchy: row['Item Hiearchy']?.toString().trim() || null,
            description: row['Description']?.toString().trim() || '',
            notes: row['Notes']?.toString().trim() || null,
            supplierCost: row['Cost'] ? parseFloat(row['Cost'].toString()) : null,
            maxQuantity: row['Max Quantity'] ? parseFloat(row['Max Quantity'].toString()) : null,
            status: row['Status'] === 'Active' || row['Status'] === true || row['Status'] === 1,
          };
          
          // Handle lookups
          if (row['Relation (Lookup)']?.toString().trim()) {
            stockData.relationId = relationMap.get(row['Relation (Lookup)'].toString().trim());
          }
          if (row['Behaviour (Lookup)']?.toString().trim()) {
            stockData.behaviourId = behaviourMap.get(row['Behaviour (Lookup)'].toString().trim());
          }
          if (row['Item Type (Lookup)']?.toString().trim()) {
            stockData.typeId = typeMap.get(row['Item Type (Lookup)'].toString().trim());
          }
          if (row['UOM_Stock Unit (Lookup)']?.toString().trim()) {
            stockData.stockUnitId = uomMap.get(row['UOM_Stock Unit (Lookup)'].toString().trim());
          }
          if (row['UOM_Purchase Unit (Lookup)']?.toString().trim()) {
            stockData.purchaseUnitId = uomMap.get(row['UOM_Purchase Unit (Lookup)'].toString().trim());
          }
          if (row['UOM_Sales Unit (Lookup)']?.toString().trim()) {
            stockData.salesUnitId = uomMap.get(row['UOM_Sales Unit (Lookup)'].toString().trim());
          }
          if (row['Manufacturer (Lookup)']?.toString().trim()) {
            stockData.primarySupplierId = manufacturerMap.get(row['Manufacturer (Lookup)'].toString().trim());
          }
          if (row['Markup Category']?.toString().trim()) {
            stockData.markupGroupId = markupGroupMap.get(row['Markup Category'].toString().trim());
          }
          if (row['Discount Category']?.toString().trim()) {
            stockData.discountGroupId = discountGroupMap.get(row['Discount Category'].toString().trim());
          }
          
          // Create or update the stock item
          let stockItem;
          if (isUpdate) {
            // Update existing item - only update fields that are different
            const existingItem = existingStock[0];
            const updates: any = {};
            
            // Compare and collect changed fields
            for (const [key, value] of Object.entries(stockData)) {
              if (key !== 'productCode' && existingItem[key as keyof typeof existingItem] !== value) {
                updates[key] = value;
              }
            }
            
            // Only update if there are changes
            if (Object.keys(updates).length > 0) {
              stockItem = await storage.updateStockItem(existingItem.id, updates);
            } else {
              stockItem = existingItem;
            }
          } else {
            // Create new item
            stockItem = await storage.createStockItem(stockData);
          }
          
          // Handle properties
          const propertyFields = [
            'Box Qty', 'Bundle Size', 'Pallet Size', 'ACT_Thickness', 'ACT_Width', 'ACT_Length',
            'NOM_Thickness', 'NOM_Width', 'NOM_Length', 'Diameter', 'Depth', 'Height',
            'Cover Width', 'Coil Width', 'Weight', 'Weight (Treated)', 'm /Ton',
            'Surface Area m2', 'Area m2', 'Area m2 Nominal', 'Volume m3', 'Volume m3 Nominal',
            'Material Type', 'Visual Grade', 'Strength Grade', 'Class'
          ];
          
          if (isUpdate) {
            // For updates, sync properties: delete removed, add new, update changed
            const { stockProperties } = await import("@shared/schema");
            const existingProperties = await db.select()
              .from(stockProperties)
              .where(eq(stockProperties.stockId, stockItem.id));
            
            // Build map of properties from import
            const importPropertiesMap = new Map<string, string>();
            for (const field of propertyFields) {
              const columnName = `Properties_${field}`;
              const value = row[columnName];
              if (value !== null && value !== undefined && value !== '') {
                const propDefId = propertyDefMap.get(field);
                if (propDefId) {
                  importPropertiesMap.set(propDefId, value.toString());
                }
              }
            }
            
            // Delete properties not in import
            for (const existingProp of existingProperties) {
              if (!importPropertiesMap.has(existingProp.propertyDefinitionId)) {
                await storage.deleteStockProperty(existingProp.id);
              }
            }
            
            // Add new or update existing properties
            for (const [propDefId, value] of Array.from(importPropertiesMap.entries())) {
              const existingProp = existingProperties.find(p => p.propertyDefinitionId === propDefId);
              if (existingProp) {
                // Update if value changed
                if (existingProp.value !== value) {
                  await storage.updateStockProperty(existingProp.id, { value });
                }
              } else {
                // Create new property
                await storage.createStockProperty({
                  stockId: stockItem.id,
                  propertyDefinitionId: propDefId,
                  value: value.toString()
                });
              }
            }
          } else {
            // For new items, just create all properties
            for (const field of propertyFields) {
              const columnName = `Properties_${field}`;
              const value = row[columnName];
              
              if (value !== null && value !== undefined && value !== '') {
                const propDefId = propertyDefMap.get(field);
                
                if (propDefId) {
                  await storage.createStockProperty({
                    stockId: stockItem.id,
                    propertyDefinitionId: propDefId,
                    value: value.toString()
                  });
                }
              }
            }
          }
          
          // Handle colours (can be multiple) - create if doesn't exist
          const importColourIds = new Set<string>();
          if (row['Colour (Lookup (Allow Multiple Variants)']?.toString().trim()) {
            const colourNames = row['Colour (Lookup (Allow Multiple Variants)'].toString().split(',');
            for (const colourName of colourNames) {
              const trimmedName = colourName.trim();
              if (!trimmedName) continue;
              
              let colourId = colourMap.get(trimmedName);
              
              // If colour doesn't exist in map, try to create or fetch existing
              if (!colourId) {
                try {
                  const [newColour] = await db.insert(stockColours).values({
                    name: trimmedName
                  }).returning();
                  colourId = newColour.id;
                  colourMap.set(trimmedName, colourId);
                } catch (error: any) {
                  // If duplicate (23505), fetch the existing colour
                  if (error.code === '23505') {
                    const [existingColour] = await db.select().from(stockColours)
                      .where(eq(stockColours.name, trimmedName));
                    if (existingColour) {
                      colourId = existingColour.id;
                      colourMap.set(trimmedName, colourId);
                    }
                  } else {
                    throw error;
                  }
                }
              }
              
              if (colourId) {
                importColourIds.add(colourId);
              }
            }
          }
          
          // Sync colour links for updates
          if (isUpdate) {
            const { stockColourLinks } = await import("@shared/schema");
            const existingColourLinks = await db.select()
              .from(stockColourLinks)
              .where(eq(stockColourLinks.stockId, stockItem.id));
            
            // Delete colour links not in import
            for (const link of existingColourLinks) {
              if (!importColourIds.has(link.colourId)) {
                await storage.deleteStockColourLink(link.id);
              }
            }
            
            // Add new colour links
            const existingColourIds = new Set(existingColourLinks.map(l => l.colourId));
            for (const colourId of Array.from(importColourIds)) {
              if (!existingColourIds.has(colourId)) {
                await storage.createStockColourLink({
                  stockId: stockItem.id,
                  colourId: colourId
                });
              }
            }
          } else {
            // For new items, just create all colour links
            for (const colourId of Array.from(importColourIds)) {
              await storage.createStockColourLink({
                stockId: stockItem.id,
                colourId: colourId
              });
            }
          }
          
          // Handle variants (can be multiple) - create if doesn't exist
          const importVariantIds = new Set<string>();
          if (row['Variant (Lookup Allow Multiple Variants)']?.toString().trim()) {
            const variantNames = row['Variant (Lookup Allow Multiple Variants)'].toString().split(',');
            for (const variantName of variantNames) {
              const trimmedName = variantName.trim();
              if (!trimmedName) continue;
              
              let variantId = variantMap.get(trimmedName);
              
              // If variant doesn't exist in map, try to create or fetch existing
              if (!variantId) {
                try {
                  const [newVariant] = await db.insert(stockVariants).values({
                    name: trimmedName
                  }).returning();
                  variantId = newVariant.id;
                  variantMap.set(trimmedName, variantId);
                } catch (error: any) {
                  // If duplicate (23505), fetch the existing variant
                  if (error.code === '23505') {
                    const [existingVariant] = await db.select().from(stockVariants)
                      .where(eq(stockVariants.name, trimmedName));
                    if (existingVariant) {
                      variantId = existingVariant.id;
                      variantMap.set(trimmedName, variantId);
                    }
                  } else {
                    throw error;
                  }
                }
              }
              
              if (variantId) {
                importVariantIds.add(variantId);
              }
            }
          }
          
          // Sync variant links for updates
          if (isUpdate) {
            const { stockVariantLinks } = await import("@shared/schema");
            const existingVariantLinks = await db.select()
              .from(stockVariantLinks)
              .where(eq(stockVariantLinks.stockId, stockItem.id));
            
            // Delete variant links not in import
            for (const link of existingVariantLinks) {
              if (!importVariantIds.has(link.variantId)) {
                await storage.deleteStockVariantLink(link.id);
              }
            }
            
            // Add new variant links
            const existingVariantIds = new Set(existingVariantLinks.map(l => l.variantId));
            for (const variantId of Array.from(importVariantIds)) {
              if (!existingVariantIds.has(variantId)) {
                await storage.createStockVariantLink({
                  stockId: stockItem.id,
                  variantId: variantId
                });
              }
            }
          } else {
            // For new items, just create all variant links
            for (const variantId of Array.from(importVariantIds)) {
              await storage.createStockVariantLink({
                stockId: stockItem.id,
                variantId: variantId
              });
            }
          }
          
          successCount++;
          results.push({
            row: i + 2,
            status: 'success',
            action: isUpdate ? 'updated' : 'created',
            productCode: stockData.productCode
          });
          
        } catch (error: any) {
          errorCount++;
          results.push({
            row: i + 2,
            status: 'error',
            message: error.message,
            productCode: row['Product Code']
          });
          console.error(`Error importing row ${i + 2}:`, error);
        }
      }
      
      res.json({
        total: rawData.length,
        success: successCount,
        skipped: skippedCount,
        errors: errorCount,
        results: results
      });
      
    } catch (error: any) {
      console.error('Import error:', error);
      res.status(500).json({ error: error.message || "Failed to import stock" });
    }
  });
  
  // Stock Properties Junction Table
  app.get("/api/stock/:id/properties", async (req, res) => {
    try {
      const properties = await storage.getStockProperties(req.params.id);
      res.json(properties);
    } catch (error) {
      console.error('Get stock properties error:', error);
      res.status(500).json({ error: "Failed to fetch stock properties" });
    }
  });
  
  app.post("/api/stock/:id/properties", async (req, res) => {
    try {
      const { insertStockPropertySchema } = await import("@shared/schema");
      const data = insertStockPropertySchema.parse({
        ...req.body,
        stockId: req.params.id,
      });
      const created = await storage.createStockProperty(data);
      res.json(created);
    } catch (error: any) {
      console.error('Create stock property error:', error);
      res.status(400).json({ error: error.message || "Failed to create stock property" });
    }
  });
  
  app.put("/api/stock/properties/:propertyId", async (req, res) => {
    try {
      const { insertStockPropertySchema } = await import("@shared/schema");
      const data = insertStockPropertySchema.partial().parse(req.body);
      const updated = await storage.updateStockProperty(req.params.propertyId, data);
      res.json(updated);
    } catch (error: any) {
      console.error('Update stock property error:', error);
      res.status(400).json({ error: error.message || "Failed to update stock property" });
    }
  });
  
  app.delete("/api/stock/properties/:propertyId", async (req, res) => {
    try {
      await storage.deleteStockProperty(req.params.propertyId);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete stock property error:', error);
      res.status(500).json({ error: "Failed to delete stock property" });
    }
  });
  
  // Stock Colour Links Junction Table with colour details
  app.get("/api/stock/:id/colours", async (req, res) => {
    try {
      const { stockColourLinks, stockColours } = await import("@shared/schema");
      const coloursWithDetails = await db
        .select({
          id: stockColourLinks.id,
          stockId: stockColourLinks.stockId,
          colourId: stockColourLinks.colourId,
          colourName: stockColours.name,
          colourDescription: stockColours.description,
        })
        .from(stockColourLinks)
        .leftJoin(stockColours, eq(stockColourLinks.colourId, stockColours.id))
        .where(eq(stockColourLinks.stockId, req.params.id));
      res.json(coloursWithDetails);
    } catch (error) {
      console.error('Get stock colours error:', error);
      res.status(500).json({ error: "Failed to fetch stock colours" });
    }
  });
  
  app.post("/api/stock/:id/colours", async (req, res) => {
    try {
      const { insertStockColourLinkSchema } = await import("@shared/schema");
      const data = insertStockColourLinkSchema.parse({
        ...req.body,
        stockId: req.params.id,
      });
      const created = await storage.createStockColourLink(data);
      res.json(created);
    } catch (error: any) {
      console.error('Create stock colour link error:', error);
      res.status(400).json({ error: error.message || "Failed to create stock colour link" });
    }
  });
  
  app.delete("/api/stock/colours/:colourLinkId", async (req, res) => {
    try {
      await storage.deleteStockColourLink(req.params.colourLinkId);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete stock colour link error:', error);
      res.status(500).json({ error: "Failed to delete stock colour link" });
    }
  });
  
  // Stock Variant Links Junction Table
  app.get("/api/stock/:id/variants", async (req, res) => {
    try {
      const variants = await storage.getStockVariantLinks(req.params.id);
      res.json(variants);
    } catch (error) {
      console.error('Get stock variants error:', error);
      res.status(500).json({ error: "Failed to fetch stock variants" });
    }
  });
  
  app.post("/api/stock/:id/variants", async (req, res) => {
    try {
      const { insertStockVariantLinkSchema } = await import("@shared/schema");
      const data = insertStockVariantLinkSchema.parse({
        ...req.body,
        stockId: req.params.id,
      });
      const created = await storage.createStockVariantLink(data);
      res.json(created);
    } catch (error: any) {
      console.error('Create stock variant link error:', error);
      res.status(400).json({ error: error.message || "Failed to create stock variant link" });
    }
  });
  
  app.delete("/api/stock/variants/:variantLinkId", async (req, res) => {
    try {
      await storage.deleteStockVariantLink(req.params.variantLinkId);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete stock variant link error:', error);
      res.status(500).json({ error: "Failed to delete stock variant link" });
    }
  });
  
  // Stock Composite Items Junction Table
  app.get("/api/stock/:id/composite-items", async (req, res) => {
    try {
      const { stockCompositeItems, stock, stockUoms } = await import("@shared/schema");
      const compositeItems = await db
        .select({
          compositeItem: stockCompositeItems,
          componentStock: stock,
          unit: stockUoms,
        })
        .from(stockCompositeItems)
        .leftJoin(stock, eq(stockCompositeItems.componentStockId, stock.id))
        .leftJoin(stockUoms, eq(stockCompositeItems.unitId, stockUoms.id))
        .where(eq(stockCompositeItems.parentStockId, req.params.id));
      
      res.json(compositeItems.map(ci => ({
        ...ci.compositeItem,
        componentStock: ci.componentStock,
        unit: ci.unit,
      })));
    } catch (error) {
      console.error('Get composite items error:', error);
      res.status(500).json({ error: "Failed to fetch composite items" });
    }
  });
  
  app.post("/api/stock/:id/composite-items", async (req, res) => {
    try {
      const { insertStockCompositeItemSchema } = await import("@shared/schema");
      const data = insertStockCompositeItemSchema.parse({
        ...req.body,
        parentStockId: req.params.id,
      });
      const { stockCompositeItems } = await import("@shared/schema");
      const [created] = await db.insert(stockCompositeItems).values(data).returning();
      res.json(created);
    } catch (error: any) {
      console.error('Create composite item error:', error);
      res.status(400).json({ error: error.message || "Failed to create composite item" });
    }
  });
  
  app.put("/api/stock/composite-items/:compositeItemId", async (req, res) => {
    try {
      const { insertStockCompositeItemSchema } = await import("@shared/schema");
      const data = insertStockCompositeItemSchema.partial().parse(req.body);
      const { stockCompositeItems } = await import("@shared/schema");
      const [updated] = await db
        .update(stockCompositeItems)
        .set(data)
        .where(eq(stockCompositeItems.id, req.params.compositeItemId))
        .returning();
      res.json(updated);
    } catch (error: any) {
      console.error('Update composite item error:', error);
      res.status(400).json({ error: error.message || "Failed to update composite item" });
    }
  });
  
  app.delete("/api/stock/composite-items/:compositeItemId", async (req, res) => {
    try {
      const { stockCompositeItems } = await import("@shared/schema");
      await db.delete(stockCompositeItems).where(eq(stockCompositeItems.id, req.params.compositeItemId));
      res.json({ success: true });
    } catch (error) {
      console.error('Delete composite item error:', error);
      res.status(500).json({ error: "Failed to delete composite item" });
    }
  });
  
  // Calculate total cost for composite items
  app.get("/api/stock/:id/composite-cost", async (req, res) => {
    try {
      const { stockCompositeItems, stock } = await import("@shared/schema");
      const compositeItems = await db
        .select({
          quantity: stockCompositeItems.quantity,
          supplierCost: stock.supplierCost,
          averageCost: stock.averageCost,
          lastCost: stock.lastCost,
        })
        .from(stockCompositeItems)
        .leftJoin(stock, eq(stockCompositeItems.componentStockId, stock.id))
        .where(eq(stockCompositeItems.parentStockId, req.params.id));
      
      let totalCost = 0;
      for (const item of compositeItems) {
        const cost = item.supplierCost || item.averageCost || item.lastCost || 0;
        const quantity = parseFloat(item.quantity || '0');
        totalCost += parseFloat(cost.toString()) * quantity;
      }
      
      res.json({ totalCost: totalCost.toFixed(2) });
    } catch (error) {
      console.error('Calculate composite cost error:', error);
      res.status(500).json({ error: "Failed to calculate composite cost" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
