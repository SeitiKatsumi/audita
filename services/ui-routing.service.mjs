const CHAT_PATH = "/chat";
const PLANS_PATH = "/planos";
const SUPER_ADMIN_PATH = "/super-admin";

export function resolveUiRoute(pathname) {
  const path = String(pathname || "/");

  if (path === "/chat/") {
    return {
      type: "redirect",
      location: CHAT_PATH,
    };
  }

  if (path === "/" || path === "/index.html" || path === CHAT_PATH) {
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

  if (path === `${SUPER_ADMIN_PATH}/`) {
    return {
      type: "redirect",
      location: SUPER_ADMIN_PATH,
    };
  }

  if (path === SUPER_ADMIN_PATH) {
    return {
      type: "file",
      path: "/super-admin.html",
    };
  }

  return {
    type: "file",
    path,
  };
}
