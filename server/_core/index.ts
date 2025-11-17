import "dotenv/config";
import express from "express";
import session from "express-session";
import MySQLStoreFactory from "express-mysql-session";
import mysql from "mysql2/promise";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import passport from "../auth/azureAuth";
import authRoutes from "../routes/auth";
import { ENV } from "./env";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // Session configuration for Azure AD
  // Trust proxy for secure cookies behind Nginx
  app.set('trust proxy', 1);
  
  if (ENV.azureClientId && ENV.azureClientSecret && ENV.azureTenantId) {
    console.log('[Auth] Configuring Azure Entra ID authentication');
    
    // Create MySQL session store
    const MySQLStore = MySQLStoreFactory(session);
    const sessionStore = new MySQLStore({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'customer_importer',
      createDatabaseTable: true, // Automatically create sessions table
      schema: {
        tableName: 'sessions',
        columnNames: {
          session_id: 'session_id',
          expires: 'expires',
          data: 'data'
        }
      }
    });
    
    console.log('[Session] Using MySQL session store');
    
    app.use(
      session({
        secret: ENV.cookieSecret || 'fallback-secret-change-me',
        store: sessionStore,
        resave: false,
        saveUninitialized: true, // Changed to true to ensure session is created
        cookie: {
          secure: true, // Always true for HTTPS
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          sameSite: 'lax',
          path: '/',
        },
        name: 'rpm.sid', // Custom session cookie name
      })
    );
    
    // Initialize Passport
    app.use(passport.initialize());
    app.use(passport.session());
    
    // Register Azure AD authentication routes
    app.use('/api/auth', authRoutes);
  } else {
    console.log('[Auth] Azure AD not configured - authentication disabled');
  }
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
