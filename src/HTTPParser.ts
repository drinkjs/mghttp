/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-undef */
import * as assert from "assert"
import { readFileSync } from "fs";
import { resolve } from "path";

import * as constants from './llhttp/constants';
const bin = readFileSync(resolve(__dirname, './llhttp/llhttp.wasm'));
const mod = new WebAssembly.Module(bin);

let currentParser = null
let currentBufferRef = null
let currentBufferSize = 0
let currentBufferPtr = null

const llhttpInstance = new WebAssembly.Instance(mod, {
  env: {
    /* eslint-disable camelcase */

    wasm_on_url: (p, at, len) => {
      /* istanbul ignore next */
      return 0
    },
    wasm_on_status: (p, at, len) => {
      assert.strictEqual(currentParser.ptr, p)
      const start = at - currentBufferPtr
      const end = start + len
      return currentParser.onStatus(currentBufferRef.slice(start, end)) || 0
    },
    wasm_on_message_begin: (p) => {
      assert.strictEqual(currentParser.ptr, p)
      return currentParser.onMessageBegin() || 0
    },
    wasm_on_header_field: (p, at, len) => {
      assert.strictEqual(currentParser.ptr, p)
      const start = at - currentBufferPtr
      const end = start + len
      return currentParser.onHeaderField(currentBufferRef.slice(start, end)) || 0
    },
    wasm_on_header_value: (p, at, len) => {
      assert.strictEqual(currentParser.ptr, p)
      const start = at - currentBufferPtr
      const end = start + len
      return currentParser.onHeaderValue(currentBufferRef.slice(start, end)) || 0
    },
    wasm_on_headers_complete: (p, statusCode, upgrade, shouldKeepAlive) => {
      assert.strictEqual(currentParser.ptr, p)
      return currentParser.onHeadersComplete(statusCode, Boolean(upgrade), Boolean(shouldKeepAlive)) || 0
    },
    wasm_on_body: (p, at, len) => {
      assert.strictEqual(currentParser.ptr, p)
      const start = at - currentBufferPtr
      const end = start + len
      return currentParser.onBody(currentBufferRef.slice(start, end)) || 0
    },
    wasm_on_message_complete: (p) => {
      assert.strictEqual(currentParser.ptr, p)
      return currentParser.onMessageComplete() || 0
    }

    /* eslint-enable camelcase */
  }
})

export default class Parser {

  llhttp: any
  ptr: any
  statusCode: number
  statusText: string
  upgrade: boolean
  headers:Buffer[] = [];
  headersSize: number;
  shouldKeepAlive: boolean;
  keepAlive:string
  contentLength:string;
  bodyBuffs: Buffer[] = [];

  _onComplete:(statusCode:number, headers?:{[key:string]:string}, body?:Buffer)=>void | null = null;

  constructor() {
    this.llhttp = llhttpInstance.exports;
    this.ptr = this.llhttp.llhttp_alloc(constants.TYPE.RESPONSE)
    this.statusCode = null
    this.statusText = ''
    this.upgrade = false
    this.shouldKeepAlive = false
    this.keepAlive = ""
    this.contentLength = ""
  }

  execute(data:Buffer) {
    assert(this.ptr != null)
    assert(currentParser == null)

    const { llhttp } = this

    if (data.length > currentBufferSize) {
      if (currentBufferPtr) {
        llhttp.free(currentBufferPtr)
      }
      currentBufferSize = Math.ceil(data.length / 4096) * 4096
      currentBufferPtr = llhttp.malloc(currentBufferSize)
    }

    new Uint8Array(llhttp.memory.buffer, currentBufferPtr, currentBufferSize).set(data)

    // Call `execute` on the wasm parser.
    // We pass the `llhttp_parser` pointer address, the pointer address of buffer view data,
    // and finally the length of bytes to parse.
    // The return value is an error code or `constants.ERROR.OK`.
    let ret;
    try {
      currentBufferRef = data
      currentParser = this
      ret = llhttp.llhttp_execute(this.ptr, currentBufferPtr, data.length)
      /* eslint-disable-next-line no-useless-catch */
    } catch (err) {
      /* istanbul ignore next: difficult to make a test case for */
      throw err
    } finally {
      currentParser = null
      currentBufferRef = null
    }

    if (ret !== constants.ERROR.OK) {
      const ptr = llhttp.llhttp_get_error_reason(this.ptr)
      let message = ''
      /* istanbul ignore else: difficult to make a test case for */
      if (ptr) {
        const len = new Uint8Array(llhttp.memory.buffer, ptr).indexOf(0)
        message = Buffer.from(llhttp.memory.buffer, ptr, len).toString()
      }
      throw new Error(message)
    }
  }

  destroy() {
    assert(this.ptr != null)
    this.llhttp.llhttp_free(this.ptr)
    this.ptr = null
    this._onComplete = null;
  }

  onStatus(buf: Buffer) {
    this.statusText = buf.toString();
    return 0;
  }

  onMessageBegin() {
    //
    return 0;
  }

  onHeaderField(buf: Buffer) {
    const len = this.headers.length

    if ((len & 1) === 0) {
      this.headers.push(buf)
    } else {
      this.headers[len - 1] = Buffer.concat([this.headers[len - 1], buf])
    }
    return 0;
  }

  onHeaderValue(buf: Buffer) {
    let len = this.headers.length

    if ((len & 1) === 1) {
      this.headers.push(buf)
      len += 1
    } else {
      this.headers[len - 1] = Buffer.concat([this.headers[len - 1], buf])
    }

    const key = this.headers[len - 2]
    if (key.length === 10 && key.toString().toLowerCase() === 'keep-alive') {
      this.keepAlive += buf.toString()
    } else if (key.length === 14 && key.toString().toLowerCase() === 'content-length') {
      this.contentLength += buf.toString()
    }
    return 0;
  }

  onHeadersComplete(statusCode:number, upgrade:boolean, shouldKeepAlive:boolean) {
    this.statusCode = statusCode;
    this.upgrade = upgrade;
    this.shouldKeepAlive = shouldKeepAlive;
    return 0;
  }

  onBody(buf: Buffer) {
    this.bodyBuffs.push(buf);
    return 0;
  }

  onComplete(callback:(statusCode:number, headers?:{[key:string]:string}, body?:Buffer)=>void){
    this._onComplete = null;
    this._onComplete = callback;
  }

  onMessageComplete() {
    const headers = {}
    const n = this.headers.length;
    for(let i=0; i<n; i+=2){
      const key = this.headers[i].toString();
      const value = this.headers[i+1].toString();
      if(!headers[key]){
        headers[key] = value;
      }else{
        const oldValue = headers[key];
        headers[key] = [].concat(oldValue, value);
      }
    }
    // this.onComplete(this.statusCode, headers, this.bodyBuffs.length ? Buffer.concat(this.bodyBuffs) : undefined);
    const callback = this._onComplete;
    if(callback){
      callback(this.statusCode, headers, this.bodyBuffs.length ? Buffer.concat(this.bodyBuffs) : undefined);
      this._onComplete = null;
    }
    return 0;
  }
}