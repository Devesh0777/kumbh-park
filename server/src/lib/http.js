/** Wraps async route handlers so rejected promises reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

/** Sends a consistent envelope: { data } or { error: { code, message, details } }. */
export const sendData = (res, data, status = 200) => res.status(status).json({ data })

export const sendPage = (res, { items, page, pageSize, total }) =>
  res.json({ data: items, meta: { page, pageSize, total, hasMore: page * pageSize < total } })
