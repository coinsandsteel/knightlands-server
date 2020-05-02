module.exports = {
  apps: [{
    name: "knightlands",
    script: "server.js",
    cwd: "src",
    watch: true,
    node_args: "-r esm -r ts-node/register"
  }]
}
