import {z} from 'zod';

export const photoSchema=z.string().max(800050).refine(value=>{
 if(value==='')return true;
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
 if(!match)return false;
 const bytes=Buffer.from(match[2],'base64');
 if(bytes.length>600000||bytes.toString('base64')!==match[2])return false;
 if(match[1]==='png')return bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
 if(match[1]==='jpeg')return bytes.subarray(0,3).equals(Buffer.from('ffd8ff','hex'));
 return bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
},'Selecciona una foto JPG, PNG o WebP de hasta 600 KB');
