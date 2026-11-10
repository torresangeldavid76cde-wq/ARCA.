import React,{useEffect,useState} from 'react';

export function PhotoInput({onChange,onError,onReadingChange,disabled=false}){
 const [reading,setReading]=useState(false);
 async function select(event){
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file)return;
  onError('');
  if(file.size>600000||!['image/jpeg','image/png','image/webp'].includes(file.type)){
   onError('Selecciona una foto JPG, PNG o WebP de hasta 600 KB');return;
  }
  setReading(true);
  onReadingChange?.(true);
  try{
   const data=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(Error('No se pudo leer la foto. Inténtalo de nuevo.'));
    reader.onabort=()=>reject(Error('La lectura de la foto se canceló.'));
    reader.readAsDataURL(file);
   });
   await new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve();
    image.onerror=()=>reject(Error('El archivo no contiene una imagen válida.'));
    image.src=data;
   });
   onChange(data);
  }catch(error){onError(error.message)}
  finally{setReading(false);onReadingChange?.(false)}
 }
 return <label>Adjuntar foto (JPG, PNG o WebP, máximo 600 KB)
  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled||reading} onChange={select}/>
  {reading&&<span role="status">Leyendo foto…</span>}
 </label>;
}

export function ProfilePhoto({photo='',name,onSave}){
 const [draft,setDraft]=useState(photo||''),[busy,setBusy]=useState(false),[reading,setReading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{setDraft(photo||'')},[photo,name]);
 async function save(){
  setBusy(true);setError('');setNotice('');
  try{await onSave(draft);setNotice('Foto guardada correctamente')}
  catch(error){setError(error.message)}
  finally{setBusy(false)}
 }
 return <section className="profile-photo-editor">
  <div className="dashboard-profile">
   <div className="dashboard-photo">{draft?<img src={draft} alt={'Foto de '+name}/>:<span>Sin foto<br/>asignada</span>}</div>
   <div><h3>{name}</h3><p>Foto de perfil</p></div>
  </div>
  {onSave&&<>
   <PhotoInput onChange={value=>{setDraft(value);setNotice('')}} onError={setError} onReadingChange={setReading} disabled={busy}/>
   <div className="actions">
    <button type="button" className="primary" disabled={busy||reading||draft===(photo||'')} onClick={save}>{busy?'Guardando…':'Guardar foto'}</button>
    <button type="button" disabled={busy||reading||!draft} onClick={()=>{setDraft('');setNotice('')}}>Quitar foto</button>
   </div>
   <p className="muted">Los cambios se aplican al pulsar Guardar foto.</p>
  </>}
  {error&&<p role="alert" className="error">{error}</p>}
  {notice&&<p role="status" className="success">{notice}</p>}
 </section>;
}
