function check(ok, code, statusCode = 400) {
  if (!ok) throw Object.assign(new Error(code), { code, statusCode, status: statusCode });
}
function id(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

export function createChatRequestService({ accessService, getDocumentContext } = {}) {
  async function execute(auth, body, run) {
    check(auth?.user?.id && auth?.tenantId && !auth.unauthorized, 'chat_unauthorized', 401);
    check(body && typeof body === 'object' && !Array.isArray(body), 'chat_invalid_body');
    check(id(body.requestId), 'chat_invalid_request_id');
    check(Array.isArray(body.messages) && body.messages.length > 0 && body.messages.length <= 24, 'chat_invalid_messages');
    const messages = body.messages.map(message => {
      check(message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string'
        && message.content.trim().length > 0 && message.content.length <= 5000, 'chat_invalid_messages');
      return { role: message.role, content: message.content.trim() };
    });
    check(messages.at(-1).role === 'user', 'chat_invalid_messages');
    check(messages.reduce((total, message) => total + message.content.length, 0) <= 32000, 'chat_context_too_large');
    let caseContext = null;
    if (body.caseContext != null) {
      check(typeof body.caseContext === 'object' && !Array.isArray(body.caseContext), 'chat_invalid_context');
      let encoded;
      try { encoded = JSON.stringify(body.caseContext); } catch { check(false, 'chat_invalid_context'); }
      check(typeof encoded === 'string' && encoded.length <= 24000, 'chat_invalid_context');
      caseContext = JSON.parse(encoded);
    }
    check(body.browserSessionId == null || id(body.browserSessionId), 'chat_invalid_browser_session');
    check(body.documentId == null || id(body.documentId), 'chat_invalid_document_id');
    check(typeof run === 'function', 'chat_runner_unavailable', 503);
    const input = { requestId: body.requestId, messages, caseContext,
      browserSessionId: body.browserSessionId ?? null, documentId: body.documentId ?? null, documentContext: '' };
    const held = await accessService.reserve(auth, { requestId: input.requestId, kind: 'messages', quantity: 1 });
    if (held.status === 'completed') return held.result;
    check(held.status === 'reserved' && !held.duplicate, 'chat_request_conflict', 409);
    let result;
    try {
      if (input.documentId) {
        check(typeof getDocumentContext === 'function', 'chat_document_unavailable', 503);
        const context = await getDocumentContext(auth, input.documentId);
        check(typeof context === 'string' && context.length <= 24000, 'chat_invalid_document_context');
        input.documentContext = context;
      }
      result = await run(input);
    } catch (error) {
      await accessService.release(auth, { requestId: input.requestId });
      error.quotaReleased = true;
      throw error;
    }
    if (result?.invalid || result?.unavailable || result?.unauthorized) {
      await accessService.release(auth, { requestId: input.requestId });
      return { ...result, quotaReleased: true };
    }
    if (typeof result?.answer !== 'string' || !result.answer.trim()) {
      await accessService.release(auth, { requestId: input.requestId });
      throw Object.assign(new Error('chat_no_answer'), { code: 'chat_no_answer', statusCode: 502, quotaReleased: true });
    }
    // Do not release after a successful run if saving its result fails: reconcile it.
    await accessService.complete(auth, { requestId: input.requestId, result });
    return result;
  }
  return { execute };
}
