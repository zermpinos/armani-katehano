export function mockRes() {
  const res = {
    statusCode: 200,
    _headers:   {},
    _body:      undefined as unknown,
    setHeader(k: string, v: string) { Reflect.set(res._headers, k, v); return res; },
    status(code: number)            { res.statusCode = code; return res; },
    json(body: unknown)             { res._body = body; return res; },
    end()           { return res; },
  };
  return res;
}

export function mockReq({ method = "GET", headers = {}, body = {}, cookies = {} } = {}) {
  return { method, headers, body, cookies, query: {} };
}
