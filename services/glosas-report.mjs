import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
export async function glosasPdf(text){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 let page,y=0;
 const next=()=>{page=doc.addPage([595.28,841.89]);page.drawText('IA AUDITA | GLOSAS',{x:42,y:802,size:14,font:bold,color:rgb(.05,.3,.4)});page.drawText('PRELIMINAR - REVISAO PROFISSIONAL NECESSARIA',{x:42,y:781,size:9,font});page.drawText(String(doc.getPageCount()),{x:540,y:24,size:9,font});y=752;};next();
 for(const paragraph of text.split('\n')){
  const clean=paragraph.replace(/[^\x20-\x7e\u00a0-\u00ff]/g,' ');let line='';
  for(const character of clean){if(font.widthOfTextAtSize(line+character,10)>510){if(y<48)next();page.drawText(line,{x:42,y,size:10,font});y-=15;line='';}line+=character;}
  if(y<48)next();if(line)page.drawText(line,{x:42,y,size:10,font});y-=17;
 }
 return Buffer.from(await doc.save());
}
