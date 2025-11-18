

import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

import { createAzureConfig, testAzureConnection, getTableColumns, insertRowsToAzure, getDistinctCustomers, getDistinctImportDates, deleteRecordsByCustomerAndDate, getCompanyNamesFromPCCustomers } from "./azureDb";
import Papa from "papaparse";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required');
  }
  return next({ ctx });
});

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      // Logout is handled by /api/auth/logout endpoint
      return {
        success: true,
      } as const;
    }),
  }),

  users: router({
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),

    add: adminProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().optional(),
        role: z.enum(['user', 'admin']).default('user'),
      }))
      .mutation(async ({ input }) => {
        // Check if user already exists
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new Error('User with this email already exists');
        }

        // Create user with a placeholder openId (will be updated on first login)
        const result = await db.createUser({
          openId: `pending_${input.email}`, // Temporary openId
          email: input.email,
          name: input.name || input.email,
          role: input.role,
          loginMethod: 'azure-ad',
        });
        return result;
      }),

    delete: adminProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Prevent deleting yourself
        if (input.id === ctx.user.id) {
          throw new Error('Cannot delete your own account');
        }
        
        await db.deleteUserById(input.id);
        return { success: true };
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
          name: input.name.trim(),
          server: input.server.trim(),
          database: input.database.trim(),
          username: input.username.trim(),
          password: input.password.trim(),
          port: input.port,
          tableName: input.tableName.trim(),
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
        const trimmedData: any = {};
        if (data.name) trimmedData.name = data.name.trim();
        if (data.server) trimmedData.server = data.server.trim();
        if (data.database) trimmedData.database = data.database.trim();
        if (data.username) trimmedData.username = data.username.trim();
        if (data.password) trimmedData.password = data.password.trim();
        if (data.tableName) trimmedData.tableName = data.tableName.trim();
        if (data.port !== undefined) trimmedData.port = data.port;
        if (data.isActive !== undefined) trimmedData.isActive = data.isActive;
        return await db.updateAzureConnection(id, trimmedData);
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
          server: input.server.trim(),
          database: input.database.trim(),
          user: input.username.trim(),
          password: input.password.trim(),
          port: input.port,
          options: {
            encrypt: true,
            trustServerCertificate: false,
          },
        };
        return await testAzureConnection(config);
      }),

    getCompanyNames: protectedProcedure
      .input(z.object({
        connectionId: z.number(),
      }))
      .query(async ({ input }) => {
        const connection = await db.getAzureConnectionById(input.connectionId);
        if (!connection) {
          throw new Error("Connection not found");
        }
        const config = createAzureConfig(connection);
        return await getCompanyNamesFromPCCustomers(config);
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
        // CSV content is passed directly, no storage needed
        const fileKey = `csv-uploads/${ctx.user.id}/${Date.now()}-${input.fileName}`;
        
        return { url: '', fileKey };
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
        customerName: z.string(),
        importDate: z.string(),
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
            const transformed: Record<string, any> = {
              CustomerName: input.customerName, // Add customer name from dropdown
              ImportDate: input.importDate, // Add import date from date selector
            };
            
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

              // Only include the field if it has a value or if it's explicitly mapped
              if (value !== "" || mappingConfig.type === "text") {
                transformed[dbField] = value;
              }
            }

            return transformed;
          }).filter((row: any) => Object.keys(row).length > 0);

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

  mappingTemplate: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        mappings: z.string(), // JSON string of field mappings
      }))
      .mutation(async ({ ctx, input }) => {
        const template = await db.createMappingTemplate({
          userId: ctx.user.id,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          mappings: input.mappings,
        });
        return template;
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getMappingTemplatesByUserId(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getMappingTemplateById(input.id);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteMappingTemplate(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  dataCleanup: router({
    getCustomers: protectedProcedure
      .input(z.object({ connectionId: z.number() }))
      .query(async ({ input }) => {
        const connection = await db.getAzureConnectionById(input.connectionId);
        if (!connection) {
          throw new Error("Connection not found");
        }
        const config = createAzureConfig(connection);
        return await getDistinctCustomers(config, connection.tableName);
      }),

    getImportDates: protectedProcedure
      .input(z.object({ connectionId: z.number() }))
      .query(async ({ input }) => {
        const connection = await db.getAzureConnectionById(input.connectionId);
        if (!connection) {
          throw new Error("Connection not found");
        }
        const config = createAzureConfig(connection);
        return await getDistinctImportDates(config, connection.tableName);
      }),

    deleteRecords: protectedProcedure
      .input(z.object({
        connectionId: z.number(),
        customerName: z.string(),
        importDate: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const connection = await db.getAzureConnectionById(input.connectionId);
        if (!connection) {
          throw new Error("Connection not found");
        }
        const config = createAzureConfig(connection);
        const result = await deleteRecordsByCustomerAndDate(
          config,
          connection.tableName,
          input.customerName,
          input.importDate
        );
        
        // Create audit log entry
        await db.createCleanupAuditLog({
          userId: ctx.user.id,
          connectionId: input.connectionId,
          customerName: input.customerName,
          importDate: input.importDate,
          deletedCount: result.deletedCount,
          tableName: connection.tableName,
        });
        
        return result;
      }),
  }),

  auditLog: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getCleanupAuditLogs(ctx.user.id, input.limit || 50);
      }),

    listAll: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getAllCleanupAuditLogs(input.limit || 100);
      }),
  }),
});

export type AppRouter = typeof appRouter;
