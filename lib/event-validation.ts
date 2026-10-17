import {z} from 'zod';
import {phoneRegion,brazilZones} from './brazil-time.mjs';
export const contactFields={contactName:z.string().trim().max(200).optional(),companyName:z.string().trim().max(200).optional(),phone:z.string().trim().max(24).refine(v=>!v||phoneRegion(v).valid,'Informe um telefone brasileiro completo com DDD.').optional()};
export const brazilTimezone=z.string().refine(v=>brazilZones.some(([zone])=>zone===v));
export function validContactZone(v:{phone?:string;timezone?:string}){const region=phoneRegion(v.phone);return !v.phone||!region.choices.length||region.choices.includes(v.timezone||'')}
