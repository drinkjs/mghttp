import { Socket } from "net";
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
  searchParams?: {
    [key: string]: any;
  };
  json?: {
    [key: string]: any;
  };
  form?: {
    [key: string]: any;
  };
};

export type HttpResponse = {
  statusCode: number;
  body?: Buffer;
  headers?:HTTPHeaders;
};

export enum HttpError {
  PROXY_TIMEOUT = 1,
  PROXY_ERROR = 2,
  TLS_ERROR = 3,
  TLS_TIMEOUT = 4,
  HTTP_PARSE_ERROR = 5,
}

const sessionCache = new Map();
const maxCachedSessions = 1000;

export default class MgHTTP {
  private host?: string;

  private hostObj?: URL;

  private proxy?: ProxyOpts;

  private proxyAuth?: string;

  private proxyConnects: Map<string, { socket: Socket, parser: HTTPParser }> = new Map;

  constructor(opts?: MgHTTPOpts) {
    const { host, proxy } = opts;
    this.host = host;
    if (host) {
      this.hostObj = new URL(host);
    }
    if (proxy) {
      this.changeProxy(proxy);
    }
  }

  changeProxy(proxy: ProxyOpts) {
    this.proxy = proxy;

    this.proxyConnects.forEach(value => {
      value.parser.destroy();
      value.socket.removeAllListeners();
      value.socket.destroy();
    });
    this.proxyConnects.clear();

    if (proxy.username && proxy.password) {
      this.proxyAuth = Buffer.from(
        `${decodeURIComponent(proxy.username)}:${decodeURIComponent(
          proxy.password
        )}`
      ).toString("base64");
    }
  }

  handlerSocketClose(socket: Socket, servername: string) {
    socket.removeAllListeners();
    if (!socket.destroyed) {
      socket.destroy();
    }
    const connectInfo = this.proxyConnects.get(servername);
    if (connectInfo) {
      connectInfo.parser.destroy()
      this.proxyConnects.delete(servername);
    }
  }

  /**
   * 创建tls连接
   * @param opts 
   * @param callback 
   */
  async createTLS(opts: { socket?: Socket, servername: string, serverport: number, timeout?:number }) {
    const { socket, servername, serverport, timeout } = opts;
    const sessionKey = servername;
    const session = sessionCache.get(sessionKey) || null;

    return new Promise<tls.TLSSocket>((resolve, reject) => {
      // 建立tls连接
      const tlsConn = tls.connect(
        {
          host: servername,
          port: serverport,
          session,
          servername,
          socket,
          timeout,
        },
        () => {
          console.log(`${servername} tls ok`);
          tlsConn.removeAllListeners();
          resolve(tlsConn)
        }
      );
      tlsConn
        .setNoDelay(true)
        .on("session", function (session) {
          if (sessionCache.size >= maxCachedSessions) {
            // remove the oldest session
            const { value: oldestKey } = sessionCache.keys().next();
            sessionCache.delete(oldestKey);
          }
          sessionCache.set(sessionKey, session);
        })
        .on("error", (err: any) => {
          if (sessionKey && err.code !== "UND_ERR_INFO") {
            // TODO (fix): Only delete for session related errors.
            sessionCache.delete(sessionKey);
          }
          tlsConn.removeAllListeners();
          reject(err)
        });
    })
  }

  /**
   * 建立代理连接
   * @param opts 
   * @returns 
   */
  async createProxy(opts: {
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
      const proxyReq = http.request({
        method: "CONNECT",
        port: proxy.port || 80,
        host: proxy.host,
        timeout: proxy.timeout || 5000,
        path: `${servername}:${serverport}`,
        setHost: false,
        headers: {
          // connection: "keep-alive",
          host: `${servername}:${serverport}`,
          "proxy-authorization": this.proxyAuth
            ? `Basic ${this.proxyAuth}`
            : undefined,
        },
      });

      proxyReq.once("connect", (response, socket) => {
        if (response.statusCode === 200) {
          socket
            .setKeepAlive(true)
            .once("close", () => {
              console.log("socket close");
              this.handlerSocketClose(socket, servername);
            });
 
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
          }).catch(err => {
            reject({ code: HttpError.TLS_ERROR, message: err.message })
          })

        } else {
          proxyReq.removeAllListeners();
          proxyReq.destroy();
          reject({
            code: HttpError.PROXY_ERROR,
            message: `连接代理失败${response.statusCode}`,
          });
        }
      });

      proxyReq.once("error", (err) => {
        proxyReq.removeAllListeners();
        proxyReq.destroy();
        reject({ code: HttpError.PROXY_ERROR, message: err.message });
      });

      proxyReq.once("timeout", () => {
        proxyReq.removeAllListeners();
        proxyReq.destroy();
        reject({ code: HttpError.PROXY_TIMEOUT, message: "连接代理超时" });
      });
      // 发送请求
      proxyReq.end();
    });
  }

  /**
   * 发起http请求
   * @param params 
   */
  async httpReq(params: {
    method: HttpMethod;
    host: string;
    port: number;
    path: string;
    headers?: HTTPHeaders;
    body?: any;
  }) {
    const { method, headers, body, path, host, port } = params;
    const req = http.request(
      {
        method,
        port,
        host,
        path,
        headers,
      }
    );

    return new Promise<HttpResponse>((resolve, reject) => {
      req.on("response", (res) => {
        const datas = [];
        res.on("data", (chunk) => {
          datas.push(chunk);
        });
        res.once("end", () => {
          req.removeAllListeners();
          resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(datas) })
        });
      })

      req.once("error", (err) => {
        req.removeAllListeners();
        reject(err)
      });

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
  async httsReq(params: {
    method: HttpMethod;
    host: string;
    port: number;
    path: string;
    headers?: HTTPHeaders;
    body?: any;
  }) {
    const { method, headers, body, path, host, port } = params;
    const req = https.request(
      {
        method,
        port,
        host,
        path,
        headers,
        servername: host,
      }
    );
    return new Promise<HttpResponse>((resolve, reject) => {
      req.on("response", (res) => {
        const datas = [];
        res.on("data", (chunk) => {
          datas.push(chunk);
        });
        res.once("end", () => {
          req.removeAllListeners();
          resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(datas) })
        });
      });

      req.once("error", (err) => {
        req.removeAllListeners();
        reject(err)
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  async request(url: string, opts: RequestOpts) {
    const { method = "GET", searchParams, json, form, headers = {} } = opts;

    let urlObj: URL | undefined = this.hostObj;
    if (/^http[s]*?:/.test(url)) {
      urlObj = new URL(url);
    } else if (urlObj) {
      urlObj.pathname = url;
    } else {
      throw new Error("无效的URL" + url);
    }

    let searchText = "";
    if (searchParams) {
      searchText = "?" + new URLSearchParams(searchParams).toString();
    }

    let serverport = urlObj.port;
    if (!serverport) {
      serverport = urlObj.protocol === "https:" ? "443" : "80";
    }

    let body: string | undefined;
    if (json) {
      headers["content-type"] = "application/json; charset=utf-8";
      body = JSON.stringify(json);
    }

    if (form) {
      headers["content-type"] =
        "application/x-www-form-urlencoded; charset=utf-8";
      body = new URLSearchParams(form).toString();
    }

    if (body) {
      headers["content-length"] = Buffer.byteLength(body).toString();
    }

    const isHttps = urlObj.protocol === "https:";

    return new Promise<HttpResponse>((resolve, reject) => {
      if (this.proxy) {
        if (isHttps) {
          // https需要通过connect方法与服务器隧道进行通信
          headers["Host"] = `${urlObj.host}:${serverport}`;
          this.createProxy({
            proxy: this.proxy,
            servername: urlObj.hostname,
            serverport: Number(serverport),
            isHttps: true,
          }).then(({ socket, parser }) => {
            const tlsSocket = socket;
            // 组装http内容 GET / HTTP/1.1
            let reqMessage = `${method} ${urlObj.pathname || "/"}${searchText} HTTP/1.1\r\n`;
            for (const key in headers) {
              reqMessage += `${key}: ${headers[key]}\r\n`;
            }
            // header end
            reqMessage += "\r\n";
            if (body) {
              reqMessage += body;
            }
            // 解释结果
            const httpParse = parser || new HTTPParser();
            httpParse.onComplete((statusCode: number, resHeaders: HTTPHeaders, resBody?: Buffer) => {
              this.proxyConnects.set(urlObj.hostname, { socket, parser: httpParse });
              resolve({ statusCode, headers: resHeaders, body: resBody });
            });
            tlsSocket.on("data", (chunk) => {
              // 接受服务器响应
              httpParse.execute(chunk);
            });

            tlsSocket.on("error", (err) => {
              this.handlerSocketClose(tlsSocket, urlObj.hostname)
              reject(err);
            })

            tlsSocket.on("end", () => {
              this.handlerSocketClose(tlsSocket, urlObj.hostname)
            });
            // 发送请求
            tlsSocket.write(reqMessage);
          }).catch(err => {
            console.log(err)
            reject(err);
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
            path: `http://${urlObj.hostname}:${serverport}${urlObj.pathname}${searchText}`,
            body,
            headers,
          }).then(resolve).catch(err => reject(err))
        }
      } else {
        // 没有代理直接请求
        const reqParams = {
          method,
          host: urlObj.host,
          port: Number(serverport),
          path: `${urlObj.pathname}${searchText}`,
          body,
          headers,
        }
        if (isHttps) {
          this.httsReq(reqParams).then(resolve).catch((err)=>reject(err))
        } else {
          this.httpReq(reqParams).then(resolve).catch((err)=>reject(err))
        }
      }
    })
  }
}
