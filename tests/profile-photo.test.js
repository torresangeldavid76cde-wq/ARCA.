import {test} from 'node:test';
import assert from 'node:assert/strict';
import {photoSchema} from '../server/profile-photo.js';

const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=';
test('las fotos aceptan PNG válido y permiten quitar la imagen',()=>{
 assert.equal(photoSchema.parse('data:image/png;base64,'+png),'data:image/png;base64,'+png);
 assert.equal(photoSchema.parse(''),'');
});
test('las fotos rechazan SVG, datos inválidos y tipos que no coinciden',()=>{
 for(const value of ['https://example.com/photo.jpg','data:image/svg+xml;base64,PHN2Zy8+','data:image/png;base64,aGVsbG8=','data:image/jpeg;base64,'+png,'data:image/png;base64,%%%']){
  assert.equal(photoSchema.safeParse(value).success,false);
 }
});
test('el límite de foto se comprueba en bytes decodificados',()=>{
 const bytes=Buffer.alloc(600001);
 Buffer.from('89504e470d0a1a0a','hex').copy(bytes);
 assert.equal(photoSchema.safeParse('data:image/png;base64,'+bytes.toString('base64')).success,false);
 assert.equal(photoSchema.safeParse('data:image/png;base64,'+bytes.subarray(0,600000).toString('base64')).success,true);
});
