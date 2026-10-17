'use client';
import {useEffect,useState} from 'react';
export default function EventAgendaSelect({calendars,value,onChange,disabled=false}:{calendars:{id:string;name:string}[];value:string;onChange:(value:string)=>void;disabled?:boolean}){
 const [targets,setTargets]=useState<{id:string;summary:string}[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function load(){setLoading(true);setError('');try{const r=await fetch('/api/trainings?targets=1',{cache:'no-store'});const data:any=await r.json();if(!r.ok||!Array.isArray(data.targets))throw Error(data.error||data.message||'Não foi possível carregar suas agendas Google.');setTargets(data.targets)}catch(e:any){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 const current=value.startsWith('google:')?value.slice(7):'';
 return <><label className="training-field">Agenda do evento<select aria-label="Agenda do evento" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><optgroup label="Órbita · minhas agendas">{calendars.map(c=><option key={c.id} value={'local:'+c.id}>{c.name}</option>)}</optgroup><optgroup label="Google · conta vinculada">{current&&!targets.some(t=>t.id===current)&&<option value={value}>Agenda Google atual</option>}{targets.map(t=><option key={t.id} value={'google:'+t.id}>{t.summary}</option>)}</optgroup></select></label>{loading&&<p className="hint" role="status">Carregando agendas Google…</p>}{error&&<p className="source-error">{error}<button type="button" disabled={disabled||loading} onClick={load}>Atualizar agendas</button></p>}</>;
}
