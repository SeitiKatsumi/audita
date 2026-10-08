export const CERTIFICATE_PRICE_MULTIPLIER=30;
export function certificateQuote(costs,subscriber=false) {
  const baseCents=costs.reduce((sum,cost)=>sum+(cost===0?(subscriber?0:1000):Math.round(cost*100)*(cost>2?10:CERTIFICATE_PRICE_MULTIPLIER)),0);
  const discountCents=subscriber?Math.round(baseCents*.3):0;
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
  return {courts:documentType==='cpf'?(coverage.certificates||[]).filter(c=>ufs.includes(c.uf)):[],
    queries:queries.map(q=>({...q,region:q.scope==='Brasil'?'Cobertura nacional':q.params?.REGIAO?regional(q):q.scope,
      priceCents:certificateQuote([Number(q.costBrl||0)],coverage.certificateSubscriber===true).amountCents}))};
}
