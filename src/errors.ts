'use strict'

class AbortError extends Error {
  constructor () {
    super('The operation was aborted')
    this.name = 'AbortError'
  }
}

class MgHTTPError extends Error {
  constructor (message?:string) {
    super(message || "MgHTTPError")
    this.name = 'MgHTTPError'
  }
}

export class ConnectTimeoutError extends MgHTTPError {
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, ConnectTimeoutError)
    this.name = 'ConnectTimeoutError'
    this.message = message || 'Connect Timeout Error'
  }
}

export class HeadersTimeoutError extends MgHTTPError {
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, HeadersTimeoutError)
    this.name = 'HeadersTimeoutError'
    this.message = message || 'Headers Timeout Error'
  }
}

export class HeadersOverflowError extends MgHTTPError {
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, HeadersOverflowError)
    this.name = 'HeadersOverflowError'
    this.message = message || 'Headers Overflow Error'
  }
}

export class BodyTimeoutError extends MgHTTPError {
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, BodyTimeoutError)
    this.name = 'BodyTimeoutError'
    this.message = message || 'Body Timeout Error'
  }
}

export class InvalidArgumentError extends MgHTTPError {
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, InvalidArgumentError)
    this.name = 'InvalidArgumentError'
    this.message = message || 'Invalid Argument Error'
  }
}

export class InvalidReturnValueError extends MgHTTPError {
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, InvalidReturnValueError)
    this.name = 'InvalidReturnValueError'
    this.message = message || 'Invalid Return Value Error'
  }
}

export class RequestAbortedError extends MgHTTPError {
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, RequestAbortedError)
    this.name = 'AbortError'
    this.message = message || 'Request aborted'
  }
}

export class InformationalError extends MgHTTPError {
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, InformationalError)
    this.name = 'InformationalError'
    this.message = message || 'Request information'
  }
}

export class RequestContentLengthMismatchError extends MgHTTPError {
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, RequestContentLengthMismatchError)
    this.name = 'RequestContentLengthMismatchError'
    this.message = message || 'Request body length does not match content-length header'
  }
}

export class ResponseContentLengthMismatchError extends MgHTTPError {
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, ResponseContentLengthMismatchError)
    this.name = 'ResponseContentLengthMismatchError'
    this.message = message || 'Response body length does not match content-length header'
  }
}

export class ClientDestroyedError extends MgHTTPError {
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, ClientDestroyedError)
    this.name = 'ClientDestroyedError'
    this.message = message || 'The client is destroyed'
  }
}

export class ClientClosedError extends MgHTTPError {
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, ClientClosedError)
    this.name = 'ClientClosedError'
    this.message = message || 'The client is closed'
  }
}

export class SocketError extends MgHTTPError {
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, SocketError)
    this.name = 'SocketError'
    this.message = message || 'Socket error'
  }
}

export class NotSupportedError extends MgHTTPError {
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, NotSupportedError)
    this.name = 'NotSupportedError'
    this.message = message || 'Not supported error'
  }
}

export class BalancedPoolMissingUpstreamError extends MgHTTPError {
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, NotSupportedError)
    this.name = 'MissingUpstreamError'
    this.message = message || 'No upstream has been added to the BalancedPool'
  }
}

export class HTTPParserError extends MgHTTPError {
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, HTTPParserError)
    this.name = 'HTTPParserError'
  }
}

export class ProxyError extends MgHTTPError{
  constructor (message?:string) {
    super(message)
    Error.captureStackTrace(this, ProxyError)
    this.name = 'ProxyError'
  }
}
