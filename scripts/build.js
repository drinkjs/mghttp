const rimraf = require("rimraf");
const fs = require("fs");
const { execSync } = require("child_process");
const ncp = require('ncp').ncp;
// 删除原来的dist目录
rimraf.sync("./dist");
// 执行tsc
execSync("node node_modules/typescript/bin/tsc");

ncp("./src/llhttp", "./dist/llhttp", (ncperr) => {
  if (ncperr) {
    throw ncperr
  }
})


