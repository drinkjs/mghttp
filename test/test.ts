import MgHTTP from "../dist";
import { PeerCertificate } from "tls";

const http = new MgHTTP({
  host: "https://www.baidu.com",
  proxy: {
    host: "127.0.0.1",
    port: 8888
  },
  checkServerIdentity: (host: string, cert: PeerCertificate) => {
    console.log(host);
    console.log(cert)
    return undefined
  }
});

http.request("/", { method: "GET" }).then(rel => {
  console.log(rel.statusCode);
});