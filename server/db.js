import 'dotenv/config';
import mysql from 'mysql2';
import {attachDatabasePool} from '@vercel/functions';
import {poolConfig} from './db-config.js';
const vercel=process.env.VERCEL==='1';
const pool=mysql.createPool(poolConfig());
export const db=pool.promise();
if(vercel)attachDatabasePool(pool);
export async function query(sql,args=[]){return (await db.execute(sql,args))[0]}
