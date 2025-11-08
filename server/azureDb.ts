import sql from 'mssql';
import { AzureConnection } from '../drizzle/schema';

export interface AzureDbConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  port: number;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
  };
}

export function createAzureConfig(connection: AzureConnection): AzureDbConfig {
  return {
    server: connection.server,
    database: connection.database,
    user: connection.username,
    password: connection.password,
    port: connection.port,
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
  };
}

export async function testAzureConnection(config: AzureDbConfig): Promise<{ success: boolean; error?: string }> {
  let pool: sql.ConnectionPool | null = null;
  try {
    pool = await sql.connect(config);
    await pool.request().query('SELECT 1');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

export async function getTableColumns(config: AzureDbConfig, tableName: string): Promise<string[]> {
  let pool: sql.ConnectionPool | null = null;
  try {
    pool = await sql.connect(config);
    const result = await pool.request()
      .input('tableName', sql.NVarChar, tableName)
      .query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @tableName
        ORDER BY ORDINAL_POSITION
      `);
    return result.recordset.map((row: any) => row.COLUMN_NAME);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

export async function insertRowsToAzure(
  config: AzureDbConfig,
  tableName: string,
  rows: Record<string, any>[]
): Promise<{ success: number; failed: number; errors: Array<{ row: number; error: string }> }> {
  let pool: sql.ConnectionPool | null = null;
  let success = 0;
  let failed = 0;
  const errors: Array<{ row: number; error: string }> = [];

  try {
    pool = await sql.connect(config);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Skip rows with no data
        if (Object.keys(row).length === 0) {
          continue;
        }

        // Filter out null/undefined/empty string values from the row
        const filteredRow: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          if (value !== null && value !== undefined && value !== '') {
            filteredRow[key] = value;
          }
        }

        // Skip if no valid fields remain after filtering
        if (Object.keys(filteredRow).length === 0) {
          console.log(`[Azure SQL] Skipping row ${i + 1} - no valid data`);
          continue;
        }

        const columns = Object.keys(filteredRow);
        const values = Object.values(filteredRow);
        
        const columnList = columns.map(col => `[${col}]`).join(', ');
        const paramList = columns.map((_, idx) => `@param${idx}`).join(', ');
        
        const request = pool.request();
        columns.forEach((col, idx) => {
          const value = values[idx];
          if (typeof value === 'number') {
            request.input(`param${idx}`, sql.Int, value);
          } else if (value instanceof Date) {
            request.input(`param${idx}`, sql.DateTime, value);
          } else {
            // All values here are already non-empty due to filtering above
            request.input(`param${idx}`, sql.NVarChar, String(value));
          }
        });

        // Handle schema-qualified table names (e.g., [other].[CustomerData])
        const tableIdentifier = tableName.includes('.') ? tableName : `[${tableName}]`;
        const query = `INSERT INTO ${tableIdentifier} (${columnList}) VALUES (${paramList})`;
        console.log(`[Azure SQL] Row ${i + 1} - Columns: ${columns.join(', ')}`);
        console.log(`[Azure SQL] Row ${i + 1} - Query: ${query}`);
        await request.query(query);
        success++;
      } catch (error: any) {
        failed++;
        console.error(`[Azure SQL] Row ${i + 1} failed:`, error.message);
        console.error(`[Azure SQL] Row ${i + 1} data:`, JSON.stringify(row));
        errors.push({ row: i + 1, error: error.message });
      }
    }

    return { success, failed, errors };
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}
