export const CERTIFICATE_PRICE_MULTIPLIER=30;
export const NATIONAL_PROCESS_PAGE = 'certidao-nacional';
export const NATIONAL_PROCESS_TITLE = 'Certidão Nacional dos processos judiciais em todos Tribunais do Brasil por CPF e CNPJ';
export const isNationalProcessQuery = query => ['processos-agrupados', 'processos-completos'].includes(query.id);
export function serviceCertificateSelection(coverage, ufs, documentType, national = false) {
  const selected = certificateSelection(coverage, national ? (coverage.states || []).map(s => s.uf) : ufs, documentType);
  return { courts: national ? [] : selected.courts, queries: selected.queries.filter(q => isNationalProcessQuery(q) === national) };
}
export const DEFAULT_CERTIFICATE_PRICING={standardMarkupPercent:2900,highCostMarkupPercent:900,highCostThresholdCents:200,freeSourceCents:1000,subscriberDiscountPercent:30,exceptions:{'processos-agrupados':{mode:'fixed',value:19900},'processos-completos':{mode:'fixed',value:19900}}};
export function certificateQuote(costs,subscriber=false,pricing=DEFAULT_CERTIFICATE_PRICING) {
  let eligibleCents=0;
  const baseCents=costs.reduce((sum,source)=>{
    const cost=typeof source==='number'?source:source.costBrl,key=typeof source==='number'?'':source.key;
    const rule=Object.hasOwn(pricing.exceptions,key)?pricing.exceptions[key]:null;
    const cents=rule?.mode==='fixed'?rule.value:cost===0?(subscriber?0:pricing.freeSourceCents):Math.round(Math.round(cost*100)*(1+(rule?.value??(Math.round(cost*100)>pricing.highCostThresholdCents?pricing.highCostMarkupPercent:pricing.standardMarkupPercent))/100));
    if(rule?.mode!=='fixed')eligibleCents+=cents;
    return sum+cents;
  },0);
  const discountCents=subscriber?Math.round(eligibleCents*pricing.subscriberDiscountPercent/100):0;
  return {baseCents,discountCents,amountCents:baseCents-discountCents,subscriber};
}
// Coverage comes from the server's validated UF/region plans, not a second jurisdiction map.
export function certificateSelection(coverage,ufs,documentType='cpf') {
  const states=documentType==='cnpj'?coverage.companyStates||[]:coverage.states||[];
  const chosen=states.filter(state=>ufs.includes(state.uf));
  const allowed=new Set(chosen.flatMap(state=>state.queryIds));
  for(const q of coverage.sellerSources?.queries||[])if(q.endpoint==='CertidaoNegativaDebitosMunicipal'&&ufs.some(uf=>q.params.MUNICIPIO.endsWith('-'+uf)))allowed.add(q.id);
  const queries=(coverage.sellerSources?.configured?coverage.sellerSources.queries||[]:[]).filter(q=>['certificate','data'].includes(q.kind)&&q.documentTypes.includes(documentType)&&allowed.has(q.id));
  const regional=q=>states.filter(state=>state.queryIds.includes(q.id)).map(state=>`${state.name} (${state.uf})`).join(', ');
  return {courts:(coverage.certificates||[]).filter(c=>ufs.includes(c.uf)&&(c.documentTypes||['cpf']).includes(documentType)),
    queries:queries.map(q=>({...q,region:q.scope==='Brasil'?'Cobertura nacional':q.params?.REGIAO?regional(q):q.scope,
      priceCents:certificateQuote([{costBrl:Number(q.costBrl||0),key:q.id}],coverage.certificateSubscriber===true,coverage.certificatePricing).amountCents}))};
}
