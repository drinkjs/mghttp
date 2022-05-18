import MgHTTP from "../dist";

const http = new MgHTTP({
  host: "https://www.w3schools.com/",
  proxy: {
    host: "40.121.158.227",
    port: 8085,
    username: "33ac01c666a1dbff2400995ecc7afe5d",
    password: "46e530c42a5f1322d03c3ea1d101e60f",
  },
});

http.request("/", {
  method:"GET"
}).then(res =>{
  console.log(res);
})


