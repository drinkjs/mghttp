import MgHTTP from "../src/index";
import { PeerCertificate } from "tls";


function req(){
  const http = new MgHTTP({
    host: "https://www.footlocker.com",
    proxy: {
      host: "127.0.0.1",
      port: 7890
    },
    // checkServerIdentity: (host: string, cert: PeerCertificate) => {
    //   console.log(host);
    //   console.log(cert)
    //   return undefined
    // }
  });

  http.request("/api/v3/session", {
    method: "GET",
    headers: { "x-fl-request-id": "006f6860-00e7-11ed-af61-256fb6fcbe40" },
    searchParams: { timestamp: Date.now() },
  }).then(rel => {
    console.log(rel.statusCode);
    setTimeout(req, 7500)
  }).catch(e =>{
    console.log("error:", e.message)
  })
}

req();