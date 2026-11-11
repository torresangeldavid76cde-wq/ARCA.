import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';

// mysqldump without routines/triggers uses semicolon delimiters. Preserve MySQL
// executable comments and never split inside a quoted value or an identifier.
export async function* dumpStatements(lines){
 let quote=null,block=false,parts=[];
 for await(const value of lines){
  const line=value+'\n';
  if(!quote&&!block&&/^\s*DELIMITER\b/i.test(line))throw new Error('El respaldo usa DELIMITER; requiere una migración de rutinas específica');
  let start=0;
  for(let i=0;i<line.length;i++){
   const char=line[i],next=line[i+1];
   if(block){if(char==='*'&&next==='/'){block=false;i++}continue}
   if(quote){
    if(char==='\\'){i++;continue}
    if(char===quote){if(next===quote)i++;else quote=null}
    continue;
   }
   if(char==='#'||(char==='-'&&next==='-'&&/\s/.test(line[i+2]||'')))break;
   if(char==='/'&&next==='*'){block=true;i++;continue}
   if(char==="'"||char==='"'||char==='`'){quote=char;continue}
   if(char===';'){
    parts.push(line.slice(start,i+1));
    const statement=parts.join('').trim();
    parts=[];start=i+1;
    if(statement)yield statement;
   }
  }
  parts.push(line.slice(start));
 }
 if(quote||block)throw new Error('El respaldo contiene una cadena o comentario sin cerrar');
 const remaining=parts.join('').trim();
 // Only non-executable trailing comments are allowed without a delimiter.
 if(remaining.replace(/\/\*(?!\!)[\s\S]*?\*\//g,'').replace(/^(?:\s*--[^\n]*|\s*#[^\n]*)$/gm,'').trim())throw new Error('El respaldo contiene una sentencia sin terminar');
}

export async function importDump(connection,file){
 const input=createReadStream(file,{encoding:'utf8'});
 const lines=createInterface({input,crlfDelay:Infinity});
 let number=0;
 try{
  for await(const statement of dumpStatements(lines)){
   number++;
   try{await connection.query(statement)}catch(error){
    throw new Error(`Falló la sentencia ${number} del respaldo (${error.code||'MYSQL_ERROR'}). Puede haber tablas parciales; no se borraron automáticamente.`);
   }
  }
 }finally{lines.close();input.destroy()}
}
