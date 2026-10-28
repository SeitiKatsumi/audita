import { ITAU_CONTRACT_PARAGRAPHS } from './itau-contract-text.mjs';

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

export function buildItauContractPreviewHtml({ claimant = {}, legalProvider = {}, acceptance = {} } = {}) {
  const value = input => input || "Não informado";
  const city = [claimant.city, claimant.uf].filter(Boolean).join('/');
  const address = claimant.address || [claimant.street, claimant.addressNumber, claimant.complement, claimant.district, city, claimant.postalCode].filter(Boolean).join(', ');
  let signatureOwner = '';
  const content = ITAU_CONTRACT_PARAGRAPHS.map((original, index) => {
    let text = original;
    if (claimant.fullName && text.startsWith('CLIENTE/CONTRATANTE:')) {
      text = `CLIENTE/CONTRATANTE: ${claimant.fullName}, ${value(claimant.nationality)}, ${value(claimant.maritalStatus)}, ${value(claimant.profession)}, portador(a) do RG nº ${value(claimant.rg)} e inscrito(a) no CPF nº ${value(claimant.document)}, residente e domiciliado(a) em ${value(address)}, telefone ${value(claimant.phone)}, e-mail ${value(claimant.email)};`;
    }
    if (legalProvider.fullName && text.startsWith('ADVOGADO(A)/CONTRATADO(A):')) {
      text = `ADVOGADO(A)/CONTRATADO(A): ${legalProvider.fullName}, inscrito(a) na OAB/${value(legalProvider.oabUf)} sob nº ${value(legalProvider.oabNumber)}, CPF/CNPJ nº ${value(legalProvider.document)}, com endereço profissional em ${value(legalProvider.address)}, telefone ${value(legalProvider.phone)} e e-mail ${value(legalProvider.email)};`;
    }
    if (text === 'CLIENTE/CONTRATANTE') signatureOwner = 'client';
    if (text === 'ADVOGADO(A)/CONTRATADO(A)' || text.startsWith('TESTEMUNHA ')) signatureOwner = 'other';
    if (signatureOwner === 'client' && claimant.fullName) {
      if (text.startsWith('Nome:')) text = `Nome: ${claimant.fullName}`;
      if (text.startsWith('CPF:')) text = `CPF: ${value(claimant.document)}`;
      if (text.startsWith('Assinatura:') && acceptance.accepted) text = `Assinado eletronicamente pelo contratante: ${value(acceptance.signerName)}. Data: ${value(acceptance.acceptedAt)}. ID ${value(acceptance.id)}. Identificador de integridade: ${value(acceptance.fingerprint)}.`;
    }
    if (city && text.startsWith('15.2.')) text = text.replace('[cidade/UF]', city);
    if (city && acceptance.acceptedAt && text.startsWith('[Cidade/UF],')) text = `${city}, ${acceptance.acceptedAt}.`;
    const tag = index === 0 ? 'h1' : text.startsWith('CLÁUSULA ') ? 'h2' : 'p';
    return `<${tag}>${escapeHtml(text)}</${tag}>`;
  }).join('\n');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contrato de serviços advocatícios</title><style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #111; font: 11pt/1.5 Arial, sans-serif; }
    main { max-width: 800px; margin: auto; padding: 28px; }
    h1 { font-size: 16pt; line-height: 1.3; text-align: center; margin: 0 0 24px; }
    h2 { font-size: 12pt; margin: 24px 0 10px; break-after: avoid; }
    p { margin: 0 0 10px; overflow-wrap: anywhere; orphans: 3; widows: 3; }
    @media print { main { max-width: none; padding: 0; } }
    @media (max-width: 480px) { main { padding: 20px; } }
  </style></head><body><main>${content}</main></body></html>`;
}
