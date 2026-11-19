const modulePath = new URL(import.meta.url).pathname;
const assetsIndex = modulePath.lastIndexOf("/assets/");
const appBasePath = assetsIndex === -1 ? "/" : modulePath.slice(0, assetsIndex + 1);
const apiBasePath = `${appBasePath}api`;

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBasePath}${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new ApiError("Server lokal mengirim respons yang tidak valid.", response.status);
  }
  if (!response.ok) {
    throw new ApiError(
      result.error?.message || "Permintaan ke server lokal gagal.",
      response.status,
    );
  }
  return result;
}

const encode = (value) => encodeURIComponent(value);
const jsonRequest = (method, body) => ({
  method,
  body: JSON.stringify(body),
});

export const localApi = {
  entities: new Proxy(
    {},
    {
      get: (_target, entity) => {
        if (typeof entity !== "string") return undefined;
        const path = `/entities/${encode(entity)}`;
        return {
          list: (sort, limit) => {
            const params = new URLSearchParams();
            if (sort) params.set("sort", sort);
            if (limit) params.set("limit", String(limit));
            const query = params.size ? `?${params}` : "";
            return request(`${path}${query}`).then(({ data }) => data);
          },
          filter: (filter = {}, sort, limit) => {
            const params = new URLSearchParams({ filter: JSON.stringify(filter) });
            if (sort) params.set("sort", sort);
            if (limit) params.set("limit", String(limit));
            return request(`${path}?${params}`).then(({ data }) => data);
          },
          get: (id) =>
            request(`${path}/${encode(id)}`).then(({ data }) => data),
          create: (record) =>
            request(path, jsonRequest("POST", record)).then(
              ({ data }) => data,
            ),
          update: (id, record) =>
            request(`${path}/${encode(id)}`, jsonRequest("PUT", record)).then(
              ({ data }) => data,
            ),
          delete: (id) =>
            request(`${path}/${encode(id)}`, { method: "DELETE" }),
          bulkCreate: (records) =>
            request(`${path}/bulk`, jsonRequest("POST", { records })).then(
              ({ data }) => data,
            ),
        };
      },
    },
  ),
  auth: {
    loginViaEmailPassword: (email, password) =>
      request("/auth/login", jsonRequest("POST", { email, password })),
    register: (details) =>
      request("/auth/register", jsonRequest("POST", details)),
    me: () => request("/auth/me").then(({ user }) => user),
    logout: () => request("/auth/logout", jsonRequest("POST", {})),
    resetPasswordRequest: (email) =>
      request(
        "/auth/forgot-password",
        jsonRequest("POST", { email }),
      ),
    resetPassword: ({ resetToken, newPassword }) =>
      request(
        "/auth/reset-password",
        jsonRequest("POST", { token: resetToken, password: newPassword }),
      ),
  },
  app: {
    getPublicSettings: () => request("/settings"),
    companyLogoUrl: (fileId) =>
      `${apiBasePath}/branding/logo${fileId ? `?v=${encode(fileId)}` : ""}`,
    uploadCompanyLogo: (file) => {
      const formData = new FormData();
      formData.append("file", file);
      return request("/branding/logo", { method: "POST", body: formData });
    },
  },
  users: {
    inviteUser: (email) =>
      request("/users/invite", jsonRequest("POST", { email })),
  },
  integrations: {
    Core: {
      UploadPrivateFile: ({ file }) => {
        const formData = new FormData();
        formData.append("file", file);
        return request("/files", { method: "POST", body: formData });
      },
      CreateFileSignedUrl: async ({ file_uri: fileUri }) => ({
        signed_url: new URL(fileUri, window.location.origin).href,
      }),
    },
  },
};

export { ApiError, appBasePath };
