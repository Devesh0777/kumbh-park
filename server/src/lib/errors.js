/** Error with an HTTP status and a stable machine-readable `code`. */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  static badRequest(message = 'Invalid request', details) {
    return new ApiError(400, 'BAD_REQUEST', message, details)
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, 'UNAUTHORIZED', message)
  }

  static forbidden(message = 'Not allowed') {
    return new ApiError(403, 'FORBIDDEN', message)
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, 'NOT_FOUND', message)
  }

  static conflict(code, message, details) {
    return new ApiError(409, code, message, details)
  }

  static gone(code, message) {
    return new ApiError(410, code, message)
  }

  static tooMany(message = 'Too many requests') {
    return new ApiError(429, 'RATE_LIMITED', message)
  }

  static internal(message = 'Something went wrong') {
    return new ApiError(500, 'INTERNAL_ERROR', message)
  }
}
