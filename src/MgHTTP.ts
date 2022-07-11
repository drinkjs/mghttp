import  { Socket } from "net";
import * as http from "http";
import * as https from "https";
import * as tls from "tls";
import { URL } from "url";
import HTTPParser from "./HTTPParser";
import { IncomingHttpHeaders } from "http";

export type ProxyOpts = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  timeout?: number;
};

export type MgHTTPOpts = {
  host?: string;
  proxy?: ProxyOpts;
  checkServerIdentity?:(host: string, cert: tls.PeerCertificate)=>Error | undefined
};

export type HTTPHeaders = IncomingHttpHeaders | {[key:string]:string}

export type HttpMethod =
  | "GET"
  | "HEAD"
  | "POST"
  | "PUT"
  | "DELETE"
  | "CONNECT"
  | "OPTIONS"
  | "TRACE"
  | "PATCH";

export type RequestOpts = {
  method?: HttpMethod;
  headers?:HTTPHeaders;
  searchParams?: string | string[][] | Record<string, string> | URLSearchParams | {[key: string]: any};
  json?: {
    [key: string]: any;
  };
  form?: string | string[][] | Record<string, string> | URLSearchParams | {[key: string]: any};
  timeout?:number,
};

export type HttpResponse = {
  statusCode: number;
  body?: Buffer;
  headers:HTTPHeaders;
};

const sessionCache = new Map();
const maxCachedSessions = 100;

export default class MgHTTP {
  private host?: string;

  private hostObj?: URL;

  private proxy?: ProxyOpts;

  private proxyAuth?: string;

  private proxyConnects: Map<string, { socket: Socket, parser: HTTPParser }> = new Map;

  private opts?:MgHTTPOpts

  destroyed = false;
  
  constructor(opts?: MgHTTPOpts) {
    this.opts = opts;
    const { host, proxy } = opts || {};
    this.host = host;
    if (host) {
      this.hostObj = new URL(host);
    }
    if (proxy) {
      this.changeProxy(proxy);
    }
  }

  destroy(){
    this.destroyed = true;
    this.proxyConnects.forEach(value => {
      value.parser.destroy();
      value.socket.removeAllListeners();
      value.socket.destroy();
    });
    this.proxyConnects.clear();
  }

  reuse(){
    this.destroyed = false;
  }

  changeProxy(proxy: ProxyOpts) {
    this.destroy();
    this.destroyed = false;
    this.proxy = proxy;
    if (proxy.username && proxy.password) {
      this.proxyAuth = Buffer.from(
        `${decodeURIComponent(proxy.username)}:${decodeURIComponent(
          proxy.password
        )}`
      ).toString("base64");
    }
  }

  private handlerSocketClose(socket: Socket, servername: string) {
    socket.removeAllListeners();
    if (!socket.destroyed) {
      socket.destroy();
    }
    const connectInfo = this.proxyConnects.get(servername);
    if (connectInfo) {
      connectInfo.socket.removeAllListeners();
      connectInfo.socket.destroy();
      connectInfo.parser.destroy();
      this.proxyConnects.delete(servername);
    }
  }

  /**
   * 创建tls连接
   * @param opts 
   * @param callback 
   */
   private async createTLS(opts: { socket?: Socket, servername: string, serverport: number, timeout?:number }) {

    const { socket, servername, serverport, timeout } = opts;
    const sessionKey = servername;
    const session = sessionCache.get(sessionKey) || null;

    return new Promise<tls.TLSSocket>((resolve, reject) => {
      // 建立tls连接
      const opts:any = {
        host: servername,
        port: serverport,
        session,
        servername,
        socket,
        timeout,
      }
      if(this.opts?.checkServerIdentity){
        opts.checkServerIdentity = this.opts?.checkServerIdentity
      }
      try{
        const tlsConn = tls.connect(opts,
          () => {
            tlsConn.removeAllListeners();
            resolve(tlsConn);
          }
        );

        tlsConn
          .setNoDelay(true)
          .on("session", (session)=> {
            if (sessionCache.size >= maxCachedSessions) {
              // remove the oldest session
              const { value: oldestKey } = sessionCache.keys().next();
              sessionCache.delete(oldestKey);
            }
            sessionCache.set(sessionKey, session);
          })
          .once("close", ()=>{
            tlsConn.removeAllListeners();
            reject(`${servername}:${serverport} tls close`)
          })
          .once("error", () => {
            tlsConn.removeAllListeners();
            if (sessionKey) {
              sessionCache.delete(sessionKey);
            }
            reject(`${servername}:${serverport} tls error`);
          });
      }catch(e){
        reject(`${servername}:${serverport} tls error`);
      }
    })
  }

  /**
   * 建立代理连接
   * @param opts 
   * @returns 
   */
   private async createProxy(opts: {
    proxy: ProxyOpts;
    servername: string;
    serverport: number;
    isHttps: boolean;
  }): Promise<{ socket: Socket, parser?: HTTPParser }> {

    const { proxy, servername, serverport, isHttps } = opts;
    return new Promise((resolve, reject) => {
      const connectInfo = this.proxyConnects.get(servername);
      if (connectInfo) {
        this.proxyConnects.delete(servername);
        connectInfo.socket.removeAllListeners();
        resolve(connectInfo);
        return;
      }

      // 连接代理
      const headers:any = {
        "Proxy-Connection": "keep-alive",
        host: `${servername}:${serverport}`,
      }
      if(this.proxyAuth){
        headers["proxy-authorization"] = `Basic ${this.proxyAuth}`
      }
      const proxyReq = http.request({
        method: "CONNECT",
        port: proxy.port || 80,
        host: proxy.host,
        timeout: proxy.timeout || 5000,
        path: `${servername}:${serverport}`,
        setHost: false,
        headers,
      });

      proxyReq.once("connect", (response, socket) => {

        if (response.statusCode === 200) {
          socket
            .setKeepAlive(true)
            .once("close", () => {
              this.handlerSocketClose(socket, servername);
            })
            .once("error", ()=>{
              this.handlerSocketClose(socket, servername);
            })
 
          if (!isHttps) {
            // 不是https就不需要建立tls连接
            resolve({ socket });
            return;
          }

          this.createTLS({
            socket,
            servername,
            serverport
          }).then(tlsSocket => {
            resolve({ socket: tlsSocket })
          }).catch(err =>{
            reject(err)
          })

        } else {
          reject(`${proxy.host}:${proxy.port||80} connect fail StatusCode:${response.statusCode}`)
        }
      });

      proxyReq.once("error", (err) => {
        reject(`${proxy.host}:${proxy.port||80} connect error: ${err.message}`)
      });

      proxyReq.once("timeout", () => {
        reject(`${proxy.host}:${proxy.port||80} connect timeout..`)
      });
      // 发送请求
      proxyReq.end();
    });
  }

  /**
   * 发起http请求
   * @param params 
   */
   private async httpReq(params: {
    method: HttpMethod;
    host: string;
    port: number;
    path: string;
    headers?: HTTPHeaders;
    body?: any;
    timeout?:number
  }) {

    const { method, headers, body, path, host, port, timeout } = params;
    const req = http.request(
      {
        method,
        port,
        host,
        path,
        headers,
        timeout
      }
    );

    return new Promise<HttpResponse>((resolve, reject) => {
      req.on("response", (res) => {
        const datas:Buffer[] = [];
        res.on("data", (chunk) => {
          datas.push(chunk);
        });
        res.once("end", () => {
          req.removeAllListeners();
          resolve({ statusCode: res.statusCode || 0, headers: res.headers, body: datas.length ? Buffer.concat(datas) : undefined })
        });
      })

      req.once("error", (err) => {
        req.removeAllListeners();
        reject(err)
      });

      req.once("timeout", ()=>{
        req.removeAllListeners();
        reject(`${path} request timeout`)
      })

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  /**
   * 发起https请求
   * @param params 
   */
   private async httsReq(params: {
    method: HttpMethod;
    host: string;
    port: number;
    path: string;
    headers?: HTTPHeaders;
    body?: any;
    timeout?:number
  }) {
    const { method, headers, body, path, host, port, timeout } = params;
    const options:any = {
      method,
        port,
        host,
        hostname:host,
        path,
        headers,
        // servername: host,
        timeout,
    }
    if(this.opts?.checkServerIdentity){
      options.checkServerIdentity = this.opts?.checkServerIdentity;
    }
    const req = https.request(options);
    return new Promise<HttpResponse>((resolve, reject) => {
      req.on("response", (res) => {
        const datas:Buffer[] = [];
        res.on("data", (chunk) => {
          datas.push(chunk);
        });
        res.once("end", () => {
          req.removeAllListeners();
          resolve({ statusCode: res.statusCode || 0, headers: res.headers, body: datas.length ? Buffer.concat(datas) : undefined })
        });
      });

      req.once("error", (err) => {
        req.removeAllListeners();
        reject(err)
      });

      req.once("timeout", ()=>{
        req.removeAllListeners();
        reject(`${path} request timeout`)
      })

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  async request(url: string, opts: RequestOpts) {
    const { method = "GET", searchParams, json, form, headers = {}, timeout } = opts;

    let urlObj: URL | undefined = this.hostObj;
    if (/^http[s]*?:/.test(url)) {
      urlObj = new URL(url);
    } else if (urlObj) {
      urlObj = new URL(this.host + url);
    }

    if(!urlObj){
      throw new Error("NonlicetURL:" + url);
    }

    let searchText = urlObj.search;
    if (searchParams) {
      searchText += (searchText ? "&" : "?") + new URLSearchParams(searchParams).toString();
    }

    let serverport = urlObj.port;
    if (!serverport) {
      serverport = urlObj.protocol === "https:" ? "443" : "80";
    }

    let body: string | undefined;
    if (json) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(json);
    }

    if (form) {
      headers["content-type"] =
        "application/x-www-form-urlencoded";
      body = new URLSearchParams(form).toString();
    }

    if (body) {
      headers["content-length"] = Buffer.byteLength(body).toString();
    }

    const isHttps = urlObj.protocol === "https:";

    return new Promise<HttpResponse>((resolve, reject) => {
      if(this.destroyed){
        reject("The client is destroyed");
        return;
      }

      if (this.proxy) {
        if (isHttps) {
          // https需要通过connect方法与服务器隧道进行通信
          headers["Host"] = `${urlObj!.hostname}:${serverport}`;
          this.createProxy({
            proxy: this.proxy,
            servername: urlObj!.hostname,
            serverport: Number(serverport),
            isHttps: true,
          }).then(({ socket, parser }) => {
            // 创建tls代理成功
            if(this.destroyed){
              reject("The client is destroyed");
              return;
            }

            const tlsSocket = socket;
            // 组装http内容 GET / HTTP/1.1
            let reqMessage = `${method} ${urlObj!.pathname || "/"}${searchText} HTTP/1.1\r\n`;
            for (const key in headers) {
              reqMessage += `${key}: ${headers[key]}\r\n`;
            }
            // header end
            reqMessage += "\r\n";
            if (body) {
              reqMessage += body;
            }

            const httpParse = parser || new HTTPParser();
            // 解释结果
            const parseData = (chunk:Buffer)=>{
              // 接受服务器响应
              httpParse.execute(chunk);
            }
            // 解释完成
            httpParse.onComplete((statusCode: number, resHeaders: HTTPHeaders, resBody?: Buffer) => {
              tlsSocket.removeListener("data", parseData);
              if(this.destroyed){
                return;
              }
              this.proxyConnects.set(urlObj!.hostname, { socket: tlsSocket, parser: httpParse });
              resolve({ statusCode, headers: resHeaders, body: resBody });
            });

            tlsSocket.removeAllListeners();
            tlsSocket
            .on("data", parseData)
            .once("error", (err) => {
              let parser:any = httpParse;
              parser.destroy();
              parser = null;
              this.handlerSocketClose(tlsSocket, urlObj!.hostname);
              reject(`The tls error: ${err.message}`);
            })
            .once("close", () => {
              let parser:any = httpParse;
              parser.destroy();
              parser = null;
              this.handlerSocketClose(tlsSocket, urlObj!.hostname);
              reject("The tls close");
            });
            // 发送请求
            tlsSocket.write(reqMessage);
          }).catch((err?:any) => {
            reject("create proxy error"+err?.message)
          });

        } else {
          // http直接显式代理
          if (this.proxyAuth) {
            headers["proxy-authorization"] = `Basic ${this.proxyAuth}`;
          }
          this.httpReq({
            method,
            host: this.proxy.host,
            port: this.proxy.port,
            path: `http://${urlObj!.hostname}:${serverport}${urlObj!.pathname}${searchText}`,
            body,
            headers,
            timeout
          }).then((rel)=>{
            if(this.destroyed){
              return;
            }
            resolve(rel);
          }).catch(err => reject(err))
        }
      } else {
        // 没有代理直接请求
        const reqParams = {
          method,
          host: urlObj!.hostname,
          port: Number(serverport),
          path: `${urlObj!.pathname}${searchText}`,
          body,
          headers,
        }
        if (isHttps) {
          this.httsReq(reqParams).then((rel)=>{
            if(this.destroyed){
              return;
            }
            resolve(rel);
          }).catch((err)=> reject(err))
        } else {
          this.httpReq(reqParams).then((rel)=>{
            if(this.destroyed){
              return;
            }
            resolve(rel);
          }).catch((err)=>reject(err))
        }
      }
    })
  }
}
