export type TransferOutcome={state:'checking'|'creating'|'created'|'removing'|'moved'|'copied'|'blocked'|'unknown';message:string;event?:any};
/** Each side effect is preceded by a durable receipt. An uncertain operation is never resent. */
export async function executeEventTransfer(deps:{prepare:()=>Promise<string|null>;persist:(outcome:TransferOutcome)=>Promise<void>;create:()=>Promise<{event?:any;error?:string;uncertain?:boolean}>;remove:()=>Promise<boolean>}):Promise<TransferOutcome>{
 let target:any;
 const finish=async(outcome:TransferOutcome)=>{await deps.persist(outcome);return outcome};
 try{
  const error=await deps.prepare();if(error)return finish({state:'blocked',message:error});
  await deps.persist({state:'creating',message:'Salvando na agenda de destino. O original continua preservado.'});
  const result=await deps.create();
  if(!result.event)return finish({state:result.uncertain?'unknown':'blocked',message:result.error||'O destino não confirmou a criação. O original foi preservado.'});
  target=result.event;
  await deps.persist({state:'created',message:'Destino confirmado. Conferindo a remoção do original.',event:target});
  await deps.persist({state:'removing',message:'Finalizando a mudança de agenda.',event:target});
  const removed=await deps.remove();
  return finish({state:removed?'moved':'copied',message:removed?'Evento movido para a agenda escolhida.':'O evento foi salvo no destino, mas a remoção do original não foi confirmada. Confira as duas agendas antes de repetir.',event:target});
 }catch{
  return finish({state:target?'copied':'unknown',message:target?'O destino foi confirmado. Confira o original antes de fazer outra alteração.':'O resultado não foi confirmado. O original não foi removido; confira o destino antes de repetir.',...(target?{event:target}:{})});
 }
}
