import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { storagePut } from "./storage";
import { createAzureConfig, testAzureConnection, getTableColumns, insertRowsToAzure } from "./azureDb";
import Papa from "papaparse";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  azureConnection: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        server: z.string(),
        database: z.string(),
        username: z.string(),
        password: z.string(),
        port: z.number().default(1433),
        tableName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const connection = await db.createAzureConnection({
          userId: ctx.user.id,
          ...input,
        });
        return connection;
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAzureConnectionsByUserId(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAzureConnectionById(input.id);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        server: z.string().optional(),
        database: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        port: z.number().optional(),
        tableName: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateAzureConnection(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteAzureConnection(input.id);
      }),

    testConnection: protectedProcedure
      .input(z.object({
        server: z.string(),
        database: z.string(),
        username: z.string(),
        password: z.string(),
        port: z.number().default(1433),
      }))
      .mutation(async ({ input }) => {
        const config = {
          server: input.server,
          database: input.database,
          user: input.username,
          password: input.password,
          port: input.port,
          options: {
            encrypt: true,
            trustServerCertificate: false,
          },
        };
        return await testAzureConnection(config);
      }),

    getTableColumns: protectedProcedure
      .input(z.object({
        connectionId: z.number(),
        tableName: z.string(),
      }))
      .query(async ({ input }) => {
        const connection = await db.getAzureConnectionById(input.connectionId);
        if (!connection) {
          throw new Error("Connection not found");
        }
        const config = createAzureConfig(connection);
        return await getTableColumns(config, input.tableName);
      }),
  }),

  csv: router({
    upload: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileContent: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const fileKey = `csv-uploads/${ctx.user.id}/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, input.fileContent, "text/csv");
        
        return { url, fileKey };
      }),

    parse: protectedProcedure
      .input(z.object({
        fileContent: z.string(),
      }))
      .mutation(async ({ input }) => {
        return new Promise((resolve, reject) => {
          Papa.parse(input.fileContent, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              const headers = results.meta.fields || [];
              const preview = results.data.slice(0, 5);
              resolve({
                headers,
                preview,
                totalRows: results.data.length,
              });
            },
            error: (error: any) => {
              reject(new Error(error.message));
            },
          });
        });
      }),
  }),

  importJob: router({
    create: protectedProcedure
      .input(z.object({
        connectionId: z.number(),
        fileName: z.string(),
        fileUrl: z.string(),
        fieldMappings: z.any(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createImportJob({
          userId: ctx.user.id,
          connectionId: input.connectionId,
          fileName: input.fileName,
          fileUrl: input.fileUrl,
          fieldMappings: input.fieldMappings,
          status: "pending",
          totalRows: 0,
          processedRows: 0,
          failedRows: 0,
        });
        return result;
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getImportJobsByUserId(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getImportJobById(input.id);
      }),

    getLogs: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        return await db.getImportLogsByJobId(input.jobId);
      }),

    execute: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        csvContent: z.string(),
      }))
      .mutation(async ({ input }) => {
        const job = await db.getImportJobById(input.jobId);
        if (!job) {
          throw new Error("Job not found");
        }

        const connection = await db.getAzureConnectionById(job.connectionId);
        if (!connection) {
          throw new Error("Connection not found");
        }

        await db.updateImportJob(input.jobId, { status: "processing" });

        try {
          const parsedData: any = await new Promise((resolve, reject) => {
            Papa.parse(input.csvContent, {
              header: true,
              skipEmptyLines: true,
              complete: (results) => resolve(results),
              error: (error: any) => reject(error),
            });
          });

          const csvRows = parsedData.data;
          const mappings = job.fieldMappings as any;

          const transformedRows = csvRows.map((row: any) => {
            const transformed: Record<string, any> = {};
            
            for (const [dbField, mapping] of Object.entries(mappings)) {
              const mappingConfig = mapping as any;
              let value = "";

              if (mappingConfig.type === "csv") {
                value = row[mappingConfig.csvField] || "";
              } else if (mappingConfig.type === "text") {
                value = mappingConfig.text || "";
              } else if (mappingConfig.type === "concat") {
                const parts = mappingConfig.parts || [];
                value = parts.map((part: any) => {
                  if (part.type === "csv") {
                    return row[part.csvField] || "";
                  } else if (part.type === "text") {
                    return part.text || "";
                  }
                  return "";
                }).join("");
              }

              transformed[dbField] = value;
            }

            return transformed;
          });

          await db.updateImportJob(input.jobId, { totalRows: transformedRows.length });

          const config = createAzureConfig(connection);
          const result = await insertRowsToAzure(config, connection.tableName, transformedRows);

          for (const error of result.errors) {
            await db.createImportLog({
              jobId: input.jobId,
              rowNumber: error.row,
              level: "error",
              message: error.error,
              rowData: transformedRows[error.row - 1],
            });
          }

          await db.updateImportJob(input.jobId, {
            status: result.failed === 0 ? "completed" : "failed",
            processedRows: result.success,
            failedRows: result.failed,
            completedAt: new Date(),
          });

          return {
            success: result.success,
            failed: result.failed,
            errors: result.errors,
          };
        } catch (error: any) {
          await db.updateImportJob(input.jobId, {
            status: "failed",
            errorMessage: error.message,
            completedAt: new Date(),
          });
          throw error;
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
