const CHAT_PATH = "/chat";
const PLANS_PATH = "/planos";

export function resolveUiRoute(pathname) {
  const path = String(pathname || "/");

  if (path === "/" || path === "/index.html" || path === "/chat/") {
    return {
      type: "redirect",
      location: CHAT_PATH,
    };
  }

  if (path === CHAT_PATH) {
    return {
      type: "file",
      path: "/index.html",
    };
  }

  if (path === `${PLANS_PATH}/`) {
    return {
      type: "redirect",
      location: PLANS_PATH,
    };
  }

  if (path === PLANS_PATH) {
    return {
      type: "file",
      path: "/plans.html",
    };
  }

  return {
    type: "file",
    path,
  };
}
