import 'dotenv/config';
import mysql from 'mysql2/promise';
export const db=mysql.createPool({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'arca_app',password:process.env.DB_PASSWORD,database:process.env.DB_NAME||'arc',connectionLimit:8,dateStrings:true});
export async function query(sql,args=[]){return (await db.execute(sql,args))[0]}
