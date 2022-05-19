import MgHTTP from "../dist";
import * as http2 from "http2"

const http = new MgHTTP({
  host: "https://www.footlocker.es",
  proxy: {
    host: "127.0.0.1",
    port: 7890,
    // username: "33ac01c666a1dbff2400995ecc7afe5d",
    // password: "46e530c42a5f1322d03c3ea1d101e60f",
  },
});

http.request("/api/products/pdp/314215396004", {
  method:"GET",
  searchParams:{
    timestamp:"1652936541429"
  },
}).then(res =>{
  console.log(res);
})


// const client = http2.connect('https://www.footlocker.es', {
// });

// const req = client.request({ ':path': '/api/products/pdp/314215396004?timestamp=1652936541429' });

// req.on('response', (headers, flags) => {
//   for (const name in headers) {
//     console.log(`${name}: ${headers[name]}`);
//   }
// });

// req.setEncoding('utf8');
// let data = '';
// req.on('data', (chunk) => { data += chunk; });
// req.on('end', () => {
//   console.log(`\n${data}`);
//   client.close();
// });
// req.end();