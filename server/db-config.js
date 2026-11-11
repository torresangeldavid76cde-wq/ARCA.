import {readFileSync} from 'node:fs';

function integer(value,fallback,name,max){
 const text=value||String(fallback);
 if(!/^\d+$/.test(text)||Number(text)<1||Number(text)>max)throw new Error(`${name} debe ser un entero entre 1 y ${max}`);
 return Number(text);
}

// Shared by the API and maintenance commands. Never log the returned object.
export function databaseConfig(env=process.env,{prefix='DB_',required=false,admin=false}={}){
 const get=name=>env[prefix+name];
 if(required)for(const name of ['HOST','PORT','NAME','USER','PASSWORD']){
  if(!get(name))throw new Error(`Configura ${prefix+name} en .env`);
 }
 const host=get('HOST')||'127.0.0.1';
 const aiven=/(^|\.)aivencloud\.com$/i.test(host);
 const flag=get('SSL');
 if(flag&&!['true','false'].includes(flag))throw new Error(`${prefix}SSL debe ser true o false`);
 const caText=get('SSL_CA')?.replace(/\\n/g,'\n');
 const caPath=get('SSL_CA_PATH');
 if(caText&&caPath)throw new Error(`Usa solo ${prefix}SSL_CA o ${prefix}SSL_CA_PATH`);
 const secure=flag==='true'||(!flag&&(aiven||env.NODE_ENV==='production'||env.VERCEL==='1'||Boolean(caText||caPath)));
 if(aiven&&!secure)throw new Error('Aiven requiere TLS: configura DB_SSL=true');
 if(!secure&&(caText||caPath))throw new Error(`${prefix}SSL=false no permite configurar un certificado`);
 let ca=caText;
 if(caPath){
  try{ca=readFileSync(caPath,'utf8')}catch{throw new Error(`No se pudo leer el certificado indicado en ${prefix}SSL_CA_PATH`)}
 }
 if(aiven&&!ca)throw new Error(`Configura el certificado de Aiven en ${prefix}SSL_CA o ${prefix}SSL_CA_PATH`);
 if(ca&&!/-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(ca))throw new Error(`${prefix}SSL_CA debe contener un certificado PEM`);
 return {
  host,port:integer(get('PORT'),3306,prefix+'PORT',65535),database:get('NAME')||'arc',
  user:(admin&&get('ADMIN_USER'))||get('USER')||'arca_app',
  password:admin&&get('ADMIN_USER')?(get('ADMIN_PASSWORD')??get('PASSWORD')):get('PASSWORD'),
  dateStrings:true,charset:'utf8mb4',connectTimeout:integer(get('CONNECT_TIMEOUT'),10000,prefix+'CONNECT_TIMEOUT',120000),
  enableKeepAlive:true,
  ssl:secure?{rejectUnauthorized:true,verifyIdentity:true,minVersion:'TLSv1.2',...(ca?{ca}:{})}:undefined
 };
}

export function poolConfig(env=process.env){
 const vercel=env.VERCEL==='1';
 return {...databaseConfig(env),connectionLimit:integer(env.DB_CONNECTION_LIMIT,vercel?2:8,'DB_CONNECTION_LIMIT',100),
  waitForConnections:true,queueLimit:50,idleTimeout:vercel?5000:60000};
}
