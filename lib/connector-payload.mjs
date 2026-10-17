export function connectorPayload(result){
 if(result.status!=='success')throw Error('Consulta não confirmada.');
 if(result.result.structuredContent!==undefined)return result.result.structuredContent;
 for(const block of result.result.content){if(block.type==='text'&&typeof block.text==='string'){try{return JSON.parse(block.text)}catch{}}}
 throw Error('O Google retornou dados não reconhecidos.');
}
