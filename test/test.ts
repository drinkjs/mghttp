import MgHTTP from "../dist";



const http = new MgHTTP({
  host: "https://www.facebook.com",
  proxy: {
    host: "127.0.0.1",
    port: 7890,
    // username: "468501fac5779b9b64643a88b953fe61",
    // password: "064645c4fc3b2f0bec15e8c591a2930f",
  },
});

// setInterval(()=>{
//   http.request("/", {
//     method:"GET",
//     headers:{
//       "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36"
//     },
//   }).then(res =>{
//     console.log(res);
//   }).catch(e=>{
//     console.log(e);
//   })
// }, 1000)

console.log(new URLSearchParams([["facetsToRetrieve[]", "browseVerticals"],["propsToRetrieve[][]", "brand"]]).toString())


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