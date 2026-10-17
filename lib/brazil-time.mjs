// DDD regions: Anatel. Civil time: IANA time zones (Intl); never use the server's zone.
export const brazilZones = [
 ['America/Sao_Paulo','Brasília / Sul / Sudeste'],['America/Araguaina','Tocantins'],['America/Bahia','Bahia'],
 ['America/Fortaleza','Ceará / Maranhão / Piauí / Paraíba / RN'],['America/Recife','Pernambuco'],['America/Maceio','Alagoas / Sergipe'],
 ['America/Belem','Pará / Amapá'],['America/Santarem','Oeste do Pará'],['America/Manaus','Manaus / Amazonas'],
 ['America/Boa_Vista','Roraima'],['America/Porto_Velho','Rondônia'],['America/Cuiaba','Mato Grosso'],['America/Campo_Grande','Mato Grosso do Sul'],
 ['America/Rio_Branco','Acre'],['America/Eirunepe','Oeste do Amazonas'],['America/Noronha','Fernando de Noronha / ilhas oceânicas']
];
export const dddZones = Object.fromEntries([
 ['11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 64','America/Sao_Paulo'],
 ['63','America/Araguaina'],['65 66','America/Cuiaba'],['67','America/Campo_Grande'],['68','America/Rio_Branco'],['69','America/Porto_Velho'],
 ['71 73 74 75 77','America/Bahia'],['79 82','America/Maceio'],['81 87','America/Recife'],['83 84 85 86 88 89 98 99','America/Fortaleza'],
 ['91 94 96','America/Belem'],['93','America/Santarem'],['92 97','America/Manaus'],['95','America/Boa_Vista']
].flatMap(([codes,zone])=>codes.split(' ').map(code=>[code,zone])));
export function phoneDigits(phone=''){
 if(!/^[\d\s()+-]*$/.test(phone))return '';
 let digits=phone.replace(/\D/g,'');
 if(phone.trim().startsWith('+'))return digits.startsWith('55')?digits.slice(2):'';
 if((digits.length===12||digits.length===13)&&digits.startsWith('55'))digits=digits.slice(2);
 if(digits.startsWith('0'))digits=digits.slice(1);
 return digits;
}
export function phoneRegion(phone=''){
 const digits=phoneDigits(phone),ddd=digits.slice(0,2),timezone=dddZones[ddd];
 const choices=ddd==='97'?['America/Manaus','America/Eirunepe']:ddd==='81'?['America/Recife','America/Noronha']:ddd==='27'||ddd==='84'?[timezone,'America/Noronha']:[];
 return {ddd,timezone,choices,valid:!!timezone&&(digits.length===10||digits.length===11)};
}
export function defaultBrazilZone(){const local=Intl.DateTimeFormat().resolvedOptions().timeZone;return brazilZones.some(([zone])=>zone===local)?local:'America/Sao_Paulo'}
export function zonedInput(iso,timezone){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function wallToIso(wall,timezone){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wall))throw Error('Confira a data e o horário.');
 const desired=Date.parse(wall+'Z');if(!Number.isFinite(desired))throw Error('Data inválida.');
 let instant=desired;
 for(let i=0;i<4;i++){const represented=Date.parse(zonedInput(new Date(instant).toISOString(),timezone)+'Z');const delta=desired-represented;if(!delta)break;instant+=delta;}
 const result=new Date(instant).toISOString();if(zonedInput(result,timezone)!==wall)throw Error('Esse horário não existe no fuso selecionado. Escolha outro horário.');return result;
}
export function shiftWall(wall,minutes){return new Date(Date.parse(wall+'Z')+minutes*60000).toISOString().slice(0,16)}
export function zoneLabel(timezone,wall){
 const region=brazilZones.find(([zone])=>zone===timezone)?.[1]||timezone;
 try{const offset=new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,timeZoneName:'shortOffset'}).formatToParts(new Date(wallToIso(wall,timezone))).find(p=>p.type==='timeZoneName')?.value||'';return region+' · '+offset.replace('GMT','UTC')}catch{return region}
}
export function contactDescription(payload){
 const lines=[payload.contactName&&'Nome: '+payload.contactName,payload.companyName&&'Empresa: '+payload.companyName,payload.phone&&'Telefone: '+payload.phone].filter(Boolean);
 return [payload.description,lines.length?'Contato\n'+lines.join('\n'):''].filter(Boolean).join('\n\n');
}
// Only recognize the terminal contact block written by Órbita. Other notes stay intact.
export function readContactDescription(description=''){
 const result={description,contactName:'',companyName:'',phone:''};
 const match=/(?:^|\n\n)Contato\n((?:(?:Nome|Empresa|Telefone): [^\r\n]+\n?)+)$/.exec(description);
 if(!match)return result;
 const keys={Nome:'contactName',Empresa:'companyName',Telefone:'phone'};
 const seen=new Set();
 for(const line of match[1].trimEnd().split('\n')){
  const part=/^(Nome|Empresa|Telefone): (.+)$/.exec(line);
  if(!part||seen.has(part[1]))return result;
  seen.add(part[1]);result[keys[part[1]]]=part[2];
 }
 result.description=description.slice(0,match.index);
 return result;
}
