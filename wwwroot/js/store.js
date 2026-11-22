// نفس واجهة Store التي يستخدمها app.js الأصلي؛ تم استبدال Supabase بـ ASP.NET Core APIs.
const Store = (() => {
  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: { ...(options.headers || {}) }
    });
    const type = response.headers.get("content-type") || "";
    const data = type.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      const message = data && typeof data === "object" ? (data.message || data.title) : data;
      const error = new Error(message || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  const auth = {
    configured: () => true,
    getSession: async () => {
      try { return await request("/api/auth/me"); }
      catch (error) { if (error.status === 401) return null; throw error; }
    },
    signIn: async (email, password) => request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    }),
    signOut: async () => request("/api/auth/logout", { method: "POST" }),
    onChange: callback => { /* الجلسة محفوظة في Cookie آمنة ويعاد التحقق منها عند فتح الصفحة. */ }
  };

  async function api(url, options = {}) {
    return request(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
  }

  async function uploadFile(file, onProgress) {
    if (!file) throw new Error("لم يتم اختيار ملف.");
    const form = new FormData();
    form.append("file", file);
    onProgress?.(5);
    const result = await request("/api/media/upload", { method: "POST", body: form });
    onProgress?.(100);
    return result.url;
  }

  return { api, uploadFile, auth };
})();
const api = Store.api, uploadFile = Store.uploadFile;
