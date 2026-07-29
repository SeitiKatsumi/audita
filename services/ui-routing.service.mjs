const CHAT_PATH = "/chat";

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

  return {
    type: "file",
    path,
  };
}
