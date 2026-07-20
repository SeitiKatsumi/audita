import {
  failedResult,
  manualRequiredResult,
  SOURCE_RESULT,
  successResult,
  unavailableResult,
  waitingUserActionResult,
} from "./base.collector.mjs";
import { submitOnrRequest } from "../services/onr-ri-digital.service.mjs";

export const fonte = "imoveis_onr";

export async function collect(input) {
  const fields = input.extraFields || {};
  const providerResult = await submitOnrRequest({
    tipoDocumento: input.tipoDocumento,
    documento: input.documento,
    subjectName: fields.propertySubjectName || fields.fullName || fields.razaoSocial || fields.cnibSubjectName || "",
    registryOfficeId: fields.propertyRegistryOfficeId || 0,
    registryOfficeIds: fields.propertyRegistryOfficeIds || [],
    certificatePurposeId: fields.propertyCertificatePurposeId || 0,
    includeTransferred: fields.propertyIncludeTransferred === true,
    transferDate: fields.propertyTransferDate || "",
    uf: fields.propertyUf || fields.stateCourtUf || "",
    operation: fields.propertyOperation || "pesquisa_previa",
    registrationNumber: fields.propertyRegistrationNumber || "",
    registryOffice: fields.propertyRegistryOffice || "",
    city: fields.propertyCity || "",
    referenceId: input.consultaId,
  });

  const data = {
    ...providerResult,
    observacaoJuridica:
      "A Pesquisa Prévia localiza referências de matrícula, mas não comprova propriedade atual. Confirme o vínculo com Pesquisa Qualificada ou Certidão Digital.",
  };

  if (providerResult.status === "completed") {
    const result = providerResult.outcome === "nothing_found" ? SOURCE_RESULT.NADA_CONSTA : SOURCE_RESULT.CONSTA;
    return successResult(fonte, result, data);
  }
  if (providerResult.status === "unavailable") {
    return unavailableResult(fonte, providerResult.summary || "Integração ONR indisponível.", data);
  }
  if (providerResult.status === "failed") {
    return failedResult(fonte, providerResult.summary || "Falha ao consultar o ONR.", data);
  }
  if (providerResult.nextAction === "choose_qualified_search") {
    return manualRequiredResult(fonte, providerResult.summary, data);
  }
  return waitingUserActionResult(fonte, providerResult.summary || "Conclua o pedido no portal oficial.", data);
}

export function discoverIntegrationStrategy() {
  return [
    "Pesquisa Prévia oficial para localizar matrículas por CPF/CNPJ nas UFs participantes.",
    "Pesquisa Qualificada para confirmar o vínculo atual com a matrícula.",
    "Certidão Digital para obter a evidência oficial assinada pelo Registro de Imóveis.",
    "Adapter de API isolado e habilitado somente após credenciamento/contrato ONR.",
    "Contingência operacional por protocolo e importação do resultado oficial, sem scraping.",
  ];
}
