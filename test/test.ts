import MgHTTP from "../src";
import { writeFileSync } from "fs";

const http = new MgHTTP({
  host: "https://www.w3schools.com/",
  proxy: {
    host: "40.121.158.227",
    port: 8085,
    username: "33ac01c666a1dbff2400995ecc7afe5d",
    password: "46e530c42a5f1322d03c3ea1d101e60f",
  },
});

// http.request("/", {
//   method:"GET"
// }).catch(e =>{
//   console.log(e);
// })

// http.request("https://stackoverflow.com/questions/49335192/java-http-socket-end-of-stream", {
//   method:"GET"
// }).catch(e =>{
//   console.log(e);
// })




async function test() {

  const rel1 = await http.request("https://www.baidu.com", {
    method: "GET"
  })

  if (rel1.body)
    writeFileSync(`${Date.now()}.html`, rel1.body.toString());

  const rel2 = await http.request("http://www.drinkjs.com", {
    method: "GET"
  });

  if (rel2.body)
    writeFileSync(`${Date.now()}.html`, rel2.body.toString());


  http.request("https://stackoverflow.com/questions/49335192/java-http-socket-end-of-stream", {
    method: "GET"
  }).then(rel3 => {
    if (rel3.body)
      writeFileSync(`${Date.now()}.html`, rel3.body.toString());
  }).catch(err =>{
    console.log(err)
  })

  http.request("/", {
    method: "GET"
  }).then(rel4 => {
    if (rel4.body)
      writeFileSync(`${Date.now()}.html`, rel4.body.toString());
  });
}

test()
