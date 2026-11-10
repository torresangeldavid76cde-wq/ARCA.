import 'dotenv/config';
import mysql from 'mysql2';
import {attachDatabasePool} from '@vercel/functions';
const vercel=process.env.VERCEL==='1';
const pool=mysql.createPool({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'arca_app',password:process.env.DB_PASSWORD,database:process.env.DB_NAME||'arc',connectionLimit:Number(process.env.DB_CONNECTION_LIMIT||(vercel?2:8)),idleTimeout:vercel?5000:60000,dateStrings:true,ssl:process.env.DB_SSL==='false'?undefined:process.env.DB_SSL==='true'||process.env.NODE_ENV==='production'?{rejectUnauthorized:true}:undefined});
export const db=pool.promise();
if(vercel)attachDatabasePool(pool);
export async function query(sql,args=[]){return (await db.execute(sql,args))[0]}
