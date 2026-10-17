'use client';
import {useState} from 'react';
import {Check,Loader2,X} from 'lucide-react';
export type CalendarColors=Record<string,{color:string|null;version:number}>;
export type ColorTarget={id:string;name:string;base:string;color:string;version:number};
const palette=[['Roxo','#9677d3'],['Azul','#537db5'],['Verde','#51816b'],['Turquesa','#268b94'],['Rosa','#cf628f'],['Vermelho','#bd5555'],['Laranja','#c68036'],['Amarelo','#a48d22'],['Marrom','#967052'],['Cinza','#737780']];
export default function CalendarColorDialog({target,onClose,onSaved,onConflict}:{target:ColorTarget;onClose:()=>void;onSaved:(colors:CalendarColors)=>void;onConflict:()=>void}){
 const [color,setColor]=useState<string|null>(target.color);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function save(){if(busy)return;setBusy(true);setError('');try{const res=await fetch('/api/calendar-colors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:target.id,color,version:target.version})});const data=await res.json() as {colors:CalendarColors;error?:string};if(!res.ok){if(res.status===409)onConflict();throw Error(data.error||'Não foi possível salvar a cor.')}onSaved(data.colors)}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <div className="modal-backdrop" onClick={()=>!busy&&onClose()}><form className="event-modal rename-modal color-modal" role="dialog" aria-modal="true" aria-label={'Cor da agenda '+target.name} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();if(!busy)onClose()}}} onSubmit={e=>{e.preventDefault();save()}}>
 <div className="modal-top"><span className="eyebrow">APARÊNCIA DA AGENDA</span><button autoFocus type="button" className="icon" aria-label="Fechar cores" disabled={busy} onClick={onClose}><X size={18}/></button></div>
 <h2>Cor da agenda</h2><p className="color-preview"><span style={{background:color||target.base}}/>{target.name}</p>
 <div className="color-palette" role="group" aria-label="Cores disponíveis">{palette.map(([name,value])=><button key={value} type="button" aria-label={name} aria-pressed={color?.toLowerCase()===value} disabled={busy} className="color-swatch" style={{background:value}} onClick={()=>setColor(value)}>{color?.toLowerCase()===value&&<Check size={19}/>}</button>)}</div>
 <label className="custom-calendar-color">Cor personalizada<input type="color" aria-label="Cor personalizada" disabled={busy} value={color||target.base} onChange={e=>setColor(e.target.value)}/><span>{color||target.base}</span></label>
 <button type="button" className="cancel-button" disabled={busy} onClick={()=>setColor(null)}>Restaurar cor original</button>
 <p className="hint">Esta preferência será salva na sua conta do Órbita e sincronizada entre seus dispositivos.</p>
 {error&&<p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button type="button" className="cancel-button" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" className="save-button" disabled={busy}>{busy?<Loader2 size={15} className="spin"/>:<Check size={15}/>} {busy?'Salvando…':'Salvar cor'}</button></div>
 </form></div>
}
