// Idempotently seed new L6 material without resetting existing D1 data.
import { mkdirSync, writeFileSync } from "node:fs";
import { PASSAGES } from "../src/content/passages";
import { charCount, type AnalysisSpec } from "../src/lib/domain";
const OUT=".wrangler/level6-seed.sql";
const q=(v:unknown)=>v==null?"NULL":typeof v==="number"?String(v):"'"+(typeof v==="string"?v:JSON.stringify(v)).replace(/'/g,"''")+"'";
const ins=(t:string,c:string[],v:unknown[],w:string)=>`INSERT INTO "${t}" (${c.map(x=>`"${x}"`).join(",")}) SELECT ${v.map(q).join(",")} WHERE NOT EXISTS (SELECT 1 FROM "${t}" WHERE ${w});`;
const typ=(a:AnalysisSpec)=>({roles:"ROLES",audit:"AUDIT",quiz:"QUIZ",sequence:"SEQUENCE"})[a.kind];
const out=["-- Incrementally add L6 content."];
for(const p of PASSAGES.filter(x=>x.level==="L6")){
 const id=`level6-${p.slug}`,now=Date.now();
 out.push(ins("passages",["id","slug","title","genre","grade","level","primary_ability","tutor_role","lead","paragraphs","char_count","status","version","created_at","updated_at"],[id,p.slug,p.title,p.genre,p.grade,p.level,p.primaryAbility,p.tutorRole,p.lead,p.paragraphs,charCount(p),"PUBLISHED",1,now,now],`slug = ${q(p.slug)}`));
 out.push(ins("content_cards",["id","passage_id","source","structure","concepts","thesis_location","misreadings","prerequisites","goals","review","ref_summary"],[`${id}-card`,id,p.card.source,p.card.structure,p.card.concepts,p.card.thesisLocation,p.card.misreadings,p.card.prerequisites??null,p.card.goals,{factCheck:true,ageFit:true,groundedQuestions:true,reviewer:"教研组",version:"v1.0"},p.refSummary],`passage_id = ${q(id)}`));
 p.keyPoints.forEach((k,i)=>out.push(ins("key_points",["id","passage_id","order","text","keywords","paragraph"],[`${id}-kp-${i+1}`,id,i,k.text,k.keywords,k.paragraph,`passage_id = ${q(id)} AND "order" = ${i}`])));
 const ex=[{n:0,step:"PREDICT",type:"PREDICT",ability:p.primaryAbility,spec:p.predict},{n:1,step:"ANALYZE",type:typ(p.analysis),ability:p.analysisAbility,spec:p.analysis},{n:2,step:"EXPRESS",type:"SUMMARY",ability:"EXPRESS",spec:{mode:p.expressMode}},...(p.transfer?[{n:3,step:"EXPRESS",type:"TRANSFER",ability:"EXPRESS",spec:{prompt:p.transfer}}]:[])];
 ex.forEach(z=>out.push(ins("exercises",["id","passage_id","step","type","ability","order","spec"],[`${id}-ex-${z.n}`,id,z.step,z.type,z.ability,z.n,z.spec,`passage_id = ${q(id)} AND "order" = ${z.n}`])));
}
mkdirSync(".wrangler",{recursive:true});writeFileSync(OUT,out.join("\n")+"\n");console.log("Prepared L6 content.");
