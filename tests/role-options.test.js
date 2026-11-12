import assert from 'node:assert/strict';
import {test} from 'node:test';
import {availableRoleBases} from '../src/role-options.js';

test('crear rol excluye Administrador, Multimedia y Asistencia pastoral sin alterar los roles existentes',()=>{
 const roles=[
  {nombre:'administrador',nombre_visible:'Administrador'},
  {nombre:'multimedia',nombre_visible:'Nombre personalizado'},
  {nombre:'asistencia_pastoral',nombre_visible:'Asistencia pastoral'},
  {nombre:'docente',nombre_visible:'Docente'},
  {nombre:'rol_personalizado',nombre_visible:'Rol personalizado',base_role:'multimedia'}
 ];
 assert.deepEqual(availableRoleBases(roles),roles.slice(3));
 assert.equal(roles.length,5);
});
