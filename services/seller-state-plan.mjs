export const SELLER_STATES = Object.fromEntries('AC:Acre|AL:Alagoas|AM:Amazonas|AP:Amapá|BA:Bahia|CE:Ceará|DF:Distrito Federal|ES:Espírito Santo|GO:Goiás|MA:Maranhão|MG:Minas Gerais|MS:Mato Grosso do Sul|MT:Mato Grosso|PA:Pará|PB:Paraíba|PE:Pernambuco|PI:Piauí|PR:Paraná|RJ:Rio de Janeiro|RN:Rio Grande do Norte|RO:Rondônia|RR:Roraima|RS:Rio Grande do Sul|SC:Santa Catarina|SE:Sergipe|SP:São Paulo|TO:Tocantins'.split('|').map(value => value.split(':')));
// Same jurisdictions as the existing UF coverage matrix.
const trfs = { TRF1:'AC AP AM BA DF GO MA MT PA PI RO RR TO',TRF2:'ES RJ',TRF3:'MS SP',TRF4:'PR RS SC',TRF5:'AL CE PB PE RN SE',TRF6:'MG' };
const trts = {1:'RJ',2:'SP',3:'MG',4:'RS',5:'BA',6:'PE',7:'CE',8:'PA AP',9:'PR',10:'DF TO',11:'AM RR',12:'SC',13:'PB',14:'RO AC',15:'SP',16:'MA',17:'ES',18:'GO',19:'AL',20:'SE',21:'RN',22:'PI',23:'MT',24:'MS'};
const normalized = value => String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
export function sellerQueriesForState(queries,uf,documentType='cpf',municipality='') {
  if(!Object.hasOwn(SELLER_STATES,uf)) throw new Error('invalid_seller_state');
  return queries.filter(item=> {
    if(!item.documentTypes.includes(documentType)) return false;
    if(item.endpoint==='TribunalRegionalFederal') return (trfs[item.params.REGIAO]||'').split(' ').includes(uf);
    if(item.endpoint==='TribunalRegionalTrabalho') return (trts[item.params.REGIAO]||'').split(' ').includes(uf);
    if(item.endpoint==='CertidaoNegativaDebitosMunicipal') {
      const place=item.params.MUNICIPIO;
      return Boolean(municipality)&&place.endsWith('-'+uf)&&normalized(place.slice(0,place.lastIndexOf('-')))===normalized(municipality);
    }
    return item.scope==='Brasil'||item.scope===uf;
  });
}
const cost=queries=>queries.reduce((sum,item)=>sum+Math.round(Number(item.costBrl||0)*100),0)/100;
export function sellerStatePlans(coverage) {
  const queries=coverage.sellerSources?.queries||[];
  const maxCompanyCostBrl=Math.max(0,...Object.keys(SELLER_STATES).flatMap(uf=> {
    const cities=queries.filter(q=>q.endpoint==='CertidaoNegativaDebitosMunicipal'&&q.params.MUNICIPIO.endsWith('-'+uf)).map(q=>q.params.MUNICIPIO.slice(0,q.params.MUNICIPIO.lastIndexOf('-')));
    return ['',...cities].map(city=>cost(sellerQueriesForState(queries,uf,'cnpj',city)));
  }));
  return Object.entries(SELLER_STATES).map(([uf,name])=> {
    const certificates=coverage.certificates.filter(item=>item.uf===uf),personal=sellerQueriesForState(queries,uf);
    const municipalities=[...new Set(queries.filter(q=>q.documentTypes.includes('cpf')&&q.endpoint==='CertidaoNegativaDebitosMunicipal'&&q.params.MUNICIPIO.endsWith('-'+uf)).map(q=>q.params.MUNICIPIO.slice(0,q.params.MUNICIPIO.lastIndexOf('-'))))];
    return {uf,name,queryIds:personal.map(q=>q.id),certificateCount:certificates.length,requiresCourtData:certificates.length>0,municipalities,baseCostBrl:cost(personal)+certificates.filter(q=>q.provider==='direct_data').length*(coverage.pdfQueryCostBrl||.54),maxCompanyCostBrl,companyLimit:5,discoversCompanies:personal.some(q=>q.id==='vinculos')};
  });
}
