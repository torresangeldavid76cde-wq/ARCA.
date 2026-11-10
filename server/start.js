import 'dotenv/config';
import {app} from './index.js';

const host=process.env.HOST||(process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1');
const server=app.listen(Number(process.env.PORT||4180),host,()=>console.log(`ARCA escuchando en ${host}:${server.address().port}`));
