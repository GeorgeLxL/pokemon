import mysql from "mysql2/promise";

const globalForDb = globalThis as unknown as { db: mysql.Pool };

export const db = globalForDb.db ?? mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 60000,
});

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
