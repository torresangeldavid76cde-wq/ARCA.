import assert from 'node:assert/strict';
import {test} from 'node:test';
import {dumpStatements} from '../server/sql-dump.js';

async function statements(sql){
 const result=[];
 for await(const statement of dumpStatements(sql.split(/\r?\n/)))result.push(statement);
 return result;
}

test('el importador conserva los comentarios ejecutables y el esquema multilínea',async()=>{
 const sql="-- Backup de prueba\n/*!40101 SET NAMES utf8mb4 */;\nCREATE TABLE `example` (\n `id` INT PRIMARY KEY\n);\n-- Fin del respaldo";
 const result=await statements(sql);
 assert.equal(result.length,2);
 assert.match(result[0],/\/\*!40101 SET NAMES utf8mb4 \*\/;/);
 assert.match(result[1],/CREATE TABLE `example`/);
});

test('no divide datos con punto y coma, comillas escapadas ni comentarios dentro de valores',async()=>{
 const sql="INSERT INTO `table;name` VALUES ('a;b','it\\'s;ok','quote'';value','-- ; # /*'); SELECT 1;";
 const result=await statements(sql);
 assert.equal(result.length,2);
 assert.equal(result[0],sql.slice(0,sql.indexOf(' SELECT 1;')));
 assert.equal(result[1],'SELECT 1;');
});

test('maneja comentarios con delimitadores y valores repartidos entre líneas',async()=>{
 const result=await statements("/* comentario;\n multilínea; */\nINSERT INTO t VALUES ('primera;\nsegunda'); -- comentario;\nSELECT 2; # comentario;");
 assert.equal(result.length,2);
 assert.match(result[0],/primera;\nsegunda/);
 assert.match(result[1],/SELECT 2;/);
});

test('rechaza respaldos truncados y rutinas con delimitadores especiales',async()=>{
 for(const sql of ["SELECT 'sin cerrar;",'/* sin cerrar','SELECT 1','DELIMITER $$\nSELECT 1$$'])await assert.rejects(statements(sql));
});
